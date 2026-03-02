from django.urls import path
from .views import EvidenceUploadView, RiskAssessmentListCreateView

urlpatterns = [
    path("", RiskAssessmentListCreateView.as_view(), name="assessment-list-create"),
    path("<int:assessment_id>/evidences/", EvidenceUploadView.as_view(), name="evidence-upload"),
]
