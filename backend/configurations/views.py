"""
Views para configurações administrativas.

Endpoints:
- /api/admin/assessment-types/ (F16.1)
- /api/admin/environment-types/ (F16.2)
- /api/admin/risk-types/ (F16.3)
- /api/admin/ai-thresholds/ (F16.6)
- /api/admin/audit-logs/
"""
from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, extend_schema_view

from .models import AssessmentType, EnvironmentType, RiskType, AIThreshold, AuditLog
from .serializers import (
    AssessmentTypeSerializer,
    EnvironmentTypeSerializer,
    RiskTypeSerializer,
    AIThresholdSerializer,
    AIThresholdUpdateSerializer,
    AuditLogSerializer,
    AuditLogListSerializer,
)
from .permissions import IsAdminOrReadOnly


class BaseConfigViewSet(viewsets.ModelViewSet):
    """ViewSet base para entidades de configuração."""
    
    permission_classes = [IsAdminOrReadOnly]
    
    def get_queryset(self):
        """Retorna apenas entidades ativas por padrão, ou todas se especificado."""
        queryset = self.queryset
        include_inactive = self.request.query_params.get('include_inactive', 'false').lower() == 'true'
        if not include_inactive:
            queryset = queryset.filter(active=True)
        return queryset
    
    def perform_create(self, serializer):
        """Define o usuário atual como criador e registra no log de auditoria."""
        instance = serializer.save(created_by=self.request.user)
        
        # Registrar no log de auditoria
        AuditLog.objects.create(
            entity_type=self.audit_entity_type,
            entity_id=instance.id,
            action=AuditLog.ACTION_CREATE,
            new_value=self.get_serializer(instance).data,
            performed_by=self.request.user,
            ip_address=self.get_client_ip(),
            user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
        )
        
        return instance
    
    def perform_update(self, serializer):
        """Registra alteração no log de auditoria."""
        instance = self.get_object()
        old_data = self.get_serializer(instance).data
        
        serializer.save()
        
        new_instance = self.get_object()
        new_data = self.get_serializer(new_instance).data
        
        # Registrar no log de auditoria
        AuditLog.objects.create(
            entity_type=self.audit_entity_type,
            entity_id=instance.id,
            action=AuditLog.ACTION_UPDATE,
            previous_value=old_data,
            new_value=new_data,
            performed_by=self.request.user,
            ip_address=self.get_client_ip(),
            user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
        )
    
    def perform_destroy(self, instance):
        """Registra exclusão no log de auditoria."""
        old_data = self.get_serializer(instance).data
        
        AuditLog.objects.create(
            entity_type=self.audit_entity_type,
            entity_id=instance.id,
            action=AuditLog.ACTION_DELETE,
            previous_value=old_data,
            new_value={},
            performed_by=self.request.user,
            ip_address=self.get_client_ip(),
            user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
        )
        
        instance.delete()
    
    def get_client_ip(self):
        """Obtém o IP do cliente."""
        x_forwarded_for = self.request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = self.request.META.get('REMOTE_ADDR')
        return ip
    
    @extend_schema(
        summary="Desativar",
        description="Desativa a entidade (soft delete)."
    )
    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Desativa a entidade ao invés de excluí-la."""
        instance = self.get_object()
        old_data = self.get_serializer(instance).data
        
        instance.active = False
        instance.save()
        
        # Registrar no log de auditoria
        AuditLog.objects.create(
            entity_type=self.audit_entity_type,
            entity_id=instance.id,
            action=AuditLog.ACTION_DEACTIVATE,
            previous_value=old_data,
            new_value=self.get_serializer(instance).data,
            performed_by=request.user,
            ip_address=self.get_client_ip(),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
        )
        
        return Response(
            {'message': f'{self.audit_entity_type} desativado com sucesso.'},
            status=status.HTTP_200_OK
        )
    
    @extend_schema(
        summary="Ativar",
        description="Ativa uma entidade previamente desativada."
    )
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Ativa a entidade."""
        instance = self.get_object()
        old_data = self.get_serializer(instance).data
        
        instance.active = True
        instance.save()
        
        # Registrar no log de auditoria
        AuditLog.objects.create(
            entity_type=self.audit_entity_type,
            entity_id=instance.id,
            action=AuditLog.ACTION_ACTIVATE,
            previous_value=old_data,
            new_value=self.get_serializer(instance).data,
            performed_by=request.user,
            ip_address=self.get_client_ip(),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
        )
        
        return Response(
            {'message': f'{self.audit_entity_type} ativado com sucesso.'},
            status=status.HTTP_200_OK
        )


@extend_schema_view(
    list=extend_schema(
        tags=["Configurações - Tipos de Avaliação"],
        summary="Listar tipos de avaliação",
        description="Retorna lista de tipos de avaliação. Por padrão, retorna apenas ativos. Use ?include_inactive=true para ver todos."
    ),
    create=extend_schema(
        tags=["Configurações - Tipos de Avaliação"],
        summary="Criar tipo de avaliação",
        description="Cria um novo tipo de avaliação."
    ),
    retrieve=extend_schema(
        tags=["Configurações - Tipos de Avaliação"],
        summary="Obter tipo de avaliação",
        description="Retorna detalhes de um tipo de avaliação específico."
    ),
    update=extend_schema(
        tags=["Configurações - Tipos de Avaliação"],
        summary="Atualizar tipo de avaliação",
        description="Atualiza completamente um tipo de avaliação."
    ),
    partial_update=extend_schema(
        tags=["Configurações - Tipos de Avaliação"],
        summary="Atualizar parcialmente",
        description="Atualiza parcialmente um tipo de avaliação."
    ),
    destroy=extend_schema(
        tags=["Configurações - Tipos de Avaliação"],
        summary="Excluir tipo de avaliação",
        description="Exclui permanentemente um tipo de avaliação."
    ),
)
class AssessmentTypeViewSet(BaseConfigViewSet):
    """F16.1 — ViewSet para gerenciamento de tipos de avaliação."""
    
    queryset = AssessmentType.objects.all()
    serializer_class = AssessmentTypeSerializer
    audit_entity_type = "AssessmentType"


@extend_schema_view(
    list=extend_schema(
        tags=["Configurações - Tipos de Ambiente"],
        summary="Listar tipos de ambiente",
        description="Retorna lista de tipos de ambiente. Por padrão, retorna apenas ativos. Use ?include_inactive=true para ver todos."
    ),
    create=extend_schema(
        tags=["Configurações - Tipos de Ambiente"],
        summary="Criar tipo de ambiente",
        description="Cria um novo tipo de ambiente."
    ),
    retrieve=extend_schema(
        tags=["Configurações - Tipos de Ambiente"],
        summary="Obter tipo de ambiente",
        description="Retorna detalhes de um tipo de ambiente específico."
    ),
    update=extend_schema(
        tags=["Configurações - Tipos de Ambiente"],
        summary="Atualizar tipo de ambiente",
        description="Atualiza completamente um tipo de ambiente."
    ),
    partial_update=extend_schema(
        tags=["Configurações - Tipos de Ambiente"],
        summary="Atualizar parcialmente",
        description="Atualiza parcialmente um tipo de ambiente."
    ),
    destroy=extend_schema(
        tags=["Configurações - Tipos de Ambiente"],
        summary="Excluir tipo de ambiente",
        description="Exclui permanentemente um tipo de ambiente."
    ),
)
class EnvironmentTypeViewSet(BaseConfigViewSet):
    """F16.2 — ViewSet para gerenciamento de tipos de ambiente."""
    
    queryset = EnvironmentType.objects.all()
    serializer_class = EnvironmentTypeSerializer
    audit_entity_type = "EnvironmentType"


@extend_schema_view(
    list=extend_schema(
        tags=["Configurações - Tipos de Risco"],
        summary="Listar tipos de risco",
        description="Retorna lista de tipos de risco. Por padrão, retorna apenas ativos. Use ?include_inactive=true para ver todos."
    ),
    create=extend_schema(
        tags=["Configurações - Tipos de Risco"],
        summary="Criar tipo de risco",
        description="Cria um novo tipo de risco."
    ),
    retrieve=extend_schema(
        tags=["Configurações - Tipos de Risco"],
        summary="Obter tipo de risco",
        description="Retorna detalhes de um tipo de risco específico."
    ),
    update=extend_schema(
        tags=["Configurações - Tipos de Risco"],
        summary="Atualizar tipo de risco",
        description="Atualiza completamente um tipo de risco."
    ),
    partial_update=extend_schema(
        tags=["Configurações - Tipos de Risco"],
        summary="Atualizar parcialmente",
        description="Atualiza parcialmente um tipo de risco."
    ),
    destroy=extend_schema(
        tags=["Configurações - Tipos de Risco"],
        summary="Excluir tipo de risco",
        description="Exclui permanentemente um tipo de risco."
    ),
)
class RiskTypeViewSet(BaseConfigViewSet):
    """F16.3 — ViewSet para gerenciamento de tipos de risco."""
    
    queryset = RiskType.objects.all()
    serializer_class = RiskTypeSerializer
    audit_entity_type = "RiskType"


@extend_schema_view(
    list=extend_schema(
        tags=["Configurações - IA"],
        summary="Listar thresholds da IA",
        description="Retorna lista de thresholds configurados para a IA."
    ),
    retrieve=extend_schema(
        tags=["Configurações - IA"],
        summary="Obter threshold",
        description="Retorna detalhes de um threshold específico."
    ),
)
class AIThresholdViewSet(viewsets.ReadOnlyModelViewSet):
    """F16.6 — ViewSet para consulta de thresholds da IA."""
    
    queryset = AIThreshold.objects.all()
    serializer_class = AIThresholdSerializer
    permission_classes = [IsAdminOrReadOnly]
    
    @extend_schema(
        tags=["Configurações - IA"],
        summary="Atualizar threshold de confiança",
        description="Atualiza o valor do threshold de confiança da IA. Requer permissão de administrador. Alterações são registradas no log de auditoria.",
        request=AIThresholdUpdateSerializer,
        responses={200: AIThresholdSerializer}
    )
    @action(detail=False, methods=['put'], url_path='confidence')
    def update_confidence(self, request):
        """Atualiza o threshold de confiança."""
        serializer = AIThresholdUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        threshold, created = AIThreshold.objects.get_or_create(
            threshold_type=AIThreshold.THRESHOLD_TYPE_CONFIDENCE,
            defaults={
                'threshold_value': 60.00,
                'description': 'Limiar mínimo de confiança para classificações automáticas da IA'
            }
        )
        
        old_data = AIThresholdSerializer(threshold).data
        
        # Atualizar
        new_value = serializer.validated_data['threshold_value']
        threshold.threshold_value = new_value
        threshold.updated_by = request.user
        threshold.save()
        
        # Registrar no log de auditoria
        new_data = AIThresholdSerializer(threshold).data
        AuditLog.objects.create(
            entity_type="AIThreshold",
            entity_id=threshold.id,
            action=AuditLog.ACTION_UPDATE,
            previous_value=old_data,
            new_value=new_data,
            performed_by=request.user,
            ip_address=self.get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
        )
        
        return Response(
            AIThresholdSerializer(threshold).data,
            status=status.HTTP_200_OK
        )
    
    @extend_schema(
        tags=["Configurações - IA"],
        summary="Obter threshold de confiança atual",
        description="Retorna o valor atual do threshold de confiança."
    )
    @action(detail=False, methods=['get'], url_path='confidence/current')
    def get_current_confidence(self, request):
        """Retorna o threshold de confiança atual."""
        threshold, created = AIThreshold.objects.get_or_create(
            threshold_type=AIThreshold.THRESHOLD_TYPE_CONFIDENCE,
            defaults={
                'threshold_value': 60.00,
                'description': 'Limiar mínimo de confiança para classificações automáticas da IA'
            }
        )
        
        return Response(
            AIThresholdSerializer(threshold).data,
            status=status.HTTP_200_OK
        )
    
    def get_client_ip(self, request):
        """Obtém o IP do cliente."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


@extend_schema_view(
    list=extend_schema(
        tags=["Configurações - Auditoria"],
        summary="Listar logs de auditoria",
        description="Retorna lista de logs de auditoria. Pode ser filtrado por entity_type, action e data."
    ),
    retrieve=extend_schema(
        tags=["Configurações - Auditoria"],
        summary="Obter log de auditoria",
        description="Retorna detalhes de um log específico."
    ),
)
class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para consulta de logs de auditoria."""
    
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminOrReadOnly]
    
    def get_queryset(self):
        """Permite filtrar por entity_type e action."""
        queryset = AuditLog.objects.all()
        
        entity_type = self.request.query_params.get('entity_type')
        action = self.request.query_params.get('action')
        
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)
        if action:
            queryset = queryset.filter(action=action)
            
        return queryset
    
    def get_serializer_class(self):
        """Usa serializer simplificado para listagem."""
        if self.action == 'list':
            return AuditLogListSerializer
        return AuditLogSerializer
