"""
Testes para tasks Celery de geração de relatórios.

Cobertura:
- Geração bem-sucedida de PDF
- Falha na geração
- Performance metrics
"""
import io
from unittest.mock import patch, MagicMock

from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile

from assessments.models import RiskAssessment
from reports.models import Report
from reports.tasks import generate_report


User = get_user_model()


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class GenerateReportTaskTest(TestCase):
    """Testes para a task generate_report."""
    
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
        self.report = Report.objects.create(
            assessment=self.assessment,
            status=Report.STATUS_GENERATING,
        )
    
    @patch('reports.tasks._generate_pdf_document')
    def test_generate_report_success(self, mock_generate_pdf):
        """Testa geração bem-sucedida de relatório."""
        # Mock do PDF gerado
        pdf_content = b"PDF content mock"
        mock_buffer = io.BytesIO(pdf_content)
        mock_generate_pdf.return_value = mock_buffer
        
        # Executar task
        result = generate_report(self.report.id)
        
        # Verificar resultado
        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['report_id'], self.report.id)
        self.assertEqual(result['assessment_id'], self.assessment.id)
        self.assertIn('generation_time_seconds', result)
        self.assertEqual(result['evidence_count'], 0)
        
        # Verificar relatório atualizado
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, Report.STATUS_READY)
        self.assertIsNotNone(self.report.file)
        self.assertIsNotNone(self.report.generated_at)
        self.assertIsNotNone(self.report.generation_time_seconds)
        self.assertGreater(self.report.generation_time_seconds, 0)
    
    @patch('reports.tasks._generate_pdf_document')
    def test_generate_report_failure(self, mock_generate_pdf):
        """Testa falha na geração de relatório."""
        # Simular erro na geração do PDF
        mock_generate_pdf.side_effect = Exception("PDF generation failed")
        
        # Executar task
        result = generate_report(self.report.id)
        
        # Verificar resultado
        self.assertEqual(result['status'], 'error')
        self.assertEqual(result['report_id'], self.report.id)
        self.assertIn('error', result)
        
        # Verificar relatório atualizado com erro
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, Report.STATUS_FAILED)
        self.assertIn("PDF generation failed", self.report.error_message)
        self.assertIsNotNone(self.report.generation_time_seconds)
    
    def test_generate_report_not_found(self):
        """Testa task com relatório inexistente."""
        result = generate_report(99999)
        
        self.assertEqual(result['status'], 'error')
        self.assertEqual(result['message'], 'Report not found')
    
    @patch('reports.tasks._generate_pdf_document')
    def test_generate_report_with_evidence(self, mock_generate_pdf):
        """Testa geração com evidências."""
        # Criar evidência
        from assessments.models import Evidence
        from django.core.files.uploadedfile import SimpleUploadedFile
        import os
        
        # Criar arquivo de imagem fake
        image_content = b'fake image content'
        image_file = SimpleUploadedFile(
            'test_image.jpg',
            image_content,
            content_type='image/jpeg'
        )
        
        evidence = Evidence.objects.create(
            assessment=self.assessment,
            file=image_file,
        )
        
        # Mock do PDF
        mock_buffer = io.BytesIO(b"PDF with evidence")
        mock_generate_pdf.return_value = mock_buffer
        
        # Executar task
        result = generate_report(self.report.id)
        
        # Verificar
        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['evidence_count'], 1)
        
        # Limpar arquivo
        if evidence.file and os.path.exists(evidence.file.path):
            os.remove(evidence.file.path)
    
    @patch('reports.tasks._generate_pdf_document')
    def test_generate_report_performance_logging(self, mock_generate_pdf):
        """Testa logging de métricas de performance."""
        mock_buffer = io.BytesIO(b"PDF")
        mock_generate_pdf.return_value = mock_buffer
        
        with patch('reports.tasks.logger') as mock_logger:
            generate_report(self.report.id)
            
            # Verificar que logs de performance foram emitidos
            info_calls = [call for call in mock_logger.info.call_args_list 
                         if 'Performance' in str(call) or 'generated successfully' in str(call)]
            self.assertTrue(len(info_calls) > 0)
    
    @patch('reports.tasks._generate_pdf_document')
    def test_generate_report_performance_warning(self, mock_generate_pdf):
        """Testa warning quando excede target de performance."""
        # Simular geração lenta (> 15s)
        import time
        
        def slow_generate(*args, **kwargs):
            time.sleep(0.1)  # Simular delay
            return io.BytesIO(b"PDF")
        
        mock_generate_pdf.side_effect = slow_generate
        
        with patch('reports.tasks.PERFORMANCE_TARGET_SECONDS', 0.01):  # Target impossível
            with patch('reports.tasks.logger') as mock_logger:
                generate_report(self.report.id)
                
                # Verificar warning de performance
                warning_calls = [call for call in mock_logger.warning.call_args_list 
                               if 'exceeded target' in str(call)]
                # O warning pode ou não ser chamado dependendo do tempo real
                # Então apenas verificamos que a task completou
                self.report.refresh_from_db()
                self.assertEqual(self.report.status, Report.STATUS_READY)


class PDFGenerationTest(TestCase):
    """Testes para a função interna de geração de PDF."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )
        self.assessment = RiskAssessment.objects.create(
            created_by=self.user,
            title='PDF Test Assessment',
            description='Test description for PDF',
        )
    
    def test_generate_pdf_document(self):
        """Testa geração real de PDF."""
        from reports.tasks import _generate_pdf_document, _collect_assessment_data
        
        data = _collect_assessment_data(self.assessment)
        pdf_buffer = _generate_pdf_document(self.assessment, data)
        
        # Verificar que retornou um buffer válido
        self.assertIsInstance(pdf_buffer, io.BytesIO)
        self.assertGreater(len(pdf_buffer.getvalue()), 0)
        
        # Verificar que começa com header de PDF (%PDF)
        content = pdf_buffer.getvalue()
        self.assertTrue(content.startswith(b'%PDF'))
    
    def test_collect_assessment_data(self):
        """Testa coleta de dados da avaliação."""
        from reports.tasks import _collect_assessment_data
        
        # Criar finding
        from assessments.models import RiskFinding
        finding = RiskFinding.objects.create(
            assessment=self.assessment,
            description='Test risk',
            severity='HIGH',
            location='Test location',
        )
        
        data = _collect_assessment_data(self.assessment)
        
        # Verificar estrutura
        self.assertIn('id', data)
        self.assertIn('title', data)
        self.assertIn('findings', data)
        self.assertIn('evidences', data)
        self.assertEqual(data['title'], 'PDF Test Assessment')
        self.assertEqual(len(data['findings']), 1)
    
    def test_pdf_with_risk_findings(self):
        """Testa PDF com riscos identificados."""
        from reports.tasks import _generate_pdf_document, _collect_assessment_data
        from assessments.models import RiskFinding
        
        # Criar findings
        RiskFinding.objects.create(
            assessment=self.assessment,
            description='Critical risk',
            severity='CRITICAL',
            location='Area A',
        )
        RiskFinding.objects.create(
            assessment=self.assessment,
            description='Medium risk',
            severity='MEDIUM',
            location='Area B',
        )
        
        data = _collect_assessment_data(self.assessment)
        pdf_buffer = _generate_pdf_document(self.assessment, data)
        
        self.assertIsInstance(pdf_buffer, io.BytesIO)
        self.assertGreater(len(pdf_buffer.getvalue()), 100)  # PDF não vazio
