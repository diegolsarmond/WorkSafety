import hashlib
import json
from rest_framework import views, status, parsers
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.generics import ListCreateAPIView, RetrieveAPIView
from rest_framework.permissions import IsAuthenticated

from .models import RiskAssessment, Evidence, AIInferenceResult
from .serializers import (
    EvidenceUploadSerializer, 
    EvidenceSerializer, 
    RiskAssessmentSerializer,
    RiskAssessmentStatusSerializer,
    RiskAssessmentListSerializer,
    RiskAssessmentDetailSerializer,
    AIInferenceDetailSerializer,
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
            
            # Idempotency check: if evidence with this hash already exists for this assessment, return it instead of duplicating
            existing_evidence = Evidence.objects.filter(assessment=assessment, file_hash=file_hash).first()
            if existing_evidence:
                created_evidences.append(existing_evidence)
                continue
                
            # Create new evidence
            new_evidence = Evidence(
                assessment=assessment,
                file=image,
                captured_at=timestamp,  # Timestamp informado pelo cliente (ou None)
            )
            new_evidence.save()  # This triggers _compute_file_metadata and saves the hash
            created_evidences.append(new_evidence)
            
        result_serializer = EvidenceSerializer(created_evidences, many=True)
        return Response(result_serializer.data, status=status.HTTP_201_CREATED)


# =============================================================================
# Endpoints de Transição de Ciclo de Vida
# =============================================================================

class AssessmentTransitionBaseView(views.APIView):
    """Base class para views de transição de status.
    
    Users can only transition their own RiskAssessments.
    """
    permission_classes = [IsAuthenticated]
    transition_method = None
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
    Transiciona a avaliação para o estado CAPTURED.
    
    Pré-requisito: status deve ser DRAFT.
    Users can only transition their own RiskAssessments.
    """
    transition_method = 'capture'
    success_message = "Avaliação capturada com sucesso"


@extend_schema(tags=["Assessment Lifecycle"])
class AssessmentSyncView(AssessmentTransitionBaseView):
    """
    Transiciona a avaliação para o estado SYNCED.
    
    Pré-requisito: status deve ser CAPTURED.
    Users can only transition their own RiskAssessments.
    """
    transition_method = 'sync'
    success_message = "Avaliação sincronizada com sucesso"


@extend_schema(tags=["Assessment Lifecycle"])
class AssessmentMarkAIReviewedView(AssessmentTransitionBaseView):
    """
    Transiciona a avaliação para o estado AI_REVIEWED.
    
    Pré-requisito: status deve ser SYNCED.
    Users can only transition their own RiskAssessments.
    """
    transition_method = 'mark_ai_reviewed'
    success_message = "Avaliação revisada por IA com sucesso"


@extend_schema(tags=["Assessment Lifecycle"])
class AssessmentHumanValidateView(AssessmentTransitionBaseView):
    """
    Transiciona a avaliação para o estado HUMAN_VALIDATED.
    
    Pré-requisito: status deve ser AI_REVIEWED.
    Users can only transition their own RiskAssessments.
    """
    transition_method = 'human_validate'
    success_message = "Avaliação validada por humano com sucesso"


@extend_schema(tags=["Assessment Lifecycle"])
class AssessmentFinalizeView(AssessmentTransitionBaseView):
    """
    Transiciona a avaliação para o estado FINALIZED.
    
    Pré-requisito: status deve ser HUMAN_VALIDATED.
    Users can only transition their own RiskAssessments.
    """
    transition_method = 'finalize'
    success_message = "Avaliação finalizada com sucesso"


@extend_schema(tags=["Assessment Lifecycle"])
class AssessmentStatusHistoryView(views.APIView):
    """
    Retorna o histórico de status/marcos de uma avaliação.
    Users can only access history of their own RiskAssessments.
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
        history = AssessmentLifecycleService.get_status_history(assessment)
        return Response(history, status=status.HTTP_200_OK)


@extend_schema(tags=["Assessment Lifecycle"])
class AssessmentValidTransitionsView(views.APIView):
    """
    Retorna as transições válidas a partir do status atual.
    Users can only access transitions of their own RiskAssessments.
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
            "Disponível para avaliações com status SYNCED ou ERROR. "
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
    """
    Endpoint para forçar o processamento de IA de uma avaliação.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, assessment_id, *args, **kwargs):
        # Filter by created_by to ensure user can only access own assessments
        assessment = get_object_or_404(
            RiskAssessment,
            id=assessment_id,
            created_by=request.user
        )
        
        # Verificar se a avaliação pode ser processada
        if assessment.status not in [
            RiskAssessment.STATUS_SYNCED,
            RiskAssessment.STATUS_ERROR,
        ]:
            return Response(
                {
                    'error': f"Cannot process assessment with status '{assessment.status}'. "
                            f"Expected 'synced' or 'error'."
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
        summary="Reprocess Assessment",
        description=(
            "Reprocessa uma avaliação que falhou anteriormente (status=error). "
            "Reseta o status para SYNCED e enfileira novo processamento. "
            "Users can only reprocess their own RiskAssessments."
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
class AssessmentReprocessView(views.APIView):
    """
    Endpoint para reprocessar uma avaliação em estado de erro.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, assessment_id, *args, **kwargs):
        # Filter by created_by to ensure user can only access own assessments
        assessment = get_object_or_404(
            RiskAssessment,
            id=assessment_id,
            created_by=request.user
        )
        
        # Verificar se está em estado de erro
        if assessment.status != RiskAssessment.STATUS_ERROR:
            return Response(
                {
                    'error': f"Cannot reprocess assessment with status '{assessment.status}'. "
                            f"Only assessments with 'error' status can be reprocessed."
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Enfileirar reprocessamento
        task = reprocess_assessment.delay(assessment.id)
        
        return Response({
            'message': 'Assessment reprocessing queued successfully',
            'task_id': task.id,
            'status': 'queued',
        }, status=status.HTTP_202_ACCEPTED)


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
    """
    Endpoint para consultar status do processamento de IA.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, assessment_id, *args, **kwargs):
        # Filter by created_by to ensure user can only access own assessments
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
