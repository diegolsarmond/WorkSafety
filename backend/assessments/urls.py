from django.urls import path
from .views import (
    EvidenceUploadView,
    RiskAssessmentListCreateView,
    RiskAssessmentDetailView,
    AssessmentCaptureView,
    AssessmentSyncView,
    AssessmentMarkAIReviewedView,
    AssessmentHumanValidateView,
    AssessmentFinalizeView,
    AssessmentStatusHistoryView,
    AssessmentValidTransitionsView,
    AssessmentProcessAIView,
    AssessmentReprocessAIView,
    AssessmentAIStatusView,
    AIProcessingQueueView,
)

urlpatterns = [
    # CRUD endpoints
    path("", RiskAssessmentListCreateView.as_view(), name="assessment-list-create"),
    path("<int:assessment_id>/", RiskAssessmentDetailView.as_view(), name="assessment-detail"),
    path("<int:assessment_id>/evidences/", EvidenceUploadView.as_view(), name="evidence-upload"),

    # Lifecycle transition endpoints
    path("<int:assessment_id>/capture/", AssessmentCaptureView.as_view(), name="assessment-capture"),
    path("<int:assessment_id>/sync/", AssessmentSyncView.as_view(), name="assessment-sync"),
    path("<int:assessment_id>/ai-reviewed/", AssessmentMarkAIReviewedView.as_view(), name="assessment-ai-reviewed"),
    path("<int:assessment_id>/human-validated/", AssessmentHumanValidateView.as_view(), name="assessment-human-validated"),
    path("<int:assessment_id>/finalize/", AssessmentFinalizeView.as_view(), name="assessment-finalize"),

    # Lifecycle info endpoints
    path("<int:assessment_id>/status-history/", AssessmentStatusHistoryView.as_view(), name="assessment-status-history"),
    path("<int:assessment_id>/valid-transitions/", AssessmentValidTransitionsView.as_view(), name="assessment-valid-transitions"),

    # AI Processing endpoints
    path("<int:assessment_id>/process-ai/", AssessmentProcessAIView.as_view(), name="assessment-process-ai"),
    path("<int:assessment_id>/reprocess-ai/", AssessmentReprocessAIView.as_view(), name="assessment-reprocess-ai"),
    path("<int:assessment_id>/ai-status/", AssessmentAIStatusView.as_view(), name="assessment-ai-status"),
    
    # AI Queue endpoint
    path("ai-queue/", AIProcessingQueueView.as_view(), name="ai-processing-queue"),
]
