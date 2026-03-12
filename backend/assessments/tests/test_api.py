"""Testes da API de assessments (upload de evidências com timestamps)."""
import io
from datetime import datetime
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from PIL import Image

from accounts.models import User
from assessments.models import RiskAssessment, Evidence


def create_image_file(name="test.jpg", content_type="image/jpeg"):
    """Cria um arquivo de imagem válido em memória."""
    image = Image.new("RGB", (100, 100), color="red")
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    buffer.seek(0)
    return SimpleUploadedFile(name, buffer.read(), content_type=content_type)


class EvidenceUploadAPITest(TestCase):
    """Testes para upload de evidências com timestamps."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123"
        )
        self.client.force_authenticate(user=self.user)
        self.assessment = RiskAssessment.objects.create(
            created_by=self.user,
            title="Avaliação Teste"
        )
        self.url = reverse("evidence-upload", kwargs={"assessment_id": self.assessment.id})

    def test_upload_with_two_images_and_two_timestamps(self):
        """
        Critério: upload com 2 imagens e 2 timestamps -> evidences com captured_at correto.
        """
        # Criar duas imagens
        image1 = create_image_file("photo1.jpg")
        image2 = create_image_file("photo2.jpg")

        # Timestamps ISO 8601
        ts1 = "2026-03-10T14:30:00Z"
        ts2 = "2026-03-10T14:35:00Z"

        response = self.client.post(
            self.url,
            {
                "images": [image1, image2],
                "timestamps": [ts1, ts2],
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data), 2)

        # Verificar que as evidências foram criadas com os timestamps corretos
        evidences = Evidence.objects.filter(assessment=self.assessment).order_by("id")
        self.assertEqual(evidences.count(), 2)

        # Verificar timestamps convertidos corretamente
        expected_ts1 = datetime(2026, 3, 10, 14, 30, 0, tzinfo=timezone.utc)
        expected_ts2 = datetime(2026, 3, 10, 14, 35, 0, tzinfo=timezone.utc)

        self.assertEqual(evidences[0].captured_at, expected_ts1)
        self.assertEqual(evidences[1].captured_at, expected_ts2)

        # Verificar que os timestamps estão no response
        self.assertEqual(response.data[0]["captured_at"], "2026-03-10T14:30:00Z")
        self.assertEqual(response.data[1]["captured_at"], "2026-03-10T14:35:00Z")

    def test_upload_without_timestamps(self):
        """
        Critério: upload com imagens sem timestamps -> captured_at deve ser null.
        """
        image1 = create_image_file("photo1.jpg")
        image2 = create_image_file("photo2.jpg")

        response = self.client.post(
            self.url,
            {
                "images": [image1, image2],
                # Sem timestamps
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data), 2)

        # Verificar que as evidências foram criadas com captured_at null
        evidences = Evidence.objects.filter(assessment=self.assessment)
        self.assertEqual(evidences.count(), 2)

        for evidence in evidences:
            self.assertIsNone(evidence.captured_at)

        # Verificar que o response também retorna null
        for item in response.data:
            self.assertIsNone(item["captured_at"])

    def test_upload_with_mismatched_timestamps_count(self):
        """
        Critério: upload com timestamps em cardinalidade diferente -> HTTP 400.
        """
        image1 = create_image_file("photo1.jpg")
        image2 = create_image_file("photo2.jpg")

        # Enviar apenas 1 timestamp para 2 imagens
        ts1 = "2026-03-10T14:30:00Z"

        response = self.client.post(
            self.url,
            {
                "images": [image1, image2],
                "timestamps": [ts1],  # Apenas 1 timestamp
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("timestamps", str(response.data).lower())

    def test_upload_with_single_image_and_timestamp(self):
        """Teste: upload com 1 imagem e 1 timestamp."""
        image = create_image_file("photo.jpg")
        ts = "2026-03-12T10:00:00Z"

        response = self.client.post(
            self.url,
            {
                "images": [image],
                "timestamps": [ts],
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data), 1)

        evidence = Evidence.objects.get(assessment=self.assessment)
        self.assertIsNotNone(evidence.captured_at)
        self.assertEqual(
            evidence.captured_at,
            datetime(2026, 3, 12, 10, 0, 0, tzinfo=timezone.utc)
        )

    def test_evidence_serializer_includes_captured_at(self):
        """Verifica que o serializer inclui captured_at nos campos."""
        image = create_image_file("photo.jpg")
        ts = "2026-03-12T10:00:00Z"

        response = self.client.post(
            self.url,
            {
                "images": [image],
                "timestamps": [ts],
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Verificar que captured_at está presente na resposta
        self.assertIn("captured_at", response.data[0])
        self.assertIn("file", response.data[0])
        self.assertIn("file_hash", response.data[0])

    def test_upload_idempotency_keeps_original_captured_at(self):
        """
        Teste de idempotência: se reenviar a mesma imagem, retorna a evidência existente
        com o captured_at original (não sobrescreve).
        """
        image = create_image_file("photo.jpg")
        ts_original = "2026-03-10T08:00:00Z"

        # Primeiro upload
        response1 = self.client.post(
            self.url,
            {
                "images": [image],
                "timestamps": [ts_original],
            },
            format="multipart"
        )
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)

        # Recriar a mesma imagem (mesmo conteúdo, novo objeto)
        image.seek(0)
        image2 = SimpleUploadedFile("photo2.jpg", image.read(), content_type="image/jpeg")
        ts_novo = "2026-03-11T12:00:00Z"  # Timestamp diferente

        # Segundo upload (mesma imagem, timestamp diferente)
        response2 = self.client.post(
            self.url,
            {
                "images": [image2],
                "timestamps": [ts_novo],
            },
            format="multipart"
        )
        self.assertEqual(response2.status_code, status.HTTP_201_CREATED)

        # Deve retornar a mesma evidência com o captured_at original
        self.assertEqual(response1.data[0]["id"], response2.data[0]["id"])
        self.assertEqual(response2.data[0]["captured_at"], "2026-03-10T08:00:00Z")

        # Verificar que só existe uma evidência
        self.assertEqual(Evidence.objects.filter(assessment=self.assessment).count(), 1)
