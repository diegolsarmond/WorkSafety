"""Testes F17.4 — Reset de senha (respostas genéricas, sem enumeração)."""
from django.test import TestCase
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.contrib.auth.tokens import default_token_generator
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User


class PasswordResetRequestTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="reset@example.com",
            password="oldpass123",
        )
        self.url = reverse("accounts:password_reset_request")

    def test_request_with_existing_email_returns_200_generic(self):
        response = self.client.post(
            self.url,
            {"email": "reset@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("detail", response.json())
        self.assertEqual(
            response.json()["detail"],
            "Se o email existir, você receberá instruções para redefinir a senha.",
        )

    def test_request_with_nonexistent_email_returns_200_same_generic(self):
        response = self.client.post(
            self.url,
            {"email": "naoexiste@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("detail", response.json())
        # Mesma mensagem para não enumerar usuários
        self.assertEqual(
            response.json()["detail"],
            "Se o email existir, você receberá instruções para redefinir a senha.",
        )


class PasswordResetConfirmTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="confirm@example.com",
            password="oldpass123",
        )
        self.url = reverse("accounts:password_reset_confirm")

    def _valid_payload(self):
        uidb64 = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        return {"uidb64": uidb64, "token": token, "new_password": "newpass123"}

    def test_confirm_with_valid_token_returns_200_and_changes_password(self):
        payload = self._valid_payload()
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("detail", response.json())
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("newpass123"))

    def test_confirm_with_invalid_token_returns_400_generic(self):
        payload = self._valid_payload()
        payload["token"] = "invalid-token"
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.json())
        self.assertEqual(response.json()["detail"], "Link inválido ou expirado.")
