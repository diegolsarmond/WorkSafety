"""
URLs para o app configurations.

Base: /api/admin/
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    AssessmentTypeViewSet,
    EnvironmentTypeViewSet,
    RiskTypeViewSet,
    AIThresholdViewSet,
    AuditLogViewSet,
)
from assessments.admin_views import ProcessingJobViewSet

router = DefaultRouter()
router.register(r'assessment-types', AssessmentTypeViewSet, basename='assessmenttype')
router.register(r'environment-types', EnvironmentTypeViewSet, basename='environmenttype')
router.register(r'risk-types', RiskTypeViewSet, basename='risktype')
router.register(r'ai-thresholds', AIThresholdViewSet, basename='aithreshold')
router.register(r'audit-logs', AuditLogViewSet, basename='auditlog')
router.register(r'processing-jobs', ProcessingJobViewSet, basename='processingjob')

urlpatterns = [
    path('', include(router.urls)),
]
