"""
Modelos F12.1–F12.5: avaliação de risco, evidências, achados, inferências IA e validação humana.

Schema: RiskAssessment é a entidade central; Evidence, RiskFinding e AIInferenceResult
pertencem a uma avaliação; HumanValidationDecision pertence a uma inferência e a um usuário validador.
Auditoria via created_at/updated_at e FKs (created_by, validator).
"""
import hashlib
from django.db import models
from django.conf import settings


class RiskAssessment(models.Model):
    """F12.1 — Avaliação de risco com ciclo de vida completo (Sprint 3)."""

    # Estados do ciclo de vida
    STATUS_DRAFT = "draft"
    STATUS_CAPTURED = "captured"
    STATUS_SYNCED = "synced"
    STATUS_AI_REVIEWED = "ai_reviewed"
    STATUS_HUMAN_VALIDATED = "human_validated"
    STATUS_FINALIZED = "finalized"
    STATUS_ERROR = "error"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "Rascunho"),
        (STATUS_CAPTURED, "Capturado"),
        (STATUS_SYNCED, "Sincronizado"),
        (STATUS_AI_REVIEWED, "Revisado por IA"),
        (STATUS_HUMAN_VALIDATED, "Validado por Humano"),
        (STATUS_FINALIZED, "Finalizado"),
        (STATUS_ERROR, "Erro"),
    ]

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="risk_assessments",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
    )
    title = models.CharField("título", max_length=255, blank=True)
    description = models.TextField("descrição", blank=True)
    
    # Timestamps de cada marco do ciclo de vida
    captured_at = models.DateTimeField("capturado em", null=True, blank=True)
    synced_at = models.DateTimeField("sincronizado em", null=True, blank=True)
    ai_reviewed_at = models.DateTimeField("revisado por IA em", null=True, blank=True)
    human_validated_at = models.DateTimeField("validado por humano em", null=True, blank=True)
    finalized_at = models.DateTimeField("finalizado em", null=True, blank=True)
    
    # Metadados de transição
    status_changed_at = models.DateTimeField("última mudança de status em", null=True, blank=True)
    status_changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="status_changes",
    )
    status_change_reason = models.TextField("motivo da mudança", blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "avaliação de risco"
        verbose_name_plural = "avaliações de risco"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title or f"Avaliação #{self.pk}"


def evidence_upload_to(instance, filename):
    """Upload path: evidence/YYYY/MM/<assessment_id>_<filename>."""
    from django.utils import timezone
    now = timezone.now()
    return f"evidence/{now.year}/{now.month:02d}/{instance.assessment_id}_{filename}"


class Evidence(models.Model):
    """
    F12.2 — Evidência multimídia.
    file_hash, file_size e mime_type são preenchidos no backend ao salvar (não confiar no client).
    """

    assessment = models.ForeignKey(
        RiskAssessment,
        on_delete=models.CASCADE,
        related_name="evidences",
    )
    file = models.FileField(
        "arquivo",
        upload_to=evidence_upload_to,
        max_length=500,
    )
    file_hash = models.CharField("hash do arquivo", max_length=64, blank=True)
    file_size = models.BigIntegerField("tamanho em bytes", null=True, blank=True)
    mime_type = models.CharField("tipo MIME", max_length=255, blank=True)
    captured_at = models.DateTimeField(
        "timestamp de captura",
        null=True,
        blank=True,
        db_index=True,
        help_text="Timestamp informado pelo cliente (quando a foto foi tirada). Se não informado, permanece null.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "evidência"
        verbose_name_plural = "evidências"
        ordering = ["-created_at"]

    def __str__(self):
        return self.file.name or f"Evidência #{self.pk}"

    def _compute_file_metadata(self):
        """Preenche file_hash, file_size e mime_type a partir do arquivo (backend)."""
        if not self.file:
            return
        try:
            self.file.seek(0)
            content = self.file.read()
            self.file_size = len(content)
            self.file_hash = hashlib.sha256(content).hexdigest()
            # mime_type: usar guess do Django/pure content-type se disponível
            try:
                import mimetypes
                mime, _ = mimetypes.guess_type(self.file.name or "")
                self.mime_type = mime or ""
            except Exception:
                self.mime_type = ""
            self.file.seek(0)
        except Exception:
            pass

    def save(self, *args, **kwargs):
        # Só preenche metadata no backend na criação (arquivo recém-enviado)
        if self.file and not self.pk:
            self._compute_file_metadata()
        super().save(*args, **kwargs)


class RiskFinding(models.Model):
    """F12.3 — Risco identificado por avaliação."""

    assessment = models.ForeignKey(
        RiskAssessment,
        on_delete=models.CASCADE,
        related_name="findings",
    )
    description = models.TextField("descrição")
    severity = models.CharField("severidade", max_length=50, blank=True)
    location = models.CharField("localização", max_length=255, blank=True)
    evidence = models.ForeignKey(
        'Evidence',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="findings",
        verbose_name="evidência",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "achado de risco"
        verbose_name_plural = "achados de risco"
        ordering = ["-created_at"]

    def __str__(self):
        return (self.description[:50] + "...") if len(self.description) > 50 else self.description


class AIInferenceResult(models.Model):
    """F12.4 — Resultado das inferências da IA por avaliação."""

    # Status choices
    STATUS_PENDING = "pending"
    STATUS_RUNNING = "running"
    STATUS_SUCCEEDED = "succeeded"
    STATUS_FAILED = "failed"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pendente"),
        (STATUS_RUNNING, "Em execução"),
        (STATUS_SUCCEEDED, "Sucesso"),
        (STATUS_FAILED, "Falha"),
    ]

    assessment = models.ForeignKey(
        RiskAssessment,
        on_delete=models.CASCADE,
        related_name="inferences",
    )
    status = models.CharField(
        "status",
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
    )
    result_json = models.JSONField("resultado bruto", default=dict, blank=True)
    confidence = models.CharField("confiança", max_length=50, blank=True)
    error_message = models.TextField("mensagem de erro", blank=True)
    model_version = models.CharField("versão do modelo", max_length=100, blank=True)
    started_at = models.DateTimeField("iniciado em", null=True, blank=True)
    finished_at = models.DateTimeField("finalizado em", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "resultado de inferência IA"
        verbose_name_plural = "resultados de inferência IA"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Inferência #{self.pk} (avaliação {self.assessment_id}) - {self.get_status_display()}"


class HumanValidationDecision(models.Model):
    """F12.5 — Decisão de validação humana sobre uma inferência."""

    DECISION_CHOICES = [
        ("pending", "Pendente"),
        ("approved", "Aprovado"),
        ("rejected", "Rejeitado"),
    ]

    inference = models.ForeignKey(
        AIInferenceResult,
        on_delete=models.CASCADE,
        related_name="decisions",
    )
    validator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="validation_decisions",
    )
    decision = models.CharField(
        max_length=20,
        choices=DECISION_CHOICES,
        default="pending",
    )
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "decisão de validação humana"
        verbose_name_plural = "decisões de validação humana"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_decision_display()} (inferência {self.inference_id})"
