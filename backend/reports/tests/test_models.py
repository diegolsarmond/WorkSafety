"""
Testes para modelos do app reports.
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone

from assessments.models import RiskAssessment
from reports.models import Report


User = get_user_model()


class ReportModelTest(TestCase):
    """Testes para o modelo Report."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )
        self.assessment = RiskAssessment.objects.create(
            created_by=self.user,
            title='Test Assessment',
            description='Test description',
        )
    
    def test_report_creation(self):
        """Testa criação básica de um relatório."""
        report = Report.objects.create(
            assessment=self.assessment,
            status=Report.STATUS_GENERATING,
        )
        
        self.assertEqual(report.assessment, self.assessment)
        self.assertEqual(report.status, Report.STATUS_GENERATING)
        self.assertIsNotNone(report.created_at)
        self.assertIsNotNone(report.updated_at)
    
    def test_report_status_choices(self):
        """Testa os status possíveis do relatório."""
        # Test generating status
        report_gen = Report.objects.create(
            assessment=self.assessment,
            status=Report.STATUS_GENERATING,
        )
        self.assertEqual(report_gen.get_status_display(), "Gerando")
        
        # Test ready status
        report_ready = Report.objects.create(
            assessment=self.assessment,
            status=Report.STATUS_READY,
        )
        self.assertEqual(report_ready.get_status_display(), "Pronto")
        
        # Test failed status
        report_failed = Report.objects.create(
            assessment=self.assessment,
            status=Report.STATUS_FAILED,
            error_message="Test error",
        )
        self.assertEqual(report_failed.get_status_display(), "Falhou")
        self.assertEqual(report_failed.error_message, "Test error")
    
    def test_report_ordering(self):
        """Testa ordenação por created_at decrescente."""
        report1 = Report.objects.create(
            assessment=self.assessment,
            status=Report.STATUS_READY,
        )
        report2 = Report.objects.create(
            assessment=self.assessment,
            status=Report.STATUS_READY,
        )
        
        reports = list(Report.objects.all())
        self.assertEqual(reports[0], report2)  # Mais recente primeiro
        self.assertEqual(reports[1], report1)
    
    def test_file_url_property(self):
        """Testa a propriedade file_url."""
        report = Report.objects.create(
            assessment=self.assessment,
            status=Report.STATUS_READY,
        )
        
        # Sem arquivo, deve retornar None
        self.assertIsNone(report.file_url)
    
    def test_report_string_representation(self):
        """Testa a representação em string do relatório."""
        report = Report.objects.create(
            assessment=self.assessment,
            status=Report.STATUS_GENERATING,
        )
        
        expected = f"Relatório #{report.pk} (Avaliação {self.assessment.id}) - Gerando"
        self.assertEqual(str(report), expected)
    
    def test_report_generation_time(self):
        """Testa armazenamento do tempo de geração."""
        report = Report.objects.create(
            assessment=self.assessment,
            status=Report.STATUS_READY,
            generation_time_seconds=12.345,
        )
        
        self.assertEqual(report.generation_time_seconds, 12.345)
    
    def test_related_name(self):
        """Testa o related_name 'reports' em RiskAssessment."""
        report = Report.objects.create(
            assessment=self.assessment,
            status=Report.STATUS_READY,
        )
        
        self.assertIn(report, self.assessment.reports.all())
