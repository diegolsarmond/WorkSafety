from django.urls import path

from .views import ReportDownloadView

urlpatterns = [
    # Download público de PDF (sem prefixo /admin)
    path("<int:report_id>/download/", ReportDownloadView.as_view(), name="report-download-public"),
]
