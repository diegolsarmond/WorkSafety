"""
Modelos de configuração do sistema (F16.1, F16.2, F16.3, F16.6).

- AssessmentType: Tipos de avaliação
- EnvironmentType: Tipos de ambiente
- RiskType: Tipos de risco
- AIThreshold: Thresholds da IA
- AuditLog: Log de auditoria para alterações em configurações
"""
from django.db import models
from django.conf import settings


class BaseConfigModel(models.Model):
    """Modelo base para entidades de configuração com campos comuns."""
    
    name = models.CharField("nome", max_length=100)
    description = models.TextField("descrição", blank=True)
    active = models.BooleanField("ativo", default=True)
    created_at = models.DateTimeField("criado em", auto_now_add=True)
    updated_at = models.DateTimeField("atualizado em", auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(class)s_created",
        verbose_name="criado por",
    )
    
    class Meta:
        abstract = True
        ordering = ["name"]
        
    def __str__(self):
        return self.name


class AssessmentType(BaseConfigModel):
    """F16.1 — Tipos de avaliação (ex: Inspeção, Auditoria, Verificação)."""
    
    class Meta:
        verbose_name = "tipo de avaliação"
        verbose_name_plural = "tipos de avaliação"
        db_table = "config_assessment_types"


class EnvironmentType(BaseConfigModel):
    """F16.2 — Tipos de ambiente (ex: Canteiro, Mina, Fábrica)."""
    
    class Meta:
        verbose_name = "tipo de ambiente"
        verbose_name_plural = "tipos de ambiente"
        db_table = "config_environment_types"


class RiskType(BaseConfigModel):
    """F16.3 — Tipos de risco (ex: Queda, Choque Elétrico, Incêndio)."""
    
    class Meta:
        verbose_name = "tipo de risco"
        verbose_name_plural = "tipos de risco"
        db_table = "config_risk_types"


class AIThreshold(models.Model):
    """F16.6 — Thresholds da IA para classificações automáticas."""
    
    THRESHOLD_TYPE_CONFIDENCE = "confidence"
    THRESHOLD_TYPE_SEVERITY = "severity"
    
    THRESHOLD_TYPE_CHOICES = [
        (THRESHOLD_TYPE_CONFIDENCE, "Confiança Mínima"),
        (THRESHOLD_TYPE_SEVERITY, "Severidade Mínima"),
    ]
    
    threshold_type = models.CharField(
        "tipo de threshold",
        max_length=20,
        choices=THRESHOLD_TYPE_CHOICES,
        default=THRESHOLD_TYPE_CONFIDENCE,
        unique=True,
    )
    threshold_value = models.DecimalField(
        "valor do threshold",
        max_digits=5,
        decimal_places=2,
        default=60.00,
        help_text="Valor em porcentagem (0-100)",
    )
    description = models.TextField(
        "descrição",
        blank=True,
        help_text="Descrição do propósito deste threshold",
    )
    created_at = models.DateTimeField("criado em", auto_now_add=True)
    updated_at = models.DateTimeField("atualizado em", auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_threshold_updates",
        verbose_name="atualizado por",
    )
    
    class Meta:
        verbose_name = "threshold da IA"
        verbose_name_plural = "thresholds da IA"
        db_table = "config_ai_thresholds"
        ordering = ["threshold_type"]
        
    def __str__(self):
        return f"{self.get_threshold_type_display()}: {self.threshold_value}%"
    
    def save(self, *args, **kwargs):
        """Garante que o valor esteja entre 0 e 100."""
        if self.threshold_value is not None:
            self.threshold_value = max(0, min(100, self.threshold_value))
        super().save(*args, **kwargs)


class AuditLog(models.Model):
    """Log de auditoria para alterações em configurações (F16.6)."""
    
    ACTION_CREATE = "create"
    ACTION_UPDATE = "update"
    ACTION_DELETE = "delete"
    ACTION_DEACTIVATE = "deactivate"
    ACTION_ACTIVATE = "activate"
    
    ACTION_CHOICES = [
        (ACTION_CREATE, "Criação"),
        (ACTION_UPDATE, "Atualização"),
        (ACTION_DELETE, "Exclusão"),
        (ACTION_DEACTIVATE, "Desativação"),
        (ACTION_ACTIVATE, "Ativação"),
    ]
    
    entity_type = models.CharField("tipo de entidade", max_length=50)
    entity_id = models.IntegerField("ID da entidade", null=True, blank=True)
    action = models.CharField("ação", max_length=20, choices=ACTION_CHOICES)
    previous_value = models.JSONField("valor anterior", default=dict, blank=True)
    new_value = models.JSONField("novo valor", default=dict, blank=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="audit_logs",
        verbose_name="executado por",
    )
    timestamp = models.DateTimeField("timestamp", auto_now_add=True)
    ip_address = models.GenericIPAddressField("endereço IP", null=True, blank=True)
    user_agent = models.TextField("user agent", blank=True)
    
    class Meta:
        verbose_name = "log de auditoria"
        verbose_name_plural = "logs de auditoria"
        db_table = "config_audit_logs"
        ordering = ["-timestamp"]
        
    def __str__(self):
        return f"{self.get_action_display()} em {self.entity_type} ({self.timestamp})"
