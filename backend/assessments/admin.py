from django.contrib import admin
from .models import (
    RiskAssessment,
    Evidence,
    RiskFinding,
    AIInferenceResult,
    HumanValidationDecision,
    AssessmentStatusHistory,
)


@admin.register(RiskAssessment)
class RiskAssessmentAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "status", "created_by", "created_at")
    list_filter = ("status",)
    search_fields = ("title", "description")
    raw_id_fields = ("created_by",)


@admin.register(Evidence)
class EvidenceAdmin(admin.ModelAdmin):
    list_display = ("id", "assessment", "file", "file_size", "mime_type", "created_at")
    list_filter = ("mime_type",)
    raw_id_fields = ("assessment",)


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

