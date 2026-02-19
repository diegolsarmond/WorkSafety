from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAdminUser
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView as SimpleJWTTokenRefreshView
from drf_spectacular.utils import extend_schema, extend_schema_view

from django.conf import settings
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.contrib.auth.tokens import default_token_generator

from .models import User
from .serializers import (
    LoginRequestSerializer,
    LoginResponseSerializer,
    LogoutRequestSerializer,
    TokenRefreshResponseSerializer,
    UserListSerializer,
    UserCreateSerializer,
    UserPatchSerializer,
    DetailMessageSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)
from .services import login as do_login

# Generic messages (do not reveal whether user exists)
MSG_INVALID_CREDENTIALS = "Credenciais inválidas."
MSG_LOCKED = "Muitas tentativas. Tente novamente mais tarde."
MSG_INVALID_REQUEST = "Dados inválidos."


@extend_schema(
    tags=["auth"],
    request=LoginRequestSerializer,
    responses={
        200: LoginResponseSerializer,
        400: {"description": "Corpo inválido (email/senha ausentes ou inválidos)."},
        401: {"description": "Credenciais inválidas."},
        429: {"description": "Muitas tentativas. Tente novamente mais tarde."},
    },
)
class LoginView(APIView):
    """POST /auth/login — email + password, returns JWT and user or 401/429."""
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = LoginRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )
        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]
        result = do_login(email, password)
        if result["status"] == "locked":
            return Response(
                {"detail": MSG_LOCKED},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        if result["status"] == "invalid_credentials":
            return Response(
                {"detail": MSG_INVALID_CREDENTIALS},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return Response(
            LoginResponseSerializer(result["data"]).data,
            status=status.HTTP_200_OK,
        )


@extend_schema(
    tags=["auth"],
    request=LogoutRequestSerializer,
    responses={
        204: {"description": "Refresh token invalidado com sucesso."},
        400: {"description": "Corpo inválido (campo refresh ausente ou inválido)."},
        401: {"description": "Token inválido ou já revogado."},
    },
)
class LogoutView(APIView):
    """POST /auth/logout — body { \"refresh\": \"<token>\" }, blacklists refresh token. Returns 204."""
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = LogoutRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"detail": MSG_INVALID_REQUEST},
                status=status.HTTP_400_BAD_REQUEST,
            )
        token_str = serializer.validated_data["refresh"]
        try:
            token = RefreshToken(token_str)
            token.blacklist()
        except (TokenError, AttributeError):
            return Response(
                {"detail": "Token inválido ou já revogado."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(
    tags=["auth"],
    request=LogoutRequestSerializer,
    responses={
        200: TokenRefreshResponseSerializer,
        401: {"description": "Refresh token inválido ou expirado."},
        400: {"description": "Corpo inválido (campo refresh ausente)."},
    },
)
class TokenRefreshView(SimpleJWTTokenRefreshView):
    """POST /auth/token/refresh/ — body { \"refresh\": \"<token>\" }. Retorna novo access token."""


# F17.1 — CRUD de usuários (apenas admin)

@extend_schema_view(
    list=extend_schema(
        tags=["users"],
        description="Listar usuários (apenas admin).",
        responses={403: {"description": "Apenas administradores."}},
    ),
    retrieve=extend_schema(
        tags=["users"],
        description="Detalhe do usuário (apenas admin).",
        responses={200: UserListSerializer, 403: {"description": "Apenas administradores."}, 404: {"description": "Usuário não encontrado."}},
    ),
    create=extend_schema(
        tags=["users"],
        description="Cadastrar usuário (apenas admin).",
        request=UserCreateSerializer,
        responses={
            201: UserListSerializer,
            400: {"description": "Dados inválidos (ex.: email já existe)."},
            403: {"description": "Apenas administradores."},
        },
    ),
    partial_update=extend_schema(
        tags=["users"],
        description="Atualizar usuário (ex.: desativar com is_active=false). Apenas admin.",
        request=UserPatchSerializer,
        responses={
            200: UserListSerializer,
            400: {"description": "Dados inválidos."},
            403: {"description": "Apenas administradores."},
            404: {"description": "Usuário não encontrado."},
        },
    ),
    destroy=extend_schema(
        tags=["users"],
        description="Exclusão física desabilitada. Use PATCH com is_active=false para desativar.",
        responses={405: {"description": "Use PATCH com is_active=false para desativar o usuário."}},
    ),
)
class UserViewSet(ModelViewSet):
    """Listar, criar, ver detalhe e atualizar (PATCH) usuários. Apenas is_staff."""
    queryset = User.objects.all().order_by("id")
    permission_classes = [IsAdminUser]
    http_method_names = ["get", "post", "patch", "head", "options"]  # sem PUT/DELETE; desativar = PATCH is_active

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action in ("partial_update", "update"):
            return UserPatchSerializer
        return UserListSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def destroy(self, request, *args, **kwargs):
        # Não excluir fisicamente; desativar via PATCH is_active=False
        return Response(
            {"detail": "Use PATCH com is_active=false para desativar o usuário."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )


# F17.4 — Reset de senha (PasswordResetTokenGenerator + uidb64, sem persistência)

MSG_PASSWORD_RESET_SENT = "Se o email existir, você receberá instruções para redefinir a senha."
MSG_PASSWORD_RESET_DONE = "Senha redefinida com sucesso."
MSG_PASSWORD_RESET_INVALID = "Link inválido ou expirado."


def _normalize_email(email):
    if not email:
        return ""
    return email.strip().lower()


@extend_schema(
    tags=["auth"],
    request=PasswordResetRequestSerializer,
    description="Solicitar redefinição de senha. Resposta sempre genérica (evita enumeração).",
    responses={
        200: DetailMessageSerializer,
        400: {"description": "Corpo inválido (email ausente ou inválido)."},
    },
)
class PasswordResetRequestView(APIView):
    """POST /auth/password-reset/ — envia link por email; resposta genérica sempre 200."""
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        email = _normalize_email(serializer.validated_data["email"])
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            user = None
        if user is not None and user.is_active:
            uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            # Link para o frontend (MVP: URL base pode vir de env; aqui fixo para exemplo)
            reset_url = f"/reset-password/confirm/?uidb64={uidb64}&token={token}"
            send_mail(
                subject="Redefinição de senha - WorkSafety",
                message=f"Use o link abaixo para redefinir sua senha:\n{reset_url}\n\nO link expira em 1 hora.",
                from_email=settings.DEFAULT_FROM_EMAIL or "noreply@worksafety.local",
                recipient_list=[user.email],
                fail_silently=True,
            )
        return Response(
            {"detail": MSG_PASSWORD_RESET_SENT},
            status=status.HTTP_200_OK,
        )


@extend_schema(
    tags=["auth"],
    request=PasswordResetConfirmSerializer,
    description="Confirmar nova senha com token. Resposta genérica em sucesso ou falha.",
    responses={
        200: DetailMessageSerializer,
        400: {"description": "Link inválido ou expirado."},
    },
)
class PasswordResetConfirmView(APIView):
    """POST /auth/password-reset/confirm/ — uidb64 + token + new_password; resposta genérica."""
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"detail": MSG_PASSWORD_RESET_INVALID},
                status=status.HTTP_400_BAD_REQUEST,
            )
        uidb64 = serializer.validated_data["uidb64"]
        token = serializer.validated_data["token"]
        new_password = serializer.validated_data["new_password"]
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None
        if user is None or not default_token_generator.check_token(user, token):
            return Response(
                {"detail": MSG_PASSWORD_RESET_INVALID},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response(
            {"detail": MSG_PASSWORD_RESET_DONE},
            status=status.HTTP_200_OK,
        )
