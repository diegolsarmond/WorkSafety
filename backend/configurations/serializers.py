"""
Serializers para os modelos de configuração.
"""
from rest_framework import serializers
from .models import AssessmentType, EnvironmentType, RiskType, AIThreshold, AuditLog


class AssessmentTypeSerializer(serializers.ModelSerializer):
    """Serializer para tipos de avaliação."""
    
    active = serializers.SerializerMethodField()
    
    class Meta:
        model = AssessmentType
        fields = ['id', 'name', 'description', 'active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
    
    def get_active(self, obj):
        """Retorna active como 0 ou 1 para compatibilidade com frontend."""
        return 1 if obj.active else 0


class EnvironmentTypeSerializer(serializers.ModelSerializer):
    """Serializer para tipos de ambiente."""
    
    active = serializers.SerializerMethodField()
    
    class Meta:
        model = EnvironmentType
        fields = ['id', 'name', 'description', 'active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
    
    def get_active(self, obj):
        """Retorna active como 0 ou 1 para compatibilidade com frontend."""
        return 1 if obj.active else 0


class RiskTypeSerializer(serializers.ModelSerializer):
    """Serializer para tipos de risco."""
    
    active = serializers.SerializerMethodField()
    
    class Meta:
        model = RiskType
        fields = ['id', 'name', 'description', 'active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
    
    def get_active(self, obj):
        """Retorna active como 0 ou 1 para compatibilidade com frontend."""
        return 1 if obj.active else 0


class AIThresholdSerializer(serializers.ModelSerializer):
    """Serializer para thresholds da IA."""
    
    threshold_type_display = serializers.CharField(
        source='get_threshold_type_display',
        read_only=True
    )
    updated_by_email = serializers.SerializerMethodField()
    
    class Meta:
        model = AIThreshold
        fields = [
            'id', 'threshold_type', 'threshold_type_display',
            'threshold_value', 'description',
            'created_at', 'updated_at', 'updated_by', 'updated_by_email'
        ]
        read_only_fields = ['created_at', 'updated_at', 'updated_by']
    
    def get_updated_by_email(self, obj):
        """Retorna o email do usuário que atualizou."""
        if obj.updated_by:
            return obj.updated_by.email
        return None
    
    def validate_threshold_value(self, value):
        """Valida que o valor está entre 0 e 100."""
        if value < 0 or value > 100:
            raise serializers.ValidationError(
                "O valor do threshold deve estar entre 0 e 100."
            )
        return value


class AIThresholdUpdateSerializer(serializers.Serializer):
    """Serializer para atualização de threshold."""
    
    threshold_value = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        min_value=0,
        max_value=100,
        help_text="Novo valor do threshold em porcentagem (0-100)"
    )


class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer para logs de auditoria."""
    
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    performed_by_email = serializers.SerializerMethodField()
    
    class Meta:
        model = AuditLog
        fields = [
            'id', 'entity_type', 'entity_id', 'action', 'action_display',
            'previous_value', 'new_value', 'performed_by', 'performed_by_email',
            'timestamp', 'ip_address'
        ]
        read_only_fields = ['timestamp']
    
    def get_performed_by_email(self, obj):
        """Retorna o email do usuário que executou a ação."""
        if obj.performed_by:
            return obj.performed_by.email
        return None


class AuditLogListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listagem de logs de auditoria."""
    
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    performed_by_email = serializers.SerializerMethodField()
    
    class Meta:
        model = AuditLog
        fields = [
            'id', 'entity_type', 'action', 'action_display',
            'performed_by_email', 'timestamp'
        ]
    
    def get_performed_by_email(self, obj):
        if obj.performed_by:
            return obj.performed_by.email
        return None
