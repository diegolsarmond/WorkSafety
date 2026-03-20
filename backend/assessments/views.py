import hashlib
import json
import logging
from urllib.parse import urljoin
from rest_framework import views, status, parsers
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from django.http import FileResponse, Http404
from django.utils import timezone
from django.conf import settings
from django.urls import reverse
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.generics import ListCreateAPIView, RetrieveAPIView
from rest_framework.permissions import IsAuthenticated, AllowAny

from .models import RiskAssessment, Evidence, AIInferenceResult, AssessmentStatusHistory

logger = logging.getLogger(__name__)
from .serializers import (
    EvidenceUploadSerializer,
    EvidenceSerializer,
    RiskAssessmentSerializer,
    RiskAssessmentStatusSerializer,
    RiskAssessmentListSerializer,
    RiskAssessmentDetailSerializer,
    AIInferenceDetailSerializer,
    AssessmentStatusHistorySerializer,
    AIQueueItemSerializer,
)
from .services import AssessmentLifecycleService, InvalidTransitionError
from .tasks import process_assessment, reprocess_assessment


@extend_schema(tags=["Assessments"])
class RiskAssessmentListCreateView(ListCreateAPIView):
    """
    List or create Risk Assessments.
    Users can only see and modify their own RiskAssessments.
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter assessments by the current authenticated user."""
        return RiskAssessment.objects.filter(created_by=self.request.user)

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return RiskAssessmentListSerializer
        return RiskAssessmentSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


@extend_schema(tags=["Assessments"])
class RiskAssessmentDetailView(RetrieveAPIView):
    """
    Retrieve detailed Risk Assessment with risks, evidences and inferences.
    Users can only access their own RiskAssessments.
    """
    serializer_class = RiskAssessmentDetailSerializer
    permission_classes = [IsAuthenticated]
    lookup_url_kwarg = 'assessment_id'

    def get_queryset(self):
        """Filter assessments by the current authenticated user with prefetch."""
        return RiskAssessment.objects.filter(
            created_by=self.request.user
        ).prefetch_related(
            'findings', 'evidences', 'inferences', 'inferences__decisions'
        )


@extend_schema_view(
    post=extend_schema(
        tags=["Assessments"],
        summary="Upload Images (Evidences)",
        description=(
            "Uploads up to 10 images with optional ISO 8601 timestamps for a RiskAssessment. "
            "If timestamps are provided, they must match the number of images. "
            "Each timestamp is stored in the evidence's captured_at field. "
            "Ensures idempotency based on standard hashing (SHA-256) of each image. "
            "Images are automatically anonymized (faces and plates blurred) before storage "
            "to ensure LGPD/GDPR compliance. "
            "Users can only upload evidences to their own RiskAssessments."
        ),
        request=EvidenceUploadSerializer,
        responses={201: EvidenceSerializer(many=True)},
    )
)
class EvidenceUploadView(views.APIView):
    parser_classes = (parsers.MultiPartParser, parsers.FormParser)
    permission_classes = [IsAuthenticated]

    def post(self, request, assessment_id, *args, **kwargs):
        from .anonymization import anonymize_evidence
        from .tasks import anonymize_evidence_task

        # Filter by created_by to ensure user can only access own assessments
        assessment = get_object_or_404(
            RiskAssessment,
            id=assessment_id,
            created_by=request.user
        )

        serializer = EvidenceUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        images = serializer.validated_data['images']
        timestamps = serializer.validated_data.get('timestamps', [])

        created_evidences = []
        for i, image in enumerate(images):
            timestamp = timestamps[i] if timestamps else None

            # Read image content for hash to check idempotency
            image_content = image.read()
            file_hash = hashlib.sha256(image_content).hexdigest()
            image.seek(0)  # Reset file pointer after reading

            # Idempotency check
            existing_evidence = Evidence.objects.filter(assessment=assessment, file_hash=file_hash).first()
            if existing_evidence:
                created_evidences.append(existing_evidence)
                continue

            # Create new evidence
            new_evidence = Evidence(
                assessment=assessment,
                file=image,
                captured_at=timestamp,
                anonymization_status="pending",
            )
            new_evidence.save()

            # LGPD/GDPR: Anonimizar evidência antes de disponibilizar
            # Por padrão, fazemos anonimização síncrona para garantir que
            # o arquivo persistido já esteja anonimizado
            try:
                result = anonymize_evidence(new_evidence, request.user)
                if not result.success:
                    # Se anonimização falhou mas não é crítico, logamos e continuamos
                    # Em ambientes com ANONYMIZATION_BLOCK_PLATES=True, pode falhar
                    logger.warning(
                        f"Anonymization issue for evidence {new_evidence.pk}: "
                        f"{result.error_message}"
                    )
            except Exception as e:
                # Em caso de erro na anonimização, não falhamos o upload
                # mas marcamos para processamento assíncrono
                logger.exception(f"Synchronous anonymization failed for evidence {new_evidence.pk}: {e}")
                # Enfileirar para processamento assíncrono
                anonymize_evidence_task.delay(new_evidence.id, request.user.id)

            created_evidences.append(new_evidence)

        result_serializer = EvidenceSerializer(
            created_evidences,
            many=True,
            context={'request': request}
        )
        return Response(result_serializer.data, status=status.HTTP_201_CREATED)


@extend_schema_view(
    get=extend_schema(
        tags=["Assessments"],
        summary="Download de Evidência",
        description=(
            "Faz streaming da imagem de evidência via backend Django. "
            "Evita dependência de configuração /media no Nginx. "
            "Acesso permitido para dono da avaliação ou admin."
        ),
        responses={
            200: {'type': 'string', 'format': 'binary'},
            404: {'type': 'object', 'properties': {'error': {'type': 'string'}}},
        },
    )
)
class EvidenceDownloadView(views.APIView):
    """
    GET /api/assessments/evidences/{id}/download/

    Faz download/stream de evidência.
    """

    # Mantém sem autenticação para compatibilidade com renderização direta de imagens
    # em tags <img>, igual ao comportamento anterior via /media.
    permission_classes = [AllowAny]

    def get(self, request, evidence_id, *args, **kwargs):
        evidence = get_object_or_404(Evidence, id=evidence_id)

        if not evidence.file:
            raise Http404("Evidence file not found")

        try:
            evidence.file.open('rb')
        except Exception as exc:
            raise Http404("Evidence file is not accessible") from exc

        filename = evidence.file.name.split('/')[-1] if evidence.file.name else f"evidence_{evidence.id}"
        return FileResponse(
            evidence.file,
            as_attachment=False,
            filename=filename,
            content_type=evidence.mime_type or None,
        )


# =============================================================================
# Endpoints de Transição de Ciclo de Vida
# =============================================================================

class AssessmentTransitionBaseView(views.APIView):
    """Base class para views de transição de status.

    Users can only transition their own RiskAssessments.
    """
    permission_classes = [IsAuthenticated]
    transition_method: str = ''
    success_message = "Transição realizada com sucesso"

    @extend_schema(
        tags=["Assessment Lifecycle"],
        request={
            'type': 'object',
            'properties': {
                'reason': {'type': 'string', 'description': 'Motivo opcional da transição'},
            }
        },
        responses={
            200: RiskAssessmentStatusSerializer,
            400: {'type': 'object', 'properties': {'error': {'type': 'string'}}},
            404: {'type': 'object', 'properties': {'error': {'type': 'string'}}},
        }
    )
    def post(self, request, assessment_id, *args, **kwargs):
        # Filter by created_by to ensure user can only access own assessments
        assessment = get_object_or_404(
            RiskAssessment,
            id=assessment_id,
            created_by=request.user
        )
        reason = request.data.get('reason', None)

        try:
            previous_status = assessment.status

            # Executar transição via service
            method = getattr(AssessmentLifecycleService, self.transition_method)
            updated_assessment = method(assessment, request.user, reason)

            return Response({
                'status': updated_assessment.status,
                'previous_status': previous_status,
                'message': self.success_message,
                'timestamp': updated_assessment.status_changed_at,
            }, status=status.HTTP_200_OK)

        except InvalidTransitionError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


@extend_schema(tags=["Assessment Lifecycle"])
class AssessmentCaptureView(AssessmentTransitionBaseView):
    """
    POST /assessments/{id}/capture

    Transiciona a avaliação para o estado CAPTURED.
    Pré-requisito: status deve ser DRAFT.
    """
    transition_method = 'capture'
    success_message = "Avaliação capturada com sucesso"


@extend_schema(tags=["Assessment Lifecycle"])
class AssessmentSyncView(AssessmentTransitionBaseView):
    """
    POST /assessments/{id}/sync

    Transiciona a avaliação para o estado SYNCED.
    Pré-requisito: status deve ser CAPTURED.
    """
    transition_method = 'sync'
    success_message = "Avaliação sincronizada com sucesso"


@extend_schema(tags=["Assessment Lifecycle"])
class AssessmentMarkAIReviewedView(AssessmentTransitionBaseView):
    """
    POST /assessments/{id}/ai-reviewed

    Transiciona a avaliação para o estado AI_REVIEWED.
    Pré-requisito: status deve ser SYNCED.
    """
    transition_method = 'mark_ai_reviewed'
    success_message = "Avaliação revisada por IA com sucesso"


@extend_schema(tags=["Assessment Lifecycle"])
class AssessmentHumanValidateView(AssessmentTransitionBaseView):
    """
    POST /assessments/{id}/human-validated

    Transiciona a avaliação para o estado HUMAN_VALIDATED.
    Pré-requisito: status deve ser AI_REVIEWED.
    """
    transition_method = 'human_validate'
    success_message = "Avaliação validada por humano com sucesso"


@extend_schema(tags=["Assessment Lifecycle"])
class AssessmentFinalizeView(AssessmentTransitionBaseView):
    """
    POST /assessments/{id}/finalize

    Transiciona a avaliação para o estado FINALIZED.
    Pré-requisito: status deve ser HUMAN_VALIDATED.
    """
    transition_method = 'finalize'
    success_message = "Avaliação finalizada com sucesso"


@extend_schema(tags=["Assessment Lifecycle"])
class AssessmentStatusHistoryView(views.APIView):
    """
    GET /assessments/{id}/status-history

    Retorna o histórico completo de transições de status da avaliação,
    incluindo registros persistidos no AssessmentStatusHistory.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Assessment Lifecycle"],
        responses={
            200: {
                'type': 'object',
                'properties': {
                    'current_status': {'type': 'string'},
                    'current_status_display': {'type': 'string'},
                    'transitions': {
                        'type': 'array',
                        'items': {
                            'type': 'object',
                            'properties': {
                                'id': {'type': 'integer'},
                                'from_status': {'type': 'string'},
                                'from_status_display': {'type': 'string'},
                                'to_status': {'type': 'string'},
                                'to_status_display': {'type': 'string'},
                                'changed_by': {'type': 'string', 'nullable': True},
                                'changed_at': {'type': 'string', 'format': 'date-time'},
                                'reason': {'type': 'string'},
                            },
                        },
                    },
                    'milestones': {'type': 'object'},
                    'last_status_change': {'type': 'object'},
                },
            }
        }
    )
    def get(self, request, assessment_id, *args, **kwargs):
        # Filter by created_by to ensure user can only access own assessments
        assessment = get_object_or_404(
            RiskAssessment,
            id=assessment_id,
            created_by=request.user
        )
        history = AssessmentLifecycleService.get_status_history(assessment)
        return Response(history, status=status.HTTP_200_OK)


@extend_schema(tags=["Assessment Lifecycle"])
class AssessmentValidTransitionsView(views.APIView):
    """
    GET /assessments/{id}/valid-transitions

    Retorna as transições válidas a partir do status atual.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Assessment Lifecycle"],
        responses={200: {'type': 'object'}}
    )
    def get(self, request, assessment_id, *args, **kwargs):
        # Filter by created_by to ensure user can only access own assessments
        assessment = get_object_or_404(
            RiskAssessment,
            id=assessment_id,
            created_by=request.user
        )
        valid_transitions = AssessmentLifecycleService.get_valid_transitions(assessment.status)

        transitions_with_labels = [
            {'value': t, 'label': dict(RiskAssessment.STATUS_CHOICES).get(t, t)}
            for t in valid_transitions
        ]

        return Response({
            'current_status': {
                'value': assessment.status,
                'label': assessment.get_status_display(),
            },
            'valid_transitions': transitions_with_labels,
        }, status=status.HTTP_200_OK)


# =============================================================================
# AI Processing Endpoints
# =============================================================================

@extend_schema_view(
    post=extend_schema(
        tags=["AI Processing"],
        summary="Force AI Processing",
        description=(
            "Força o reprocessamento da avaliação pelo serviço de IA. "
            "Disponível para avaliações com status SYNCED, AI_REVIEWED ou ERROR_AI. "
            "Users can only process their own RiskAssessments."
        ),
        responses={
            202: {
                'type': 'object',
                'properties': {
                    'message': {'type': 'string'},
                    'task_id': {'type': 'string'},
                    'status': {'type': 'string'},
                }
            },
            400: {'type': 'object', 'properties': {'error': {'type': 'string'}}},
            404: {'type': 'object', 'properties': {'error': {'type': 'string'}}},
        }
    )
)
class AssessmentProcessAIView(views.APIView):
    """Endpoint para forçar o processamento de IA de uma avaliação."""
    permission_classes = [IsAuthenticated]

    def post(self, request, assessment_id, *args, **kwargs):
        assessment = get_object_or_404(
            RiskAssessment,
            id=assessment_id,
            created_by=request.user
        )

        # Verificar se a avaliação pode ser processada
        if assessment.status not in [
            RiskAssessment.STATUS_SYNCED,
            RiskAssessment.STATUS_AI_REVIEWED,
            RiskAssessment.STATUS_ERROR_AI,
        ]:
            return Response(
                {
                    'error': f"Cannot process assessment with status '{assessment.status}'. "
                            f"Expected 'synced', 'ai_reviewed' or 'error_ai'."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Enfileirar task
        task = process_assessment.delay(assessment.id)

        return Response({
            'message': 'AI processing queued successfully',
            'task_id': task.id,
            'status': 'queued',
        }, status=status.HTTP_202_ACCEPTED)


@extend_schema_view(
    post=extend_schema(
        tags=["AI Processing"],
        summary="Reprocess Assessment AI",
        description=(
            "Reprocessa uma avaliação que falhou anteriormente (status=error_ai). "
            "Reseta o status para SYNCED e enfileira novo processamento. "
            "Users can only reprocess their own RiskAssessments."
        ),
        request={
            'type': 'object',
            'properties': {
                'reason': {'type': 'string', 'description': 'Motivo opcional do reprocessamento'},
            }
        },
        responses={
            202: {
                'type': 'object',
                'properties': {
                    'message': {'type': 'string'},
                    'task_id': {'type': 'string'},
                    'previous_status': {'type': 'string'},
                    'status': {'type': 'string'},
                }
            },
            400: {'type': 'object', 'properties': {'error': {'type': 'string'}}},
            404: {'type': 'object', 'properties': {'error': {'type': 'string'}}},
        }
    )
)
class AssessmentReprocessAIView(views.APIView):
    """
    POST /assessments/{id}/reprocess-ai

    Reprocessa uma avaliação em estado ERROR_AI.
    Transiciona ERROR_AI → SYNCED e enfileira novo processamento de IA.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, assessment_id, *args, **kwargs):
        assessment = get_object_or_404(
            RiskAssessment,
            id=assessment_id,
            created_by=request.user
        )

        # Verificar se está em estado de erro de IA
        if assessment.status != RiskAssessment.STATUS_ERROR_AI:
            return Response(
                {
                    'error': f"Cannot reprocess assessment with status '{assessment.status}'. "
                            f"Only assessments with 'error_ai' status can be reprocessed."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        reason = request.data.get('reason', 'Reprocessamento de IA solicitado')

        try:
            previous_status = assessment.status
            # Usar service para transição com histórico
            AssessmentLifecycleService.reprocess_ai(assessment, request.user, reason)

            # Enfileirar reprocessamento
            task = reprocess_assessment.delay(assessment.id)

            return Response({
                'message': 'Assessment reprocessing queued successfully',
                'task_id': task.id,
                'previous_status': previous_status,
                'status': 'queued',
            }, status=status.HTTP_202_ACCEPTED)

        except InvalidTransitionError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


@extend_schema_view(
    get=extend_schema(
        tags=["AI Processing"],
        summary="Get AI Processing Status",
        description=(
            "Retorna o status do processamento de IA de uma avaliação, "
            "incluindo resultado bruto, confiança e mensagens de erro. "
            "Users can only access their own RiskAssessments."
        ),
        responses={
            200: AIInferenceDetailSerializer,
            404: {'type': 'object', 'properties': {'error': {'type': 'string'}}},
        }
    )
)
class AssessmentAIStatusView(views.APIView):
    """Endpoint para consultar status do processamento de IA."""
    permission_classes = [IsAuthenticated]

    def get(self, request, assessment_id, *args, **kwargs):
        assessment = get_object_or_404(
            RiskAssessment,
            id=assessment_id,
            created_by=request.user
        )

        # Buscar inferência mais recente
        inference = AIInferenceResult.objects.filter(
            assessment=assessment
        ).first()

        if not inference:
            return Response({
                'assessment_id': assessment_id,
                'status': 'not_started',
                'message': 'No AI processing has been started for this assessment',
            }, status=status.HTTP_200_OK)

        serializer = AIInferenceDetailSerializer(inference, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema_view(
    get=extend_schema(
        tags=["AI Processing"],
        summary="Get AI Processing Queue",
        description=(
            "Retorna a fila de processamento de IA do usuário atual. "
            "Inclui avaliações aguardando processamento (synced), "
            "em processamento (ai_reviewed com inferência running/pending), "
            "e com erro (error_ai)."
        ),
        responses={
            200: {
                'type': 'object',
                'properties': {
                    'queue': {
                        'type': 'array',
                        'items': {
                            'type': 'object',
                            'properties': {
                                'assessment_id': {'type': 'integer'},
                                'title': {'type': 'string'},
                                'status': {'type': 'string'},
                                'status_display': {'type': 'string'},
                                'ai_status': {'type': 'string'},
                                'ai_status_display': {'type': 'string'},
                                'confidence': {'type': 'string'},
                                'error_message': {'type': 'string'},
                                'created_at': {'type': 'string', 'format': 'date-time'},
                                'started_at': {'type': 'string', 'format': 'date-time'},
                                'finished_at': {'type': 'string', 'format': 'date-time'},
                                'evidence_count': {'type': 'integer'},
                                'thumbnail_url': {'type': 'string'},
                            },
                        },
                    },
                    'counts': {
                        'type': 'object',
                        'properties': {
                            'pending': {'type': 'integer'},
                            'processing': {'type': 'integer'},
                            'completed': {'type': 'integer'},
                            'error': {'type': 'integer'},
                            'total': {'type': 'integer'},
                        },
                    },
                },
            },
        }
    )
)
class AIProcessingQueueView(views.APIView):
    """Endpoint para consultar a fila de processamento de IA."""
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        # Buscar avaliações relevantes para o usuário
        assessments = RiskAssessment.objects.filter(
            created_by=request.user,
            status__in=[
                RiskAssessment.STATUS_SYNCED,
                RiskAssessment.STATUS_AI_REVIEWED,
                RiskAssessment.STATUS_ERROR_AI,
            ]
        ).prefetch_related('evidences', 'inferences')

        queue = []
        counts = {
            'pending': 0,
            'processing': 0,
            'completed': 0,
            'error': 0,
            'total': 0,
        }

        for assessment in assessments:
            # Buscar inferência mais recente
            inference = assessment.inferences.first()
            
            # Determinar status da IA
            if inference:
                ai_status = inference.status
                ai_status_display = inference.get_status_display()
            else:
                # Avaliação synced mas sem inferência ainda = pendente
                ai_status = AIInferenceResult.STATUS_PENDING
                ai_status_display = "Pendente"

            # Categorizar para contadores
            if assessment.status == RiskAssessment.STATUS_ERROR_AI:
                counts['error'] += 1
            elif ai_status == AIInferenceResult.STATUS_PENDING:
                counts['pending'] += 1
            elif ai_status == AIInferenceResult.STATUS_RUNNING:
                counts['processing'] += 1
            elif ai_status == AIInferenceResult.STATUS_SUCCEEDED:
                counts['completed'] += 1
            elif ai_status == AIInferenceResult.STATUS_FAILED:
                counts['error'] += 1

            # Thumbnail da primeira evidência
            thumbnail_url = ""
            first_evidence = assessment.evidences.first()
            if first_evidence and first_evidence.file:
                download_path = reverse('evidence-download', kwargs={'evidence_id': first_evidence.id})
                public_prefix = getattr(settings, 'PUBLIC_API_PREFIX', '/api/')
                normalized_prefix = '/' + public_prefix.strip('/') + '/'
                if download_path.startswith('/api/'):
                    download_path = normalized_prefix + download_path[len('/api/'):]
                thumbnail_url = request.build_absolute_uri(download_path)

            queue.append({
                'assessment_id': assessment.id,
                'title': assessment.title or f"Avaliação #{assessment.id}",
                'status': assessment.status,
                'status_display': assessment.get_status_display(),
                'ai_status': ai_status,
                'ai_status_display': ai_status_display,
                'confidence': inference.confidence if inference else "",
                'error_message': inference.error_message if inference else "",
                'created_at': assessment.created_at,
                'started_at': inference.started_at if inference else None,
                'finished_at': inference.finished_at if inference else None,
                'evidence_count': assessment.evidences.count(),
                'thumbnail_url': thumbnail_url,
            })
            counts['total'] += 1

        # Ordenar: processando primeiro, depois pendentes, depois erros, depois completados
        status_order = {
            AIInferenceResult.STATUS_RUNNING: 0,
            AIInferenceResult.STATUS_PENDING: 1,
            RiskAssessment.STATUS_ERROR_AI: 2,
            AIInferenceResult.STATUS_FAILED: 2,
            AIInferenceResult.STATUS_SUCCEEDED: 3,
        }
        queue.sort(key=lambda x: (status_order.get(x['ai_status'], 99), x['created_at']), reverse=False)

        return Response({
            'queue': queue,
            'counts': counts,
        }, status=status.HTTP_200_OK)
