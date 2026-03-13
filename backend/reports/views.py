"""
Views para geração e listagem de relatórios PDF.

Endpoints:
- GET /api/admin/reports/ - Lista relatórios (autenticado)
- POST /api/admin/assessments/{id}/generate-report/ - Gera relatório (admin)
"""
from django.shortcuts import get_object_or_404
from rest_framework import views, status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, extend_schema_view

from configurations.permissions import IsAdminOrReadOnly
from assessments.models import RiskAssessment

from .models import Report
from .serializers import ReportSerializer, ReportGenerateResponseSerializer
from .tasks import generate_report


@extend_schema_view(
    get=extend_schema(
        tags=["Reports"],
        summary="Listar Relatórios",
        description=(
            "Retorna a lista de todos os relatórios PDF gerados. "
            "Requer autenticação. Suporta filtros por assessment_id."
        ),
        responses={200: ReportSerializer(many=True)},
    )
)
class ReportListView(generics.ListAPIView):
    """
    GET /api/admin/reports/
    
    Lista todos os relatórios PDF.
    Permissão: autenticado (qualquer usuário logado).
    """
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Retorna relatórios, filtrados por assessment_id se fornecido."""
        queryset = Report.objects.select_related('assessment').all()
        
        # Filtro por assessment_id
        assessment_id = self.request.query_params.get('assessment_id')
        if assessment_id:
            queryset = queryset.filter(assessment_id=assessment_id)
        
        # Filtro por status
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
        
        return queryset.order_by('-created_at')


@extend_schema_view(
    post=extend_schema(
        tags=["Reports"],
        summary="Gerar Relatório PDF",
        description=(
            "Inicia a geração assíncrona de um relatório PDF para a avaliação especificada. "
            "Cria/atualiza um registro de relatório com status 'generating', "
            "enfileira a task Celery e retorna imediatamente. "
            "Requer permissão de administrador (is_staff ou is_superuser)."
        ),
        responses={
            202: ReportGenerateResponseSerializer,
            400: {'type': 'object', 'properties': {'error': {'type': 'string'}}},
            404: {'type': 'object', 'properties': {'error': {'type': 'string'}}},
            403: {'type': 'object', 'properties': {'error': {'type': 'string'}}},
        },
    )
)
class GenerateReportView(views.APIView):
    """
    POST /api/admin/assessments/{id}/generate-report/
    
    Inicia geração de relatório PDF para uma avaliação.
    Permissão: admin (is_staff ou is_superuser).
    """
    permission_classes = [IsAdminOrReadOnly]
    
    def post(self, request, assessment_id, *args, **kwargs):
        # Verificar se a avaliação existe
        assessment = get_object_or_404(RiskAssessment, id=assessment_id)
        
        # Verificar se já existe um relatório em geração para esta avaliação
        existing_generating = Report.objects.filter(
            assessment=assessment,
            status=Report.STATUS_GENERATING
        ).first()
        
        if existing_generating:
            return Response({
                'message': 'Report generation already in progress',
                'report_id': existing_generating.id,
                'task_id': None,
                'status': 'generating',
            }, status=status.HTTP_202_ACCEPTED)
        
        # Criar novo registro de relatório
        report = Report.objects.create(
            assessment=assessment,
            status=Report.STATUS_GENERATING,
        )
        
        # Enfileirar task Celery
        task = generate_report.delay(report.id)
        
        return Response({
            'message': 'Report generation queued successfully',
            'report_id': report.id,
            'task_id': task.id,
            'status': 'generating',
        }, status=status.HTTP_202_ACCEPTED)


@extend_schema_view(
    get=extend_schema(
        tags=["Reports"],
        summary="Obter Relatório",
        description="Retorna detalhes de um relatório específico.",
        responses={
            200: ReportSerializer,
            404: {'type': 'object', 'properties': {'error': {'type': 'string'}}},
        },
    )
)
class ReportDetailView(generics.RetrieveAPIView):
    """
    GET /api/admin/reports/{id}/
    
    Retorna detalhes de um relatório específico.
    Permissão: autenticado.
    """
    queryset = Report.objects.select_related('assessment').all()
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated]
    lookup_url_kwarg = 'report_id'
    

@extend_schema_view(
    post=extend_schema(
        tags=["Reports"],
        summary="Regenerar Relatório",
        description=(
            "Força a regeneração de um relatório que falhou anteriormente. "
            "Cria um novo registro de relatório e inicia a geração. "
            "Requer permissão de administrador."
        ),
        responses={
            202: ReportGenerateResponseSerializer,
            400: {'type': 'object', 'properties': {'error': {'type': 'string'}}},
            404: {'type': 'object', 'properties': {'error': {'type': 'string'}}},
        },
    )
)
class RegenerateReportView(views.APIView):
    """
    POST /api/admin/assessments/{id}/regenerate-report/
    
    Regenera um relatório para uma avaliação.
    Permissão: admin.
    """
    permission_classes = [IsAdminOrReadOnly]
    
    def post(self, request, assessment_id, *args, **kwargs):
        assessment = get_object_or_404(RiskAssessment, id=assessment_id)
        
        # Criar novo registro de relatório (sempre cria novo, mesmo se houver um pronto)
        report = Report.objects.create(
            assessment=assessment,
            status=Report.STATUS_GENERATING,
        )
        
        # Enfileirar task Celery
        task = generate_report.delay(report.id)
        
        return Response({
            'message': 'Report regeneration queued successfully',
            'report_id': report.id,
            'task_id': task.id,
            'status': 'generating',
        }, status=status.HTTP_202_ACCEPTED)
