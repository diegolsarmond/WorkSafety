"""
Modelos F12.1–F12.5: avaliação de risco, evidências, achados, inferências IA e validação humana.

Schema: RiskAssessment é a entidade central; Evidence, RiskFinding e AIInferenceResult
pertencem a uma avaliação; HumanValidationDecision pertence a uma inferência e a um usuário validador.
Auditoria via created_at/updated_at e FKs (created_by, validator).
"""
import hashlib
from django.db import models
from django.conf import settings


# Import circular handling via string reference in FK
ConfigurationAssessmentType = 'configurations.AssessmentType'
ConfigurationEnvironmentType = 'configurations.EnvironmentType'


class RiskAssessment(models.Model):
    """F12.1 — Avaliação de risco com ciclo de vida completo (Sprint 3)."""

    # Estados do ciclo de vida
    STATUS_DRAFT = "draft"
    STATUS_CAPTURED = "captured"
    STATUS_SYNCED = "synced"
    STATUS_AI_REVIEWED = "ai_reviewed"
    STATUS_HUMAN_VALIDATED = "human_validated"
    STATUS_FINALIZED = "finalized"
    STATUS_ERROR_AI = "error_ai"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "Rascunho"),
        (STATUS_CAPTURED, "Capturado"),
        (STATUS_SYNCED, "Sincronizado"),
        (STATUS_AI_REVIEWED, "Revisado por IA"),
        (STATUS_HUMAN_VALIDATED, "Validado por Humano"),
        (STATUS_FINALIZED, "Finalizado"),
        (STATUS_ERROR_AI, "Erro IA"),
    ]

    # LGPD/GDPR — Bases legais para processamento de dados pessoais
    LEGAL_BASIS_CONSENT = "consent"
    LEGAL_BASIS_LEGITIMATE_INTEREST = "legitimate_interest"
    LEGAL_BASIS_LEGAL_OBLIGATION = "legal_obligation"
    LEGAL_BASIS_CONTRACT = "contract"
    LEGAL_BASIS_PUBLIC_INTEREST = "public_interest"
    LEGAL_BASIS_VITAL_INTEREST = "vital_interest"

    LEGAL_BASIS_CHOICES = [
        (LEGAL_BASIS_CONSENT, "Consentimento do titular"),
        (LEGAL_BASIS_LEGITIMATE_INTEREST, "Interesse legítimo"),
        (LEGAL_BASIS_LEGAL_OBLIGATION, "Cumprimento de obrigação legal"),
        (LEGAL_BASIS_CONTRACT, "Execução de contrato"),
        (LEGAL_BASIS_PUBLIC_INTEREST, "Missão de interesse público"),
        (LEGAL_BASIS_VITAL_INTEREST, "Proteção da vida"),
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

    # F16.1 / F16.2 — Tipos de avaliação e ambiente
    assessment_type = models.ForeignKey(
        ConfigurationAssessmentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assessments",
        verbose_name="tipo de avaliação",
    )
    environment_type = models.ForeignKey(
        ConfigurationEnvironmentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assessments",
        verbose_name="tipo de ambiente",
    )

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

    # LGPD/GDPR — Base legal e justificativa
    legal_basis = models.CharField(
        "base legal LGPD",
        max_length=30,
        choices=LEGAL_BASIS_CHOICES,
        default=LEGAL_BASIS_LEGITIMATE_INTEREST,
        help_text="Base legal para processamento de dados pessoais conforme LGPD/GDPR",
    )
    legal_basis_notes = models.TextField(
        "notas da base legal",
        blank=True,
        help_text="Justificativa adicional para a base legal selecionada",
    )

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
    import os
    from django.utils import timezone
    now = timezone.now()
    # Garantir que apenas o nome do arquivo seja usado, não o path completo
    filename = os.path.basename(filename)
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

    # LGPD/GDPR — Controle de anonimização
    is_anonymized = models.BooleanField(
        "anonimizado",
        default=False,
        help_text="Indica se a evidência foi processada para remoção de dados pessoais",
    )
    anonymized_at = models.DateTimeField(
        "anonimizado em",
        null=True,
        blank=True,
    )
    anonymization_status = models.CharField(
        "status da anonimização",
        max_length=20,
        default="pending",
        choices=[
            ("pending", "Pendente"),
            ("processing", "Processando"),
            ("completed", "Concluído"),
            ("failed", "Falhou"),
            ("skipped", "Ignorado"),
        ],
        help_text="Estado atual do processo de anonimização",
    )
    original_file_hash = models.CharField(
        "hash do arquivo original",
        max_length=64,
        blank=True,
        help_text="SHA-256 do arquivo original antes da anonimização (para auditoria)",
    )

    def save(self, *args, **kwargs):
        # Só preenche metadata no backend na criação (arquivo recém-enviado)
        if self.file and not self.pk:
            self._compute_file_metadata()
        super().save(*args, **kwargs)


class EvidenceAnonymizationLog(models.Model):
    """
    LGPD/GDPR — Log de auditoria para processo de anonimização.
    
    Mantém registro completo de todas as operações de anonimização
    para fins de compliance e auditoria.
    """

    OPERATION_ANONYMIZE = "anonymize"
    OPERATION_RESTORE = "restore"
    OPERATION_VERIFY = "verify"

    OPERATION_CHOICES = [
        (OPERATION_ANONYMIZE, "Anonimização"),
        (OPERATION_RESTORE, "Restauração"),
        (OPERATION_VERIFY, "Verificação"),
    ]

    STATUS_SUCCESS = "success"
    STATUS_FAILED = "failed"
    STATUS_PARTIAL = "partial"

    STATUS_CHOICES = [
        (STATUS_SUCCESS, "Sucesso"),
        (STATUS_FAILED, "Falha"),
        (STATUS_PARTIAL, "Parcial"),
    ]

    evidence = models.ForeignKey(
        Evidence,
        on_delete=models.CASCADE,
        related_name="anonymization_logs",
        verbose_name="evidência",
    )
    operation = models.CharField(
        "operação",
        max_length=20,
        choices=OPERATION_CHOICES,
        default=OPERATION_ANONYMIZE,
    )
    status = models.CharField(
        "status",
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_SUCCESS,
    )
    faces_detected = models.IntegerField(
        "rostos detectados",
        null=True,
        blank=True,
    )
    faces_anonymized = models.IntegerField(
        "rostos anonimizados",
        null=True,
        blank=True,
    )
    plates_detected = models.IntegerField(
        "placas detectadas",
        null=True,
        blank=True,
    )
    plates_anonymized = models.IntegerField(
        "placas anonimizadas",
        null=True,
        blank=True,
    )
    error_message = models.TextField(
        "mensagem de erro",
        blank=True,
    )
    processing_duration_ms = models.IntegerField(
        "duração do processamento (ms)",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="anonymization_logs",
        verbose_name="executado por",
    )

    class Meta:
        verbose_name = "log de anonimização"
        verbose_name_plural = "logs de anonimização"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["evidence", "-created_at"], name="idx_ev_anon_evid_cat"),
            models.Index(fields=["operation", "status"], name="idx_ev_anon_op_stat"),
        ]

    def __str__(self):
        return f"{self.get_operation_display()} ({self.get_status_display()}) - Evidência #{self.evidence_id}"


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
    # Confiança da IA para este risco específico (0-1)
    ai_confidence = models.DecimalField(
        "confiança da IA",
        max_digits=4,
        decimal_places=3,  # 0.000 a 0.999 = 0% a 99.9%
        null=True,
        blank=True,
        help_text="Confiança da detecção de IA para este risco específico",
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


class AssessmentStatusHistory(models.Model):
    """Registro de cada transição de status de uma avaliação de risco.

    Mantém auditoria completa de todas as mudanças de estado no ciclo de vida,
    incluindo quem disparou a transição e o motivo.
    """

    assessment = models.ForeignKey(
        RiskAssessment,
        on_delete=models.CASCADE,
        related_name="status_history",
    )
    from_status = models.CharField(
        "de",
        max_length=20,
        choices=RiskAssessment.STATUS_CHOICES,
    )
    to_status = models.CharField(
        "para",
        max_length=20,
        choices=RiskAssessment.STATUS_CHOICES,
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assessment_status_changes",
        verbose_name="alterado por",
    )
    changed_at = models.DateTimeField("alterado em", auto_now_add=True, db_index=True)
    reason = models.TextField("motivo", blank=True, default="")

    class Meta:
        verbose_name = "histórico de status"
        verbose_name_plural = "histórico de status"
        ordering = ["-changed_at"]
        indexes = [
            models.Index(fields=["assessment", "-changed_at"]),
        ]

    def __str__(self):
        actor = self.changed_by.email if self.changed_by else "Sistema"
        return (
            f"{self.assessment} : {self.from_status} → {self.to_status} "
            f"por {actor} em {self.changed_at}"
        )


class OlimpiaDetectionResult(models.Model):
    """
    Resultado de detecção da API Olímpia (Dataprev) para uma evidência específica.
    
    Armazena as detecções individuais com bounding boxes e metadados para
    visualização e auditoria.
    """

    # Categorias de risco
    CATEGORY_EPI = "EPI"
    CATEGORY_QUEDA = "QUEDA"
    CATEGORY_ESCAVACAO = "ESCAVACAO"
    CATEGORY_MAQUINARIO = "MAQUINARIO"
    CATEGORY_ESPACO_CONFINADO = "ESPACO_CONFINADO"
    CATEGORY_ELETRICO = "ELETRICO"
    CATEGORY_GENERAL = "GENERAL"

    CATEGORY_CHOICES = [
        (CATEGORY_EPI, "EPI - Equipamento de Proteção Individual"),
        (CATEGORY_QUEDA, "Queda de Altura"),
        (CATEGORY_ESCAVACAO, "Escavação/Vala"),
        (CATEGORY_MAQUINARIO, "Máquinas e Equipamentos"),
        (CATEGORY_ESPACO_CONFINADO, "Espaço Confinado"),
        (CATEGORY_ELETRICO, "Risco Elétrico"),
        (CATEGORY_GENERAL, "Geral"),
    ]

    # Severidades
    SEVERITY_CRITICAL = "CRITICAL"
    SEVERITY_HIGH = "HIGH"
    SEVERITY_MEDIUM = "MEDIUM"
    SEVERITY_LOW = "LOW"

    SEVERITY_CHOICES = [
        (SEVERITY_CRITICAL, "Crítica"),
        (SEVERITY_HIGH, "Alta"),
        (SEVERITY_MEDIUM, "Média"),
        (SEVERITY_LOW, "Baixa"),
    ]

    evidence = models.ForeignKey(
        Evidence,
        on_delete=models.CASCADE,
        related_name="olimpia_detections",
        verbose_name="evidência",
    )
    inference = models.ForeignKey(
        AIInferenceResult,
        on_delete=models.CASCADE,
        related_name="olimpia_detections",
        verbose_name="inferência",
        null=True,
        blank=True,
    )
    
    # Dados da detecção
    rule_id = models.CharField("ID da regra", max_length=50, blank=True)
    rule_name = models.CharField("nome da regra", max_length=200, blank=True)
    description = models.TextField("descrição da detecção")
    confidence = models.DecimalField(
        "confiança",
        max_digits=4,
        decimal_places=3,  # 0.000 a 0.999
        null=True,
        blank=True,
    )
    
    # Bounding box (coordenadas normalizadas 0-1)
    bbox_x1 = models.DecimalField("X1", max_digits=5, decimal_places=4, default=0)
    bbox_y1 = models.DecimalField("Y1", max_digits=5, decimal_places=4, default=0)
    bbox_x2 = models.DecimalField("X2", max_digits=5, decimal_places=4, default=1)
    bbox_y2 = models.DecimalField("Y2", max_digits=5, decimal_places=4, default=1)
    
    # Classificação
    category = models.CharField(
        "categoria",
        max_length=30,
        choices=CATEGORY_CHOICES,
        default=CATEGORY_GENERAL,
    )
    severity = models.CharField(
        "severidade",
        max_length=20,
        choices=SEVERITY_CHOICES,
        default=SEVERITY_MEDIUM,
    )
    
    # Recomendação de mitigação
    recommendation = models.TextField("recomendação", blank=True)
    
    # Imagem processada com bounding boxes
    processed_image = models.FileField(
        "imagem processada",
        upload_to="processed_detections/%Y/%m/",
        null=True,
        blank=True,
        max_length=500,
    )
    
    # Metadados
    created_at = models.DateTimeField("criado em", auto_now_add=True)
    
    class Meta:
        verbose_name = "detecção Olímpia"
        verbose_name_plural = "detecções Olímpia"
        ordering = ["-confidence", "-created_at"]
        indexes = [
            models.Index(fields=["evidence", "-confidence"]),
            models.Index(fields=["category", "-confidence"]),
            models.Index(fields=["severity", "-confidence"]),
        ]

    def __str__(self):
        return f"[{self.category}] {self.description[:50]} ({self.confidence:.0%})"

    def get_bounding_box_list(self) -> list:
        """Retorna bounding box como lista [x1, y1, x2, y2]."""
        return [
            float(self.bbox_x1),
            float(self.bbox_y1),
            float(self.bbox_x2),
            float(self.bbox_y2),
        ]
    
    def get_bounding_box_dict(self) -> dict:
        """Retorna bounding box como dicionário."""
        return {
            "x1": float(self.bbox_x1),
            "y1": float(self.bbox_y1),
            "x2": float(self.bbox_x2),
            "y2": float(self.bbox_y2),
        }
