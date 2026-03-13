"""
Testes para API administrativa de fila de processamento (BE-02).

Endpoints testados:
- GET /api/admin/processing-jobs/
- GET /api/admin/processing-jobs/?status=failed
- POST /api/admin/processing-jobs/{id}/reprocess/
"""
from unittest.mock import patch, MagicMock

from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from assessments.models import RiskAssessment, AIInferenceResult

User = get_user_model()


class ProcessingJobViewSetTestCase(APITestCase):
    """Testes para o ViewSet de Processing Jobs (Admin)."""
    
    def setUp(self):
        """Configura dados de teste."""
        # Usuários
        self.regular_user = User.objects.create_user(
            email='user@example.com',
            password='testpass123'
        )
        self.admin_user = User.objects.create_user(
            email='admin@example.com',
            password='testpass123',
            is_staff=True
        )
        
        # Avaliações
        self.assessment1 = RiskAssessment.objects.create(
            created_by=self.regular_user,
            title="Assessment 1",
            status=RiskAssessment.STATUS_ERROR_AI
        )
        self.assessment2 = RiskAssessment.objects.create(
            created_by=self.regular_user,
            title="Assessment 2",
            status=RiskAssessment.STATUS_SYNCED
        )
        self.assessment3 = RiskAssessment.objects.create(
            created_by=self.regular_user,
            title="Assessment 3",
            status=RiskAssessment.STATUS_AI_REVIEWED
        )
        
        # Inferências (jobs)
        self.inference_failed = AIInferenceResult.objects.create(
            assessment=self.assessment1,
            status=AIInferenceResult.STATUS_FAILED,
            error_message="API timeout error"
        )
        self.inference_pending = AIInferenceResult.objects.create(
            assessment=self.assessment2,
            status=AIInferenceResult.STATUS_PENDING
        )
        self.inference_succeeded = AIInferenceResult.objects.create(
            assessment=self.assessment3,
            status=AIInferenceResult.STATUS_SUCCEEDED,
            confidence="HIGH",
            model_version="v1.0"
        )
        
        # URL base
        self.list_url = '/api/admin/processing-jobs/'
    
    # =========================================================================
    # Testes de Autorização
    # =========================================================================
    
    def test_list_jobs_unauthenticated_returns_403(self):
        """Usuário não autenticado não deve acessar a lista."""
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_list_jobs_authenticated_non_admin_succeeds(self):
        """Usuário autenticado (não admin) pode listar jobs (GET permitido)."""
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_list_jobs_admin_succeeds(self):
        """Admin pode listar jobs."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_reprocess_non_admin_returns_403(self):
        """Usuário não admin não pode reprocessar jobs."""
        self.client.force_authenticate(user=self.regular_user)
        url = f"{self.list_url}{self.inference_failed.id}/reprocess/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_reprocess_admin_succeeds(self):
        """Admin pode reprocessar jobs falhos."""
        self.client.force_authenticate(user=self.admin_user)
        url = f"{self.list_url}{self.inference_failed.id}/reprocess/"
        
        with patch('assessments.admin_views.reprocess_assessment') as mock_task:
            mock_task.delay.return_value = MagicMock(id='task-123')
            response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
    
    # =========================================================================
    # Testes de Listagem e Filtros
    # =========================================================================
    
    def test_list_returns_all_jobs(self):
        """Lista deve retornar todos os jobs."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.list_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 3)
    
    def test_filter_by_status_failed(self):
        """Filtro ?status=failed deve retornar apenas jobs falhos."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(f"{self.list_url}?status=failed")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['status'], 'failed')
        self.assertEqual(response.data['results'][0]['error_message'], "API timeout error")
    
    def test_filter_by_status_pending(self):
        """Filtro ?status=pending deve retornar apenas jobs pendentes."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(f"{self.list_url}?status=pending")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['status'], 'pending')
    
    def test_filter_by_status_succeeded(self):
        """Filtro ?status=succeeded deve retornar apenas jobs bem-sucedidos."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(f"{self.list_url}?status=succeeded")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['status'], 'succeeded')
    
    def test_filter_case_insensitive(self):
        """Filtro deve ser case-insensitive."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(f"{self.list_url}?status=FAILED")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
    
    def test_list_includes_required_fields(self):
        """Lista deve incluir campos necessários para o frontend."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.list_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        job = response.data['results'][0]
        required_fields = [
            'id', 'assessment_id', 'assessment_title', 'status', 'status_display',
            'error_message', 'created_at', 'updated_at', 'started_at', 'finished_at',
            'confidence', 'model_version'
        ]
        for field in required_fields:
            self.assertIn(field, job)
    
    def test_retrieve_single_job(self):
        """Deve retornar detalhes de um job específico."""
        self.client.force_authenticate(user=self.admin_user)
        url = f"{self.list_url}{self.inference_failed.id}/"
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.inference_failed.id)
        self.assertEqual(response.data['assessment_id'], self.assessment1.id)
        self.assertEqual(response.data['status'], 'failed')
    
    # =========================================================================
    # Testes de Reprocessamento
    # =========================================================================
    
    @patch('assessments.admin_views.reprocess_assessment')
    def test_reprocess_failed_job_updates_status(self, mock_task):
        """Reprocessar job falho deve atualizar status e enfileirar task."""
        mock_task.delay.return_value = MagicMock(id='task-abc-123')
        
        self.client.force_authenticate(user=self.admin_user)
        url = f"{self.list_url}{self.inference_failed.id}/reprocess/"
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data['status'], 'queued')
        self.assertEqual(response.data['previous_status'], 'failed')
        self.assertEqual(response.data['task_id'], 'task-abc-123')
        
        # Verificar se a task foi chamada
        mock_task.delay.assert_called_once_with(self.assessment1.id)
    
    def test_reprocess_non_failed_job_returns_400(self):
        """Não deve reprocessar job que não está em estado failed."""
        self.client.force_authenticate(user=self.admin_user)
        url = f"{self.list_url}{self.inference_pending.id}/reprocess/"
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertIn('pending', response.data['error'])
    
    def test_reprocess_succeeded_job_returns_400(self):
        """Não deve reprocessar job que já foi bem-sucedido."""
        self.client.force_authenticate(user=self.admin_user)
        url = f"{self.list_url}{self.inference_succeeded.id}/reprocess/"
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
    
    def test_reprocess_nonexistent_job_returns_404(self):
        """Reprocessar job inexistente deve retornar 404."""
        self.client.force_authenticate(user=self.admin_user)
        url = f"{self.list_url}99999/reprocess/"
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    @patch('assessments.admin_views.reprocess_assessment')
    def test_reprocess_resets_inference_status(self, mock_task):
        """Reprocessar deve resetar o status da inferência para pending."""
        mock_task.delay.return_value = MagicMock(id='task-xyz')
        
        self.client.force_authenticate(user=self.admin_user)
        url = f"{self.list_url}{self.inference_failed.id}/reprocess/"
        
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        
        # Recarregar do banco
        self.inference_failed.refresh_from_db()
        self.assertEqual(self.inference_failed.status, AIInferenceResult.STATUS_PENDING)
        self.assertEqual(self.inference_failed.error_message, "")
    
    @patch('assessments.admin_views.AssessmentLifecycleService')
    def test_reprocess_uses_lifecycle_service(self, mock_service):
        """Reprocessar deve usar AssessmentLifecycleService para transição."""
        self.client.force_authenticate(user=self.admin_user)
        url = f"{self.list_url}{self.inference_failed.id}/reprocess/"
        
        with patch('assessments.admin_views.reprocess_assessment') as mock_task:
            mock_task.delay.return_value = MagicMock(id='task-123')
            response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        mock_service.reprocess_ai.assert_called_once()
    
    # =========================================================================
    # Testes de Ordenação
    # =========================================================================
    
    def test_list_ordered_by_created_at_desc(self):
        """Lista deve estar ordenada por created_at decrescente."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.list_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results']
        
        # Verificar ordenação (mais recente primeiro)
        for i in range(len(results) - 1):
            self.assertGreaterEqual(
                results[i]['created_at'],
                results[i + 1]['created_at']
            )
