"""
Modelos para geração de relatórios PDF (F3.1).

Um Report representa um relatório PDF gerado a partir de uma avaliação de risco.
O status indica se o relatório está sendo gerado, pronto ou falhou.
"""
from django.db import models
from django.conf import settings


class Report(models.Model):
    """F3.1 — Relatório PDF de avaliação de risco."""

    # Status choices
    STATUS_GENERATING = "generating"
    STATUS_READY = "ready"
    STATUS_FAILED = "failed"

    STATUS_CHOICES = [
        (STATUS_GENERATING, "Gerando"),
        (STATUS_READY, "Pronto"),
        (STATUS_FAILED, "Falhou"),
    ]

    assessment = models.ForeignKey(
        "assessments.RiskAssessment",
        on_delete=models.CASCADE,
        related_name="reports",
        verbose_name="avaliação",
    )
    status = models.CharField(
        "status",
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_GENERATING,
    )
    file = models.FileField(
        "arquivo PDF",
        upload_to="reports/%Y/%m/",
        max_length=500,
        blank=True,
        null=True,
    )
    error_message = models.TextField("mensagem de erro", blank=True)
    generated_at = models.DateTimeField("gerado em", null=True, blank=True)
    generation_time_seconds = models.FloatField(
        "tempo de geração (segundos)",
        null=True,
        blank=True,
        help_text="Tempo total de geração do PDF em segundos",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "relatório"
        verbose_name_plural = "relatórios"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["assessment", "-created_at"]),
            models.Index(fields=["status", "-created_at"]),
        ]

    def __str__(self):
        return f"Relatório #{self.pk} (Avaliação {self.assessment_id}) - {self.get_status_display()}"

    @property
    def file_url(self):
        """Retorna a URL do arquivo se disponível."""
        if self.file:
            return self.file.url
        return None
