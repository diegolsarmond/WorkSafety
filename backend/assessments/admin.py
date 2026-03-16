from django.contrib import admin
from .models import (
    RiskAssessment,
    Evidence,
    RiskFinding,
    AIInferenceResult,
    HumanValidationDecision,
    AssessmentStatusHistory,
    EvidenceAnonymizationLog,
    OlimpiaDetectionResult,
)


@admin.register(RiskAssessment)
class RiskAssessmentAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "status", "legal_basis", "created_by", "created_at")
    list_filter = ("status", "legal_basis")
    search_fields = ("title", "description", "legal_basis_notes")
    raw_id_fields = ("created_by",)
    fieldsets = (
        (None, {
            "fields": ("title", "description", "status", "created_by")
        }),
        ("Tipos", {
            "fields": ("assessment_type", "environment_type")
        }),
        ("LGPD/GDPR", {
            "fields": ("legal_basis", "legal_basis_notes"),
            "classes": ("collapse",),
        }),
        ("Timestamps", {
            "fields": (
                "captured_at", "synced_at", "ai_reviewed_at",
                "human_validated_at", "finalized_at", "created_at"
            ),
            "classes": ("collapse",),
        }),
    )
    readonly_fields = ("created_at", "updated_at")


class EvidenceAnonymizationLogInline(admin.TabularInline):
    """Inline para visualizar logs de anonimização na evidência."""
    model = EvidenceAnonymizationLog
    extra = 0
    readonly_fields = (
        "operation", "status", "faces_detected", "faces_anonymized",
        "plates_detected", "plates_anonymized", "processing_duration_ms",
        "created_at", "created_by"
    )
    can_delete = False
    max_num = 0


@admin.register(Evidence)
class EvidenceAdmin(admin.ModelAdmin):
    list_display = (
        "id", "assessment", "file", "file_size", "mime_type",
        "is_anonymized", "anonymization_status", "created_at"
    )
    list_filter = ("mime_type", "is_anonymized", "anonymization_status")
    search_fields = ("file", "file_hash", "original_file_hash")
    raw_id_fields = ("assessment",)
    readonly_fields = ("file_hash", "file_size", "mime_type", "original_file_hash")
    fieldsets = (
        (None, {
            "fields": ("assessment", "file", "captured_at")
        }),
        ("Metadados", {
            "fields": ("file_hash", "file_size", "mime_type"),
            "classes": ("collapse",),
        }),
        ("LGPD/GDPR - Anonimização", {
            "fields": (
                "is_anonymized", "anonymization_status", "anonymized_at",
                "original_file_hash"
            ),
            "classes": ("collapse",),
        }),
    )
    inlines = [EvidenceAnonymizationLogInline]


@admin.register(EvidenceAnonymizationLog)
class EvidenceAnonymizationLogAdmin(admin.ModelAdmin):
    """Admin para logs de anonimização (auditoria LGPD)."""
    list_display = (
        "id", "evidence", "operation", "status", "faces_anonymized",
        "plates_anonymized", "created_at", "created_by"
    )
    list_filter = ("operation", "status")
    search_fields = ("evidence__file", "error_message")
    raw_id_fields = ("evidence", "created_by")
    readonly_fields = ("created_at",)
    date_hierarchy = "created_at"


@admin.register(RiskFinding)
class RiskFindingAdmin(admin.ModelAdmin):
    list_display = ("id", "assessment", "severity", "created_at")
    list_filter = ("severity",)
    search_fields = ("description",)
    raw_id_fields = ("assessment",)


@admin.register(AIInferenceResult)
class AIInferenceResultAdmin(admin.ModelAdmin):
    list_display = ("id", "assessment", "confidence", "created_at")
    raw_id_fields = ("assessment",)


@admin.register(HumanValidationDecision)
class HumanValidationDecisionAdmin(admin.ModelAdmin):
    list_display = ("id", "inference", "validator", "decision", "created_at")
    list_filter = ("decision",)
    raw_id_fields = ("inference", "validator")


@admin.register(AssessmentStatusHistory)
class AssessmentStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("id", "assessment", "from_status", "to_status", "changed_by", "changed_at")
    list_filter = ("from_status", "to_status")
    raw_id_fields = ("assessment", "changed_by")
    readonly_fields = ("changed_at",)
    ordering = ("-changed_at",)


@admin.register(OlimpiaDetectionResult)
class OlimpiaDetectionResultAdmin(admin.ModelAdmin):
    """Admin para resultados de detecção da API Olímpia."""
    list_display = (
        "id", "evidence", "category", "severity", "confidence",
        "rule_name", "created_at"
    )
    list_filter = ("category", "severity", "rule_id")
    search_fields = ("description", "rule_name", "recommendation")
    raw_id_fields = ("evidence", "inference")
    readonly_fields = ("created_at", "get_bounding_box_list")
    fieldsets = (
        (None, {
            "fields": ("evidence", "inference", "rule_id", "rule_name")
        }),
        ("Detecção", {
            "fields": ("description", "confidence", "category", "severity")
        }),
        ("Bounding Box", {
            "fields": (
                "bbox_x1", "bbox_y1", "bbox_x2", "bbox_y2",
                "get_bounding_box_list"
            ),
            "classes": ("collapse",),
        }),
        ("Mitigação", {
            "fields": ("recommendation",),
            "classes": ("collapse",),
        }),
    )
    
    def get_bounding_box_list(self, obj):
        """Exibe bounding box como lista legível."""
        return obj.get_bounding_box_list()
    get_bounding_box_list.short_description = "Bounding Box (lista)"

