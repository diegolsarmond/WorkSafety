from django.urls import path
from .views import EvidenceUploadView

urlpatterns = [
    path("<int:assessment_id>/evidences/", EvidenceUploadView.as_view(), name="evidence-upload"),
]
