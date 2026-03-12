from django.urls import path
from .views import (
    EvidenceUploadView, 
    RiskAssessmentListCreateView,
    AssessmentCaptureView,
    AssessmentSyncView,
    AssessmentMarkAIReviewedView,
    AssessmentHumanValidateView,
    AssessmentFinalizeView,
    AssessmentStatusHistoryView,
    AssessmentValidTransitionsView,
)

urlpatterns = [
    # CRUD endpoints
    path("", RiskAssessmentListCreateView.as_view(), name="assessment-list-create"),
    path("<int:assessment_id>/evidences/", EvidenceUploadView.as_view(), name="evidence-upload"),
    
    # Lifecycle transition endpoints
    path("<int:assessment_id>/capture/", AssessmentCaptureView.as_view(), name="assessment-capture"),
    path("<int:assessment_id>/sync/", AssessmentSyncView.as_view(), name="assessment-sync"),
    path("<int:assessment_id>/mark-ai-reviewed/", AssessmentMarkAIReviewedView.as_view(), name="assessment-mark-ai-reviewed"),
    path("<int:assessment_id>/human-validate/", AssessmentHumanValidateView.as_view(), name="assessment-human-validate"),
    path("<int:assessment_id>/finalize/", AssessmentFinalizeView.as_view(), name="assessment-finalize"),
    
    # Lifecycle info endpoints
    path("<int:assessment_id>/status-history/", AssessmentStatusHistoryView.as_view(), name="assessment-status-history"),
    path("<int:assessment_id>/valid-transitions/", AssessmentValidTransitionsView.as_view(), name="assessment-valid-transitions"),
]
