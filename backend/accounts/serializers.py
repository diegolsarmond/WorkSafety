from rest_framework import serializers

from .models import User


class LoginRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True, write_only=True)
    password = serializers.CharField(required=True, write_only=True, style={"input_type": "password"})


class UserInfoSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    email = serializers.EmailField(read_only=True)


class LoginResponseSerializer(serializers.Serializer):
    access = serializers.CharField(read_only=True)
    refresh = serializers.CharField(read_only=True)
    user = UserInfoSerializer(read_only=True)


class LogoutRequestSerializer(serializers.Serializer):
    refresh = serializers.CharField(required=True, write_only=True)


class TokenRefreshResponseSerializer(serializers.Serializer):
    """Resposta do endpoint de renovação de access token."""
    access = serializers.CharField(read_only=True)


# F17.1 — Gestão de usuários (admin)

class UserListSerializer(serializers.ModelSerializer):
    """Listagem e detalhe: id, email, is_active, is_staff (sem senha)."""

    class Meta:
        model = User
        fields = ("id", "email", "is_active", "is_staff", "date_joined")
        read_only_fields = ("id", "email", "date_joined")


class UserCreateSerializer(serializers.ModelSerializer):
    """Criação de usuário (admin): email + password."""

    password = serializers.CharField(write_only=True, style={"input_type": "password"}, min_length=8)

    class Meta:
        model = User
        fields = ("id", "email", "password", "is_active", "is_staff")
        read_only_fields = ("id",)
        extra_kwargs = {"is_active": {"default": True}, "is_staff": {"default": False}}

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserPatchSerializer(serializers.ModelSerializer):
    """
    Atualização parcial (PATCH). is_active sempre permitido para admin.
    is_staff e is_superuser só aparecem se o solicitante for superuser (hardening).
    """

    class Meta:
        model = User
        fields = ("is_active", "is_staff", "is_superuser")

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if request and getattr(request.user, "is_superuser", False) is False:
            fields.pop("is_staff", None)
            fields.pop("is_superuser", None)
        return fields


# F17.4 — Reset de senha (respostas genéricas para evitar enumeração)

class DetailMessageSerializer(serializers.Serializer):
    """Resposta genérica com mensagem (ex.: reset de senha)."""
    detail = serializers.CharField(read_only=True)


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True, write_only=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    uidb64 = serializers.CharField(required=True, write_only=True)
    token = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, style={"input_type": "password"}, min_length=8)
