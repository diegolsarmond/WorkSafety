from datetime import datetime, timedelta, timezone
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User, LoginAttempt


@override_settings(LOCKOUT_MAX_ATTEMPTS=5, LOCKOUT_MINUTES=15)
class LoginTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.login_url = reverse("accounts:login")
        self.user = User.objects.create_user(
            email="user@example.com",
            password="validpass123",
        )

    def test_login_success_returns_200_and_tokens(self):
        response = self.client.post(
            self.login_url,
            {"email": "user@example.com", "password": "validpass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("access", data)
        self.assertIn("refresh", data)
        self.assertIn("user", data)
        self.assertEqual(data["user"]["email"], "user@example.com")
        self.assertEqual(data["user"]["id"], self.user.id)

    def test_login_invalid_credentials_returns_401_generic(self):
        # Wrong password
        response = self.client.post(
            self.login_url,
            {"email": "user@example.com", "password": "wrong"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("detail", response.json())
        self.assertEqual(response.json()["detail"], "Credenciais inválidas.")

    def test_login_nonexistent_user_returns_401_generic(self):
        response = self.client.post(
            self.login_url,
            {"email": "nonexistent@example.com", "password": "any"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.json()["detail"], "Credenciais inválidas.")

    def test_login_lockout_after_five_failures_returns_429(self):
        for _ in range(5):
            self.client.post(
                self.login_url,
                {"email": "user@example.com", "password": "wrong"},
                format="json",
            )
        response = self.client.post(
            self.login_url,
            {"email": "user@example.com", "password": "validpass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("detail", response.json())

        attempt = LoginAttempt.objects.get(user=self.user)
        self.assertIsNotNone(attempt.locked_until)
        self.assertGreater(attempt.locked_until, datetime.now(timezone.utc))

    def test_login_unlocked_after_lockout_expires(self):
        # Lock the account
        for _ in range(5):
            self.client.post(
                self.login_url,
                {"email": "user@example.com", "password": "wrong"},
                format="json",
            )
        attempt = LoginAttempt.objects.get(user=self.user)
        # Simulate lockout expired (set locked_until in the past)
        attempt.locked_until = datetime.now(timezone.utc) - timedelta(minutes=1)
        attempt.save(update_fields=["locked_until"])

        response = self.client.post(
            self.login_url,
            {"email": "user@example.com", "password": "validpass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.json())

    def test_login_after_unlock_failure_reapplies_lockout(self):
        attempt, _ = LoginAttempt.objects.get_or_create(
            user=self.user,
            defaults={"failed_count": 0},
        )
        attempt.failed_count = 4
        attempt.locked_until = None
        attempt.save(update_fields=["failed_count", "locked_until"])

        # One more failure → lockout
        self.client.post(
            self.login_url,
            {"email": "user@example.com", "password": "wrong"},
            format="json",
        )
        attempt.refresh_from_db()
        self.assertEqual(attempt.failed_count, 5)
        self.assertIsNotNone(attempt.locked_until)

        response = self.client.post(
            self.login_url,
            {"email": "user@example.com", "password": "validpass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_login_invalid_body_returns_400(self):
        response = self.client.post(
            self.login_url,
            {"email": "user@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LogoutTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.login_url = reverse("accounts:login")
        self.logout_url = reverse("accounts:logout")
        self.user = User.objects.create_user(
            email="logout@example.com",
            password="validpass123",
        )

    def test_logout_blacklists_refresh_returns_204(self):
        login_resp = self.client.post(
            self.login_url,
            {"email": "logout@example.com", "password": "validpass123"},
            format="json",
        )
        self.assertEqual(login_resp.status_code, status.HTTP_200_OK)
        refresh = login_resp.json()["refresh"]

        response = self.client.post(
            self.logout_url,
            {"refresh": refresh},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_refresh_after_logout_cannot_obtain_new_tokens(self):
        login_resp = self.client.post(
            self.login_url,
            {"email": "logout@example.com", "password": "validpass123"},
            format="json",
        )
        refresh = login_resp.json()["refresh"]
        self.client.post(
            self.logout_url,
            {"refresh": refresh},
            format="json",
        )

        # SimpleJWT token refresh endpoint: POST with {"refresh": "..."}
        refresh_url = "/auth/token/refresh/"
        response = self.client.post(
            refresh_url,
            {"refresh": refresh},
            format="json",
        )
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_400_BAD_REQUEST),
            "Revoked refresh token must not be accepted",
        )
