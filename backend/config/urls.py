from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    # API v1 endpoints
    path("api/auth/", include("accounts.urls")),
    path("api/users/", include("accounts.urls_users")),
    path("api/assessments/", include("assessments.urls")),
    path("api/admin/", include("configurations.urls")),
    path("api/admin/", include("reports.urls")),
    
    # API Schema e Docs
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]
