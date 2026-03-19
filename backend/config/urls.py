from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    # API v1 endpoints
    path("api/auth/", include("accounts.urls")),
    path("api/users/", include("accounts.urls_users")),
    path("api/assessments/", include("assessments.urls")),
    path("api/reports/", include("reports.public_urls")),
    path("api/admin/", include("configurations.urls")),
    path("api/admin/", include("reports.urls")),
    
    # API Schema e Docs
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("schema/", SpectacularAPIView.as_view(), name="schema-root"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui-root"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
