from django.urls import path

from .views import (
    LoginView,
    LogoutView,
    MeView,
    TokenRefreshView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
)

app_name = "accounts"
urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password_reset_request"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password_reset_confirm"),
]
