"""
Views administrativas para fila de processamento de IA.

Endpoints:
- GET /api/admin/processing-jobs/ - Lista jobs de processamento
- GET /api/admin/processing-jobs/?status=failed - Filtra por status
- POST /api/admin/processing-jobs/{id}/reprocess/ - Reprocessa job falho

Compatível com WorkSafetyWeb/src/pages/ProcessingQueue.tsx
"""
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, extend_schema_view

from configurations.permissions import IsAdminOrReadOnly

from .models import AIInferenceResult, RiskAssessment
from .tasks import reprocess_assessment
from .services import AssessmentLifecycleService


class ProcessingJobSerializer(serializers.ModelSerializer):
    """Serializer para jobs de processamento (AIInferenceResult)."""
    
    assessment_id = serializers.IntegerField(source='assessment.id', read_only=True)
    status = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    error_message = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(source='assessment.updated_at', read_only=True)
    started_at = serializers.DateTimeField(read_only=True)
    finished_at = serializers.DateTimeField(read_only=True)
    assessment_title = serializers.CharField(source='assessment.title', read_only=True)
    
    class Meta:
        model = AIInferenceResult
        fields = [
            'id', 'assessment_id', 'assessment_title', 'status', 'status_display',
            'error_message', 'created_at', 'updated_at', 'started_at', 'finished_at',
            'confidence', 'model_version'
        ]


class ProcessingJobReprocessSerializer(serializers.Serializer):
    """Serializer para resposta de reprocessamento."""
    message = serializers.CharField()
    task_id = serializers.CharField(required=False, allow_null=True)
    previous_status = serializers.CharField()
    status = serializers.CharField()


@extend_schema_view(
    list=extend_schema(
        tags=["Admin - Fila de Processamento"],
        summary="Listar jobs de processamento",
        description=(
            "Retorna lista de jobs de processamento de IA. "
            "Use ?status=failed para filtrar por status específico."
        ),
    ),
    retrieve=extend_schema(
        tags=["Admin - Fila de Processamento"],
        summary="Obter detalhes de um job",
        description="Retorna detalhes de um job de processamento específico.",
    ),
)
class ProcessingJobViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para gerenciamento administrativo da fila de processamento de IA.
    
    Mapeia AIInferenceResult para uma interface de "jobs" compatível com
    o WorkSafetyWeb ProcessingQueue.
    """
    
    queryset = AIInferenceResult.objects.select_related('assessment').all()
    serializer_class = ProcessingJobSerializer
    permission_classes = [IsAdminOrReadOnly]
    
    def get_queryset(self):
        """Permite filtrar por status via querystring."""
        queryset = super().get_queryset()
        
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter.lower())
        
        return queryset.order_by('-created_at')
    
    @extend_schema(
        tags=["Admin - Fila de Processamento"],
        summary="Reprocessar job falho",
        description=(
            "Reprocessa um job que está em estado 'failed'. "
            "Dispara a task Celery de reprocessamento e atualiza o status. "
            "Requer permissão de administrador."
        ),
        responses={
            202: ProcessingJobReprocessSerializer,
            400: {'type': 'object', 'properties': {'error': {'type': 'string'}}},
            404: {'type': 'object', 'properties': {'error': {'type': 'string'}}},
        }
    )
    @action(detail=True, methods=['post'], url_path='reprocess')
    def reprocess(self, request, pk=None):
        """
        Reprocessa um job de IA que falhou.
        
        - Verifica se o job está em estado 'failed'
        - Transiciona a avaliação para SYNCED
        - Enfileira nova task de processamento
        """
        inference = get_object_or_404(AIInferenceResult, pk=pk)
        assessment = inference.assessment
        
        # Verificar se o job está em estado que permite reprocessamento
        if inference.status != AIInferenceResult.STATUS_FAILED:
            return Response(
                {
                    'error': (
                        f"Cannot reprocess job with status '{inference.status}'. "
                        f"Only jobs with 'failed' status can be reprocessed."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verificar se a avaliação está em estado de erro
        if assessment.status != RiskAssessment.STATUS_ERROR_AI:
            return Response(
                {
                    'error': (
                        f"Assessment is not in error state. "
                        f"Current status: '{assessment.status}'"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        previous_inference_status = inference.status
        previous_assessment_status = assessment.status
        
        try:
            # Resetar o status da inferência para pending
            inference.status = AIInferenceResult.STATUS_PENDING
            inference.error_message = ""
            inference.started_at = None
            inference.finished_at = None
            inference.save()
            
            # Usar service para transicionar a avaliação
            AssessmentLifecycleService.reprocess_ai(
                assessment,
                actor=request.user,
                reason="Reprocessamento solicitado via admin"
            )
            
            # Enfileirar reprocessamento
            task = reprocess_assessment.delay(assessment.id)
            
            return Response({
                'message': 'Job reprocessing queued successfully',
                'task_id': task.id,
                'previous_status': previous_inference_status,
                'status': 'queued',
            }, status=status.HTTP_202_ACCEPTED)
            
        except Exception as e:
            return Response(
                {'error': f"Failed to reprocess job: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
