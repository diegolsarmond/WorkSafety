"""
Testes para API de relatórios.

Cobertura:
- GET /api/admin/reports/ - Listagem
- POST /api/admin/assessments/{id}/generate-report/ - Geração
- GET /api/admin/reports/{id}/ - Detalhes
- POST /api/admin/assessments/{id}/regenerate-report/ - Regeneração
- Autorização: GET autenticado, POST admin
"""
from unittest.mock import patch, MagicMock

from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

from assessments.models import RiskAssessment
from reports.models import Report


User = get_user_model()


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class ReportAPITest(TestCase):
    """Testes para endpoints de relatórios."""
    
    def setUp(self):
        self.client = APIClient()
        
        # Usuários
        self.regular_user = User.objects.create_user(
            email='user@example.com',
            password='userpass123'
        )
        self.admin_user = User.objects.create_user(
            email='admin@example.com',
            password='adminpass123',
            is_staff=True
        )
        self.superuser = User.objects.create_superuser(
            email='super@example.com',
            password='superpass123'
        )
        
        # Avaliação
        self.assessment = RiskAssessment.objects.create(
            created_by=self.regular_user,
            title='Test Assessment',
            description='Test description',
        )
        
        # Relatórios
        self.report1 = Report.objects.create(
            assessment=self.assessment,
            status=Report.STATUS_READY,
        )
        self.report2 = Report.objects.create(
            assessment=self.assessment,
            status=Report.STATUS_FAILED,
            error_message="Generation failed",
        )
    
    def _authenticate(self, user):
        """Helper para autenticar usuário."""
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    
    # ==================== TESTES DE LISTAGEM ====================
    
    def test_list_reports_authenticated(self):
        """Testa listagem de relatórios por usuário autenticado."""
        self._authenticate(self.regular_user)
        
        url = reverse('report-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
    
    def test_list_reports_unauthenticated(self):
        """Testa que listagem requer autenticação."""
        url = reverse('report-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_list_reports_filter_by_assessment(self):
        """Testa filtro por assessment_id."""
        self._authenticate(self.regular_user)
        
        # Criar outra avaliação e relatório
        other_assessment = RiskAssessment.objects.create(
            created_by=self.regular_user,
            title='Other Assessment',
        )
        Report.objects.create(
            assessment=other_assessment,
            status=Report.STATUS_READY,
        )
        
        url = reverse('report-list')
        response = self.client.get(url, {'assessment_id': self.assessment.id})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)  # Apenas relatórios da assessment filtrada
    
    def test_list_reports_filter_by_status(self):
        """Testa filtro por status."""
        self._authenticate(self.regular_user)
        
        url = reverse('report-list')
        response = self.client.get(url, {'status': 'ready'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['status'], 'ready')
    
    # ==================== TESTES DE DETALHES ====================
    
    def test_get_report_detail(self):
        """Testa obter detalhes de um relatório."""
        self._authenticate(self.regular_user)
        
        url = reverse('report-detail', kwargs={'report_id': self.report1.id})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.report1.id)
        self.assertEqual(response.data['status'], 'ready')
        self.assertEqual(response.data['assessment_id'], self.assessment.id)
        self.assertIn('created_at', response.data)
        self.assertIn('file_url', response.data)
    
    def test_get_report_detail_not_found(self):
        """Testa relatório inexistente."""
        self._authenticate(self.regular_user)
        
        url = reverse('report-detail', kwargs={'report_id': 99999})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    # ==================== TESTES DE GERAÇÃO ====================
    
    @patch('reports.views.generate_report.delay')
    def test_generate_report_admin(self, mock_task):
        """Testa geração de relatório por admin."""
        mock_task.return_value = MagicMock(id='task-123')
        self._authenticate(self.admin_user)
        
        url = reverse('generate-report', kwargs={'assessment_id': self.assessment.id})
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data['status'], 'generating')
        self.assertIn('report_id', response.data)
        self.assertEqual(response.data['task_id'], 'task-123')
        
        # Verificar que a task foi chamada
        mock_task.assert_called_once()
    
    @patch('reports.views.generate_report.delay')
    def test_generate_report_superuser(self, mock_task):
        """Testa geração de relatório por superuser."""
        mock_task.return_value = MagicMock(id='task-456')
        self._authenticate(self.superuser)
        
        url = reverse('generate-report', kwargs={'assessment_id': self.assessment.id})
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        mock_task.assert_called_once()
    
    def test_generate_report_regular_user(self):
        """Testa que usuário comum não pode gerar relatório."""
        self._authenticate(self.regular_user)
        
        url = reverse('generate-report', kwargs={'assessment_id': self.assessment.id})
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_generate_report_unauthenticated(self):
        """Testa que geração requer autenticação."""
        url = reverse('generate-report', kwargs={'assessment_id': self.assessment.id})
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    @patch('reports.views.generate_report.delay')
    def test_generate_report_assessment_not_found(self, mock_task):
        """Testa geração para avaliação inexistente."""
        mock_task.return_value = MagicMock(id='task-789')
        self._authenticate(self.admin_user)
        
        url = reverse('generate-report', kwargs={'assessment_id': 99999})
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    @patch('reports.views.generate_report.delay')
    def test_generate_report_already_generating(self, mock_task):
        """Testa comportamento quando já existe geração em andamento."""
        mock_task.return_value = MagicMock(id='task-000')
        self._authenticate(self.admin_user)
        
        # Criar relatório em geração
        generating_report = Report.objects.create(
            assessment=self.assessment,
            status=Report.STATUS_GENERATING,
        )
        
        url = reverse('generate-report', kwargs={'assessment_id': self.assessment.id})
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data['report_id'], generating_report.id)
        self.assertIsNone(response.data['task_id'])  # Não deve enfileirar nova task
        mock_task.assert_not_called()
    
    # ==================== TESTES DE REGENERAÇÃO ====================
    
    @patch('reports.views.generate_report.delay')
    def test_regenerate_report_admin(self, mock_task):
        """Testa regeneração de relatório por admin."""
        mock_task.return_value = MagicMock(id='task-regen')
        self._authenticate(self.admin_user)
        
        url = reverse('regenerate-report', kwargs={'assessment_id': self.assessment.id})
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data['status'], 'generating')
        mock_task.assert_called_once()
        
        # Deve criar novo relatório, mesmo que exista um pronto
        self.assertEqual(Report.objects.filter(assessment=self.assessment).count(), 3)
    
    def test_regenerate_report_regular_user(self):
        """Testa que usuário comum não pode regenerar relatório."""
        self._authenticate(self.regular_user)
        
        url = reverse('regenerate-report', kwargs={'assessment_id': self.assessment.id})
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    # ==================== TESTES DE SERIALIZAÇÃO ====================
    
    def test_report_serializer_fields(self):
        """Testa campos retornados pelo serializer."""
        self._authenticate(self.regular_user)
        
        url = reverse('report-detail', kwargs={'report_id': self.report1.id})
        response = self.client.get(url)
        
        # Campos esperados pelo frontend (Reports.tsx)
        expected_fields = {
            'id', 'assessment_id', 'status', 'status_display',
            'file_url', 'error_message', 'generation_time_seconds',
            'generated_at', 'created_at', 'updated_at'
        }
        
        self.assertEqual(set(response.data.keys()), expected_fields)
