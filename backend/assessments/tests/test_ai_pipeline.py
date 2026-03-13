"""
Testes para o pipeline assíncrono de processamento de IA.

Testa:
- Mock do cliente IA
- Fluxo de sucesso (synced -> ai_reviewed)
- Fluxo de falha (synced -> error)
- Reprocessamento
- Endpoints de IA
"""
import json
from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from rest_framework import status

from assessments.models import RiskAssessment, AIInferenceResult, RiskFinding, Evidence
from assessments.ai_client import MockAIClient, AIInferenceResult as AIResult, AIInferenceRequest
from assessments.tasks import process_assessment, reprocess_assessment
from assessments.services import AssessmentLifecycleService

User = get_user_model()


class MockAIClientTests(TestCase):
    """Testes para o cliente mock de IA."""

    def setUp(self):
        self.client = MockAIClient()

    def test_analyze_assessment_with_evidences(self):
        """Testa análise com evidências."""
        request = AIInferenceRequest(
            assessment_id=1,
            evidence_urls=["http://example.com/image1.jpg", "http://example.com/image2.jpg"],
            title="Test Assessment",
            description="Test Description",
        )
        
        result = self.client.analyze_assessment(request)
        
        self.assertTrue(result.success)
        self.assertEqual(len(result.findings), 2)
        self.assertIn(result.confidence, ["LOW", "MEDIUM", "HIGH"])
        self.assertEqual(result.model_version, "mock-v1.0")
        self.assertIsNotNone(result.raw_response)

    def test_analyze_assessment_without_evidences(self):
        """Testa análise sem evidências."""
        request = AIInferenceRequest(
            assessment_id=1,
            evidence_urls=[],
        )
        
        result = self.client.analyze_assessment(request)
        
        self.assertTrue(result.success)
        self.assertEqual(len(result.findings), 0)

    def test_analyze_assessment_with_simulated_failure(self):
        """Testa simulação de falha."""
        client = MockAIClient(fail_rate=1.0)  # 100% de falha
        request = AIInferenceRequest(
            assessment_id=1,
            evidence_urls=["http://example.com/image.jpg"],
        )
        
        result = client.analyze_assessment(request)
        
        self.assertFalse(result.success)
        self.assertIn("failure", result.error_message.lower())

    def test_health_check(self):
        """Testa health check."""
        self.assertTrue(self.client.health_check())

    def test_call_count(self):
        """Testa contagem de chamadas."""
        request = AIInferenceRequest(assessment_id=1, evidence_urls=[])
        
        self.assertEqual(self.client.get_call_count(), 0)
        self.client.analyze_assessment(request)
        self.assertEqual(self.client.get_call_count(), 1)
        self.client.analyze_assessment(request)
        self.assertEqual(self.client.get_call_count(), 2)


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)  # Executa tasks sincronamente nos testes
class AIProcessingTaskTests(TestCase):
    """Testes para as tasks Celery de processamento de IA."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        self.assessment = RiskAssessment.objects.create(
            created_by=self.user,
            title="Test Assessment",
            description="Test Description",
            status=RiskAssessment.STATUS_SYNCED,
        )
        # Criar evidência
        self.evidence = Evidence.objects.create(
            assessment=self.assessment,
            file=SimpleUploadedFile("test.jpg", b"fake image content"),
        )

    @patch('assessments.tasks.get_ai_client')
    def test_process_assessment_success(self, mock_get_client):
        """Testa processamento bem-sucedido."""
        # Configurar mock
        mock_client = MockAIClient()
        mock_get_client.return_value = mock_client

        # Executar task
        result = process_assessment(self.assessment.id)

        # Recarregar avaliação do banco
        self.assessment.refresh_from_db()

        # Verificar resultado
        self.assertEqual(result["status"], "success")
        self.assertEqual(self.assessment.status, RiskAssessment.STATUS_AI_REVIEWED)

        # Verificar inferência criada
        inference = AIInferenceResult.objects.filter(assessment=self.assessment).first()
        self.assertIsNotNone(inference)
        self.assertEqual(inference.status, AIInferenceResult.STATUS_SUCCEEDED)

        # Verificar findings criados
        findings = RiskFinding.objects.filter(assessment=self.assessment)
        self.assertGreater(findings.count(), 0)

    @patch('assessments.tasks.get_ai_client')
    def test_process_assessment_failure(self, mock_get_client):
        """Testa processamento com falha."""
        # Configurar mock com 100% de falha
        mock_client = MockAIClient(fail_rate=1.0)
        mock_get_client.return_value = mock_client

        # Executar task (sem retry em teste)
        with patch.object(process_assessment, 'retry', side_effect=Exception("Max retries exceeded")):
            result = process_assessment(self.assessment.id, retries=3)

        # Recarregar avaliação do banco
        self.assessment.refresh_from_db()

        # Verificar resultado
        self.assertEqual(result["status"], "error")
        self.assertEqual(self.assessment.status, RiskAssessment.STATUS_ERROR_AI)

        # Verificar inferência criada com falha
        inference = AIInferenceResult.objects.filter(assessment=self.assessment).first()
        self.assertIsNotNone(inference)
        self.assertEqual(inference.status, AIInferenceResult.STATUS_FAILED)
        self.assertTrue(len(inference.error_message) > 0)

    @patch('assessments.tasks.get_ai_client')
    def test_process_assessment_not_found(self, mock_get_client):
        """Testa processamento de avaliação inexistente."""
        result = process_assessment(99999)

        self.assertEqual(result["status"], "error")
        self.assertEqual(result["message"], "Assessment not found")

    @patch('assessments.tasks.get_ai_client')
    def test_process_assessment_invalid_status(self, mock_get_client):
        """Testa processamento com status inválido."""
        # Mudar para status que não permite processamento
        self.assessment.status = RiskAssessment.STATUS_DRAFT
        self.assessment.save()

        result = process_assessment(self.assessment.id)

        self.assertEqual(result["status"], "skipped")
        self.assertIn("Invalid status", result["message"])

    @patch('assessments.tasks.process_assessment.delay')
    def test_reprocess_assessment(self, mock_process_delay):
        """Testa reprocessamento de avaliação em erro."""
        # Colocar em estado de erro
        self.assessment.status = RiskAssessment.STATUS_ERROR_AI
        self.assessment.save()

        # Criar inferência falha
        AIInferenceResult.objects.create(
            assessment=self.assessment,
            status=AIInferenceResult.STATUS_FAILED,
            error_message="Previous error",
        )

        result = reprocess_assessment(self.assessment.id)

        # Verificar resultado
        self.assertEqual(result["status"], "queued")
        mock_process_delay.assert_called_once_with(self.assessment.id)

        # Verificar que avaliação foi resetada
        self.assessment.refresh_from_db()
        self.assertEqual(self.assessment.status, RiskAssessment.STATUS_SYNCED)

    def test_reprocess_assessment_not_in_error(self):
        """Testa reprocessamento de avaliação que não está em erro."""
        result = reprocess_assessment(self.assessment.id)

        self.assertEqual(result["status"], "skipped")
        self.assertIn("not in error state", result["message"])


class AIProcessingIntegrationTests(APITestCase):
    """Testes de integração para endpoints de processamento de IA."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        self.assessment = RiskAssessment.objects.create(
            created_by=self.user,
            title="Test Assessment",
            description="Test Description",
            status=RiskAssessment.STATUS_SYNCED,
        )
        self.evidence = Evidence.objects.create(
            assessment=self.assessment,
            file=SimpleUploadedFile("test.jpg", b"fake image content"),
        )
        self.client.force_authenticate(user=self.user)

    @patch('assessments.views.process_assessment.delay')
    def test_process_ai_endpoint(self, mock_delay):
        """Testa endpoint de processamento de IA."""
        mock_task = MagicMock()
        mock_task.id = "test-task-id"
        mock_delay.return_value = mock_task

        url = f"/api/assessments/{self.assessment.id}/process-ai/"
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["status"], "queued")
        self.assertEqual(response.data["task_id"], "test-task-id")
        mock_delay.assert_called_once_with(self.assessment.id)

    def test_process_ai_endpoint_invalid_status(self):
        """Testa processamento com status inválido."""
        self.assessment.status = RiskAssessment.STATUS_DRAFT
        self.assessment.save()

        url = f"/api/assessments/{self.assessment.id}/process-ai/"
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    @patch('assessments.views.reprocess_assessment.delay')
    def test_reprocess_endpoint(self, mock_delay):
        """Testa endpoint de reprocessamento."""
        self.assessment.status = RiskAssessment.STATUS_ERROR_AI
        self.assessment.save()

        mock_task = MagicMock()
        mock_task.id = "test-task-id"
        mock_delay.return_value = mock_task

        url = f"/api/assessments/{self.assessment.id}/reprocess-ai/"
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["status"], "queued")
        mock_delay.assert_called_once_with(self.assessment.id)

    def test_reprocess_endpoint_not_in_error(self):
        """Testa reprocessamento de avaliação não está em erro."""
        url = f"/api/assessments/{self.assessment.id}/reprocess-ai/"
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_ai_status_endpoint_no_inference(self):
        """Testa endpoint de status sem inferência."""
        url = f"/api/assessments/{self.assessment.id}/ai-status/"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "not_started")

    def test_ai_status_endpoint_with_inference(self):
        """Testa endpoint de status com inferência."""
        inference = AIInferenceResult.objects.create(
            assessment=self.assessment,
            status=AIInferenceResult.STATUS_SUCCEEDED,
            confidence="HIGH",
            result_json={"findings": [{"severity": "HIGH"}]},
        )

        url = f"/api/assessments/{self.assessment.id}/ai-status/"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "succeeded")
        self.assertEqual(response.data["confidence"], "HIGH")


class LifecycleAutoQueueTests(TestCase):
    """Testes para enfileiramento automático no ciclo de vida."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        self.assessment = RiskAssessment.objects.create(
            created_by=self.user,
            title="Test Assessment",
            status=RiskAssessment.STATUS_CAPTURED,
        )

    @patch('assessments.services.process_assessment')
    def test_sync_queues_ai_processing(self, mock_process_task):
        """Testa que sync enfileira processamento de IA automaticamente."""
        mock_delay = MagicMock()
        mock_delay.id = "test-task-id"
        mock_process_task.delay = mock_delay

        AssessmentLifecycleService.sync(self.assessment, self.user)

        mock_delay.assert_called_once_with(self.assessment.id)

    @patch('assessments.services.process_assessment')
    def test_sync_without_queue(self, mock_process_task):
        """Testa sync sem enfileiramento."""
        AssessmentLifecycleService.sync(
            self.assessment, self.user, queue_ai_processing=False
        )

        mock_process_task.delay.assert_not_called()


class AIClientFactoryTests(TestCase):
    """Testes para a factory de cliente de IA."""

    @override_settings(AI_SERVICE_MOCK_MODE=True)
    def test_get_ai_client_mock_mode(self):
        """Testa factory em modo mock."""
        from assessments.ai_client import get_ai_client
        
        client = get_ai_client()
        self.assertIsInstance(client, MockAIClient)

    def test_get_ai_client_default(self):
        """Testa factory padrão (retorna mock enquanto real não implementado)."""
        from assessments.ai_client import get_ai_client
        
        client = get_ai_client()
        self.assertIsInstance(client, MockAIClient)
