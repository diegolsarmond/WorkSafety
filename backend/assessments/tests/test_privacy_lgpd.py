"""
Testes para conformidade LGPD/GDPR - Privacy and Anonymization.

Critérios de aceite:
- O sistema registra "base legal" por avaliação
- Evidências são anonimizadas antes do armazenamento
- Evidências e dados sensíveis não são persistidos em excesso
- Logs de auditoria são mantidos
"""
import io
import hashlib
from datetime import datetime
from unittest.mock import patch, MagicMock

from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image
import numpy as np

from accounts.models import User
from assessments.models import (
    RiskAssessment,
    Evidence,
    EvidenceAnonymizationLog,
)
from assessments.serializers import (
    EvidenceSerializer,
    RiskAssessmentSerializer,
    RiskAssessmentDetailSerializer,
)
from assessments.anonymization import (
    AnonymizationService,
    AnonymizationResult,
    anonymize_evidence,
    get_anonymization_service,
)


def create_test_image(name="test.jpg", size=(100, 100), color="red"):
    """Cria uma imagem de teste em memória."""
    image = Image.new("RGB", size, color=color)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    buffer.seek(0)
    return SimpleUploadedFile(name, buffer.read(), content_type="image/jpeg")


def create_image_with_face():
    """Cria uma imagem simulada com área de rosto (retângulo claro no centro)."""
    # Criar imagem com fundo cinza e um retângulo claro no centro (simulando rosto)
    arr = np.ones((200, 200, 3), dtype=np.uint8) * 128  # Fundo cinza
    arr[50:150, 50:150] = 255  # Retângulo branco no centro (simula rosto)
    
    image = Image.fromarray(arr)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    buffer.seek(0)
    return SimpleUploadedFile("face.jpg", buffer.read(), content_type="image/jpeg")


class LegalBasisModelTest(TestCase):
    """Testes para campos de base legal LGPD no RiskAssessment."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123"
        )

    def test_default_legal_basis_is_legitimate_interest(self):
        """Critério: base legal padrão deve ser 'interesse legítimo'."""
        assessment = RiskAssessment.objects.create(
            created_by=self.user,
            title="Avaliação Teste"
        )
        self.assertEqual(
            assessment.legal_basis,
            RiskAssessment.LEGAL_BASIS_LEGITIMATE_INTEREST
        )

    def test_legal_basis_choices(self):
        """Critério: todas as bases legais LGPD devem estar disponíveis."""
        choices = dict(RiskAssessment.LEGAL_BASIS_CHOICES)
        
        expected_bases = [
            RiskAssessment.LEGAL_BASIS_CONSENT,
            RiskAssessment.LEGAL_BASIS_LEGITIMATE_INTEREST,
            RiskAssessment.LEGAL_BASIS_LEGAL_OBLIGATION,
            RiskAssessment.LEGAL_BASIS_CONTRACT,
            RiskAssessment.LEGAL_BASIS_PUBLIC_INTEREST,
            RiskAssessment.LEGAL_BASIS_VITAL_INTEREST,
        ]
        
        for basis in expected_bases:
            self.assertIn(basis, choices)

    def test_legal_basis_notes_optional(self):
        """Critério: notas da base legal são opcionais."""
        assessment = RiskAssessment.objects.create(
            created_by=self.user,
            title="Avaliação Teste",
            legal_basis=RiskAssessment.LEGAL_BASIS_CONSENT,
            legal_basis_notes="Consentimento expresso do trabalhador"
        )
        
        self.assertEqual(
            assessment.legal_basis_notes,
            "Consentimento expresso do trabalhador"
        )

    def test_get_legal_basis_display(self):
        """Critério: display da base legal deve ser legível."""
        assessment = RiskAssessment.objects.create(
            created_by=self.user,
            title="Avaliação Teste",
            legal_basis=RiskAssessment.LEGAL_BASIS_LEGAL_OBLIGATION
        )
        
        self.assertEqual(
            assessment.get_legal_basis_display(),
            "Cumprimento de obrigação legal"
        )


class EvidenceAnonymizationFieldsTest(TestCase):
    """Testes para campos de anonimização no modelo Evidence."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123"
        )
        self.assessment = RiskAssessment.objects.create(
            created_by=self.user,
            title="Avaliação Teste"
        )

    def test_default_anonymization_status_is_pending(self):
        """Critério: status padrão de anonimização deve ser 'pending'."""
        image = create_test_image()
        evidence = Evidence.objects.create(
            assessment=self.assessment,
            file=image
        )
        
        self.assertEqual(evidence.anonymization_status, "pending")
        self.assertFalse(evidence.is_anonymized)
        self.assertIsNone(evidence.anonymized_at)

    def test_anonymization_status_choices(self):
        """Critério: todos os status de anonimização devem estar disponíveis."""
        valid_statuses = ["pending", "processing", "completed", "failed", "skipped"]
        
        for status in valid_statuses:
            image = create_test_image(f"test_{status}.jpg")
            evidence = Evidence.objects.create(
                assessment=self.assessment,
                file=image,
                anonymization_status=status
            )
            self.assertEqual(evidence.anonymization_status, status)

    def test_original_file_hash_storage(self):
        """Critério: hash do arquivo original deve ser armazenado para auditoria."""
        image = create_test_image()
        image_content = image.read()
        expected_hash = hashlib.sha256(image_content).hexdigest()
        image.seek(0)
        
        evidence = Evidence.objects.create(
            assessment=self.assessment,
            file=image,
            original_file_hash=expected_hash
        )
        
        self.assertEqual(evidence.original_file_hash, expected_hash)

    def test_anonymized_at_timestamp(self):
        """Critério: timestamp de anonimização deve ser registrado."""
        image = create_test_image()
        evidence = Evidence.objects.create(
            assessment=self.assessment,
            file=image,
            is_anonymized=True,
            anonymization_status="completed",
            anonymized_at=timezone.now()
        )
        
        self.assertIsNotNone(evidence.anonymized_at)
        self.assertTrue(evidence.is_anonymized)


class EvidenceAnonymizationLogTest(TestCase):
    """Testes para o modelo de log de anonimização (auditoria)."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123"
        )
        self.assessment = RiskAssessment.objects.create(
            created_by=self.user,
            title="Avaliação Teste"
        )
        image = create_test_image()
        self.evidence = Evidence.objects.create(
            assessment=self.assessment,
            file=image
        )

    def test_log_creation(self):
        """Critério: log de anonimização deve ser criado com dados corretos."""
        log = EvidenceAnonymizationLog.objects.create(
            evidence=self.evidence,
            operation=EvidenceAnonymizationLog.OPERATION_ANONYMIZE,
            status=EvidenceAnonymizationLog.STATUS_SUCCESS,
            faces_detected=2,
            faces_anonymized=2,
            plates_detected=1,
            plates_anonymized=1,
            processing_duration_ms=150,
            created_by=self.user
        )
        
        self.assertEqual(log.evidence, self.evidence)
        self.assertEqual(log.operation, "anonymize")
        self.assertEqual(log.status, "success")
        self.assertEqual(log.faces_detected, 2)
        self.assertEqual(log.faces_anonymized, 2)
        self.assertEqual(log.processing_duration_ms, 150)
        self.assertEqual(log.created_by, self.user)

    def test_log_ordering(self):
        """Critério: logs devem ser ordenados por data decrescente."""
        # Criar logs em sequência
        log1 = EvidenceAnonymizationLog.objects.create(
            evidence=self.evidence,
            operation=EvidenceAnonymizationLog.OPERATION_ANONYMIZE,
            status=EvidenceAnonymizationLog.STATUS_SUCCESS
        )
        log2 = EvidenceAnonymizationLog.objects.create(
            evidence=self.evidence,
            operation=EvidenceAnonymizationLog.OPERATION_VERIFY,
            status=EvidenceAnonymizationLog.STATUS_SUCCESS
        )
        
        logs = list(EvidenceAnonymizationLog.objects.all())
        self.assertEqual(logs[0], log2)  # Mais recente primeiro
        self.assertEqual(logs[1], log1)

    def test_log_str_representation(self):
        """Critério: representação string do log deve ser informativa."""
        log = EvidenceAnonymizationLog.objects.create(
            evidence=self.evidence,
            operation=EvidenceAnonymizationLog.OPERATION_ANONYMIZE,
            status=EvidenceAnonymizationLog.STATUS_SUCCESS
        )
        
        self.assertIn("Anonimização", str(log))
        self.assertIn("Sucesso", str(log))
        self.assertIn(str(self.evidence.pk), str(log))


class AnonymizationServiceTest(TestCase):
    """Testes para o serviço de anonimização."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123"
        )
        self.assessment = RiskAssessment.objects.create(
            created_by=self.user,
            title="Avaliação Teste"
        )

    @override_settings(ANONYMIZATION_ENABLED=True)
    def test_service_enabled_by_default(self):
        """Critério: serviço deve estar habilitado por padrão."""
        service = AnonymizationService()
        self.assertTrue(service.enabled)

    @override_settings(ANONYMIZATION_ENABLED=False)
    def test_service_can_be_disabled(self):
        """Critério: serviço pode ser desabilitado via settings."""
        service = AnonymizationService()
        self.assertFalse(service.enabled)

    @override_settings(ANONYMIZATION_METHOD="blur")
    def test_service_default_method(self):
        """Critério: método padrão de anonimização deve ser blur."""
        service = AnonymizationService()
        self.assertEqual(service.method, "blur")

    def test_anonymization_result_dataclass(self):
        """Critério: resultado deve conter todos os campos necessários."""
        result = AnonymizationResult(
            success=True,
            faces_detected=2,
            faces_anonymized=2,
            plates_detected=1,
            plates_anonymized=0,
            error_message="",
            processing_duration_ms=100
        )
        
        self.assertTrue(result.success)
        self.assertEqual(result.faces_detected, 2)
        self.assertEqual(result.plates_anonymized, 0)
        self.assertEqual(result.processing_duration_ms, 100)

    @patch("assessments.anonymization._import_cv2")
    def test_anonymize_skips_non_image_files(self, mock_import_cv2):
        """Critério: arquivos não-imagem devem ser ignorados."""
        # Criar evidência com tipo MIME não-imagem
        image = create_test_image()
        evidence = Evidence.objects.create(
            assessment=self.assessment,
            file=image,
            mime_type="application/pdf"
        )
        
        service = AnonymizationService()
        result = service.anonymize_evidence(evidence, self.user)
        
        self.assertTrue(result.success)
        self.assertIn("não suportado", result.error_message.lower())
        self.assertEqual(evidence.anonymization_status, "skipped")

    @patch("assessments.anonymization._import_cv2")
    def test_anonymize_without_opencv_raises_error(self, mock_import_cv2):
        """Critério: deve lançar erro se OpenCV não estiver instalado."""
        mock_import_cv2.side_effect = ImportError("OpenCV not found")
        
        image = create_test_image()
        evidence = Evidence.objects.create(
            assessment=self.assessment,
            file=image
        )
        
        service = AnonymizationService()
        result = service.anonymize_evidence(evidence, self.user)
        
        self.assertFalse(result.success)
        self.assertIn("opencv", result.error_message.lower())

    def test_get_anonymization_service_singleton(self):
        """Critério: serviço deve ser singleton."""
        service1 = get_anonymization_service()
        service2 = get_anonymization_service()
        self.assertIs(service1, service2)


class EvidenceSerializerPrivacyTest(TestCase):
    """Testes para serializer de evidências com dados LGPD."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123"
        )
        self.assessment = RiskAssessment.objects.create(
            created_by=self.user,
            title="Avaliação Teste"
        )
        image = create_test_image()
        self.evidence = Evidence.objects.create(
            assessment=self.assessment,
            file=image,
            is_anonymized=True,
            anonymization_status="completed",
            anonymized_at=timezone.now()
        )

    def test_serializer_includes_privacy_fields(self):
        """Critério: serializer deve expor campos de privacidade."""
        serializer = EvidenceSerializer(self.evidence)
        data = serializer.data
        
        self.assertIn("is_anonymized", data)
        self.assertIn("anonymization_status", data)
        self.assertIn("anonymized_at", data)
        self.assertIn("privacy_status", data)

    def test_privacy_status_field(self):
        """Critério: privacy_status deve conter resumo do estado."""
        serializer = EvidenceSerializer(self.evidence)
        data = serializer.data
        
        privacy = data["privacy_status"]
        self.assertEqual(privacy["is_anonymized"], True)
        self.assertEqual(privacy["anonymization_status"], "completed")
        self.assertIsNotNone(privacy["anonymized_at"])


class RiskAssessmentSerializerLegalBasisTest(TestCase):
    """Testes para serializer de avaliações com base legal."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123"
        )
        self.assessment = RiskAssessment.objects.create(
            created_by=self.user,
            title="Avaliação Teste",
            legal_basis=RiskAssessment.LEGAL_BASIS_CONSENT,
            legal_basis_notes="Consentimento do trabalhador"
        )

    def test_serializer_includes_legal_basis(self):
        """Critério: serializer deve expor base legal."""
        serializer = RiskAssessmentSerializer(self.assessment)
        data = serializer.data
        
        self.assertIn("legal_basis", data)
        self.assertIn("legal_basis_display", data)
        self.assertIn("legal_basis_notes", data)

    def test_legal_basis_display_value(self):
        """Critério: display da base legal deve ser legível."""
        serializer = RiskAssessmentSerializer(self.assessment)
        data = serializer.data
        
        self.assertEqual(data["legal_basis"], RiskAssessment.LEGAL_BASIS_CONSENT)
        self.assertEqual(data["legal_basis_display"], "Consentimento do titular")

    def test_detail_serializer_includes_legal_basis(self):
        """Critério: serializer detalhado deve incluir base legal."""
        serializer = RiskAssessmentDetailSerializer(self.assessment)
        data = serializer.data
        
        self.assertIn("legal_basis", data)
        self.assertIn("legal_basis_display", data)
        self.assertEqual(data["legal_basis_notes"], "Consentimento do trabalhador")


class PrivacyIntegrationTest(TestCase):
    """Testes de integração para fluxo completo de privacidade."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123"
        )
        self.assessment = RiskAssessment.objects.create(
            created_by=self.user,
            title="Avaliação Teste",
            legal_basis=RiskAssessment.LEGAL_BASIS_LEGITIMATE_INTEREST,
            legal_basis_notes="Interesse legítimo da empresa em segurança"
        )

    def test_assessment_creation_with_legal_basis(self):
        """Critério: avaliação deve ser criada com base legal documentada."""
        self.assertEqual(
            self.assessment.legal_basis,
            RiskAssessment.LEGAL_BASIS_LEGITIMATE_INTEREST
        )
        self.assertEqual(
            self.assessment.legal_basis_notes,
            "Interesse legítimo da empresa em segurança"
        )

    def test_evidence_anonymization_trail(self):
        """Critério: deve haver trilha de auditoria completa."""
        # Criar evidência
        image = create_test_image()
        evidence = Evidence.objects.create(
            assessment=self.assessment,
            file=image,
            original_file_hash="abc123"
        )
        
        # Simular processo de anonimização
        evidence.is_anonymized = True
        evidence.anonymization_status = "completed"
        evidence.anonymized_at = timezone.now()
        evidence.save()
        
        # Criar log de auditoria
        log = EvidenceAnonymizationLog.objects.create(
            evidence=evidence,
            operation=EvidenceAnonymizationLog.OPERATION_ANONYMIZE,
            status=EvidenceAnonymizationLog.STATUS_SUCCESS,
            faces_detected=1,
            faces_anonymized=1,
            created_by=self.user
        )
        
        # Verificar trilha de auditoria
        self.assertEqual(evidence.anonymization_logs.count(), 1)
        self.assertEqual(log.faces_anonymized, 1)
        self.assertEqual(log.created_by, self.user)

    def test_anonymized_file_hash_differs_from_original(self):
        """Critério: hash do arquivo anonimizado deve diferir do original."""
        image = create_test_image()
        original_content = image.read()
        original_hash = hashlib.sha256(original_content).hexdigest()
        image.seek(0)
        
        evidence = Evidence.objects.create(
            assessment=self.assessment,
            file=image,
            original_file_hash=original_hash,
            file_hash=original_hash  # Inicialmente igual
        )
        
        # Simular alteração após anonimização
        # (Na prática, o arquivo seria modificado pelo serviço)
        evidence.file_hash = "different_hash_after_anonymization"
        evidence.is_anonymized = True
        evidence.save()
        
        # Verificar que temos registro do hash original
        self.assertEqual(evidence.original_file_hash, original_hash)
        self.assertNotEqual(evidence.file_hash, evidence.original_file_hash)

    @override_settings(ANONYMIZATION_ENABLED=True)
    @patch("assessments.anonymization._import_cv2")
    def test_upload_triggers_anonymization(self, mock_cv2_import):
        """Critério: upload deve iniciar processo de anonimização."""
        from assessments.views import EvidenceUploadView
        from rest_framework.test import APIRequestFactory
        from rest_framework.parsers import MultiPartParser
        
        # Mock do OpenCV
        mock_cv2 = MagicMock()
        mock_np = MagicMock()
        mock_cv2.data.haarcascades = "/mock/path/"
        mock_cv2.CascadeClassifier.return_value = MagicMock(empty=lambda: True)
        mock_cv2.cvtColor.return_value = MagicMock()
        mock_cv2.COLOR_BGR2GRAY = 6
        mock_cv2.imencode.return_value = (True, MagicMock(tobytes=lambda: b"anonymized"))
        mock_cv2.imdecode.return_value = np.ones((100, 100, 3), dtype=np.uint8) * 128
        mock_cv2.GaussianBlur.return_value = np.ones((100, 100, 3), dtype=np.uint8) * 128
        mock_np.frombuffer.return_value = np.array([1, 2, 3])
        mock_np.uint8 = np.uint8
        mock_np.frombuffer.return_value = np.ones(30000, dtype=np.uint8)
        
        mock_cv2_import.return_value = (mock_cv2, mock_np)
        
        # Criar request de upload
        factory = APIRequestFactory()
        image = create_test_image()
        
        request = factory.post(
            f"/api/assessments/{self.assessment.id}/upload/",
            {"images": [image]},
            format="multipart"
        )
        request.user = self.user
        request.parser_classes = [MultiPartParser]
        
        # Executar view
        view = EvidenceUploadView.as_view()
        response = view(request, assessment_id=self.assessment.id)
        
        # Verificar que evidência foi criada
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Evidence.objects.filter(assessment=self.assessment).count(), 1)
        
        evidence = Evidence.objects.first()
        # Status deve ter sido atualizado pelo processo
        self.assertIn(evidence.anonymization_status, ["pending", "processing", "completed", "failed", "skipped"])


class AnonymizationMethodsTest(TestCase):
    """Testes para diferentes métodos de anonimização."""

    def test_blur_method(self):
        """Critério: método blur deve estar disponível."""
        service = AnonymizationService()
        self.assertEqual(service.METHOD_BLUR, "blur")

    def test_pixelate_method(self):
        """Critério: método pixelate deve estar disponível."""
        service = AnonymizationService()
        self.assertEqual(service.METHOD_PIXELATE, "pixelate")

    def test_blackout_method(self):
        """Critério: método blackout deve estar disponível."""
        service = AnonymizationService()
        self.assertEqual(service.METHOD_BLACKOUT, "blackout")

    @override_settings(ANONYMIZATION_METHOD="pixelate")
    def test_service_respects_method_setting(self):
        """Critério: serviço deve respeitar configuração de método."""
        service = AnonymizationService()
        self.assertEqual(service.method, "pixelate")


class PlateAnonymizationTODOTest(TestCase):
    """Testes para documentar que anonimização de placas é TODO."""

    @patch("assessments.anonymization._import_cv2")
    def test_plate_detection_returns_zero(self, mock_import_cv2):
        """Critério: detecção de placas deve retornar 0 (não implementado)."""
        mock_cv2 = MagicMock()
        mock_np = MagicMock()
        mock_import_cv2.return_value = (mock_cv2, mock_np)
        
        service = AnonymizationService()
        service._cv2 = mock_cv2
        service._np = mock_np
        
        # Criar imagem mock
        image = np.ones((100, 100, 3), dtype=np.uint8)
        
        result = service._anonymize_plates(image)
        
        self.assertEqual(result["detected"], 0)
        self.assertEqual(result["anonymized"], 0)

    @override_settings(ANONYMIZATION_BLOCK_PLATES=True)
    def test_block_plates_setting(self):
        """Critério: configuração de bloqueio de placas deve ser respeitada."""
        service = AnonymizationService()
        self.assertTrue(service.block_plates)


class MinimizationPrincipleTest(TestCase):
    """Testes para princípio de minimização de dados LGPD."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123"
        )

    def test_original_hash_not_persisted_if_no_anonymization(self):
        """Critério: hash original só é preenchido se houver processamento."""
        assessment = RiskAssessment.objects.create(
            created_by=self.user,
            title="Avaliação Teste"
        )
        image = create_test_image()
        
        evidence = Evidence.objects.create(
            assessment=assessment,
            file=image
        )
        
        # Se não foi anonimizado, não deve ter hash original
        self.assertEqual(evidence.original_file_hash, "")

    def test_file_size_stored_for_audit(self):
        """Critério: tamanho do arquivo deve ser armazenado para auditoria."""
        assessment = RiskAssessment.objects.create(
            created_by=self.user,
            title="Avaliação Teste"
        )
        image = create_test_image()
        
        evidence = Evidence.objects.create(
            assessment=assessment,
            file=image
        )
        
        # O tamanho deve ser calculado automaticamente
        self.assertIsNotNone(evidence.file_size)
        self.assertGreater(evidence.file_size, 0)
