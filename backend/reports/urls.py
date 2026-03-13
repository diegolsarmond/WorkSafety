from django.urls import path
from .views import (
    ReportListView,
    ReportDetailView,
    GenerateReportView,
    RegenerateReportView,
)

urlpatterns = [
    # Listagem de relatórios
    path("reports/", ReportListView.as_view(), name="report-list"),
    path("reports/<int:report_id>/", ReportDetailView.as_view(), name="report-detail"),
    
    # Geração de relatórios
    path(
        "assessments/<int:assessment_id>/generate-report/",
        GenerateReportView.as_view(),
        name="generate-report"
    ),
    path(
        "assessments/<int:assessment_id>/regenerate-report/",
        RegenerateReportView.as_view(),
        name="regenerate-report"
    ),
]
