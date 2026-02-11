"""Testes F17.1 - CRUD de usuarios (apenas admin)."""
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User


class UserManagementTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="admin@example.com",
            password="adminpass123",
            is_staff=True,
        )
        self.user = User.objects.create_user(
            email="user@example.com",
            password="userpass123",
        )

    def test_list_users_as_admin_returns_200(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse("user-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIsInstance(data, list)
        self.assertGreaterEqual(len(data), 2)

    def test_list_users_as_non_admin_returns_403(self):
        self.client.force_authenticate(user=self.user)
        url = reverse("user-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_user_as_admin_returns_201(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse("user-list")
        response = self.client.post(
            url,
            {"email": "new@example.com", "password": "newpass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["email"], "new@example.com")
        self.assertIn("id", data)
        self.assertTrue(User.objects.filter(email="new@example.com").exists())

    def test_create_user_as_non_admin_returns_403(self):
        self.client.force_authenticate(user=self.user)
        url = reverse("user-list")
        response = self.client.post(
            url,
            {"email": "other@example.com", "password": "otherpass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_retrieve_user_as_admin_returns_200(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse("user-detail", args=[self.user.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["email"], "user@example.com")

    def test_retrieve_user_as_non_admin_returns_403(self):
        self.client.force_authenticate(user=self.user)
        url = reverse("user-detail", args=[self.admin.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_patch_deactivate_user_as_admin_succeeds(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse("user-detail", args=[self.user.id])
        response = self.client.patch(url, {"is_active": False}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

    def test_patch_user_as_non_admin_returns_403(self):
        self.client.force_authenticate(user=self.user)
        url = reverse("user-detail", args=[self.admin.id])
        response = self.client.patch(url, {"is_active": False}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
