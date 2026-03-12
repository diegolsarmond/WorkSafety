"""
Testes do ciclo de vida de RiskAssessment (Sprint 3).

Cobertura:
- Transições válidas na ordem correta
- Transições inválidas retornam 400
- Idempotência (transição para o mesmo estado)
- Timestamps de marco são registrados
"""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import User
from assessments.models import RiskAssessment
from assessments.services import AssessmentLifecycleService, InvalidTransitionError


class AssessmentLifecycleServiceTest(TestCase):
    """Testes unitários do serviço de ciclo de vida."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123"
        )
        self.assessment = RiskAssessment.objects.create(
            created_by=self.user,
            title="Test Assessment",
            status=RiskAssessment.STATUS_DRAFT,
        )

    def test_valid_transitions_from_draft(self):
        """Transições válidas a partir de DRAFT: CAPTURED, ERROR."""
        valid = AssessmentLifecycleService.get_valid_transitions(RiskAssessment.STATUS_DRAFT)
        self.assertIn(RiskAssessment.STATUS_CAPTURED, valid)
        self.assertIn(RiskAssessment.STATUS_ERROR, valid)

    def test_valid_transitions_from_captured(self):
        """Transições válidas a partir de CAPTURED: SYNCED, ERROR."""
        valid = AssessmentLifecycleService.get_valid_transitions(RiskAssessment.STATUS_CAPTURED)
        self.assertIn(RiskAssessment.STATUS_SYNCED, valid)
        self.assertIn(RiskAssessment.STATUS_ERROR, valid)

    def test_valid_transitions_from_synced(self):
        """Transições válidas a partir de SYNCED: AI_REVIEWED, ERROR."""
        valid = AssessmentLifecycleService.get_valid_transitions(RiskAssessment.STATUS_SYNCED)
        self.assertIn(RiskAssessment.STATUS_AI_REVIEWED, valid)
        self.assertIn(RiskAssessment.STATUS_ERROR, valid)

    def test_valid_transitions_from_ai_reviewed(self):
        """Transições válidas a partir de AI_REVIEWED: HUMAN_VALIDATED, ERROR."""
        valid = AssessmentLifecycleService.get_valid_transitions(RiskAssessment.STATUS_AI_REVIEWED)
        self.assertIn(RiskAssessment.STATUS_HUMAN_VALIDATED, valid)
        self.assertIn(RiskAssessment.STATUS_ERROR, valid)

    def test_valid_transitions_from_human_validated(self):
        """Transições válidas a partir de HUMAN_VALIDATED: FINALIZED, ERROR."""
        valid = AssessmentLifecycleService.get_valid_transitions(RiskAssessment.STATUS_HUMAN_VALIDATED)
        self.assertIn(RiskAssessment.STATUS_FINALIZED, valid)
        self.assertIn(RiskAssessment.STATUS_ERROR, valid)

    def test_valid_transitions_from_finalized(self):
        """Transições válidas a partir de FINALIZED: apenas ERROR."""
        valid = AssessmentLifecycleService.get_valid_transitions(RiskAssessment.STATUS_FINALIZED)
        self.assertIn(RiskAssessment.STATUS_ERROR, valid)
        self.assertEqual(len(valid), 1)

    def test_can_transition_method(self):
        """Testa o método can_transition."""
        self.assertTrue(AssessmentLifecycleService.can_transition(
            RiskAssessment.STATUS_DRAFT, RiskAssessment.STATUS_CAPTURED
        ))
        self.assertFalse(AssessmentLifecycleService.can_transition(
            RiskAssessment.STATUS_DRAFT, RiskAssessment.STATUS_FINALIZED
        ))
        self.assertTrue(AssessmentLifecycleService.can_transition(
            RiskAssessment.STATUS_DRAFT, RiskAssessment.STATUS_DRAFT  # Idempotência
        ))

    def test_complete_lifecycle_success(self):
        """Testa ciclo de vida completo: DRAFT -> CAPTURED -> SYNCED -> AI_REVIEWED -> HUMAN_VALIDATED -> FINALIZED."""
        # DRAFT -> CAPTURED
        AssessmentLifecycleService.capture(self.assessment, self.user)
        self.assessment.refresh_from_db()
        self.assertEqual(self.assessment.status, RiskAssessment.STATUS_CAPTURED)
        self.assertIsNotNone(self.assessment.captured_at)

        # CAPTURED -> SYNCED
        AssessmentLifecycleService.sync(self.assessment, self.user)
        self.assessment.refresh_from_db()
        self.assertEqual(self.assessment.status, RiskAssessment.STATUS_SYNCED)
        self.assertIsNotNone(self.assessment.synced_at)

        # SYNCED -> AI_REVIEWED
        AssessmentLifecycleService.mark_ai_reviewed(self.assessment, self.user)
        self.assessment.refresh_from_db()
        self.assertEqual(self.assessment.status, RiskAssessment.STATUS_AI_REVIEWED)
        self.assertIsNotNone(self.assessment.ai_reviewed_at)

        # AI_REVIEWED -> HUMAN_VALIDATED
        AssessmentLifecycleService.human_validate(self.assessment, self.user)
        self.assessment.refresh_from_db()
        self.assertEqual(self.assessment.status, RiskAssessment.STATUS_HUMAN_VALIDATED)
        self.assertIsNotNone(self.assessment.human_validated_at)

        # HUMAN_VALIDATED -> FINALIZED
        AssessmentLifecycleService.finalize(self.assessment, self.user)
        self.assessment.refresh_from_db()
        self.assertEqual(self.assessment.status, RiskAssessment.STATUS_FINALIZED)
        self.assertIsNotNone(self.assessment.finalized_at)
        self.assertIsNotNone(self.assessment.status_changed_at)
        self.assertEqual(self.assessment.status_changed_by, self.user)

    def test_invalid_transition_raises_exception(self):
        """Transição inválida deve lançar InvalidTransitionError."""
        with self.assertRaises(InvalidTransitionError):
            AssessmentLifecycleService.finalize(self.assessment, self.user)

    def test_invalid_transition_draft_to_finalized(self):
        """Não deve permitir DRAFT -> FINALIZED direto."""
        with self.assertRaises(InvalidTransitionError) as context:
            AssessmentLifecycleService.transition(
                self.assessment, RiskAssessment.STATUS_FINALIZED, self.user
            )
        self.assertIn("Transição inválida", str(context.exception))

    def test_idempotency_same_state(self):
        """Transição para o mesmo estado deve ser permitida (idempotência)."""
        # Não deve lançar exceção
        result = AssessmentLifecycleService.transition(
            self.assessment, RiskAssessment.STATUS_DRAFT, self.user
        )
        self.assertEqual(result.status, RiskAssessment.STATUS_DRAFT)

    def test_error_state_recovery(self):
        """Deve permitir retry (ERROR -> DRAFT)."""
        self.assessment.status = RiskAssessment.STATUS_ERROR
        self.assessment.save()

        AssessmentLifecycleService.transition(
            self.assessment, RiskAssessment.STATUS_DRAFT, self.user, "Retry após erro"
        )
        self.assessment.refresh_from_db()
        self.assertEqual(self.assessment.status, RiskAssessment.STATUS_DRAFT)
        self.assertEqual(self.assessment.status_change_reason, "Retry após erro")

    def test_get_status_history(self):
        """Testa obtenção do histórico de status."""
        # Executa algumas transições
        AssessmentLifecycleService.capture(self.assessment, self.user)
        AssessmentLifecycleService.sync(self.assessment, self.user)
        
        history = AssessmentLifecycleService.get_status_history(self.assessment)
        
        self.assertEqual(history["current_status"], RiskAssessment.STATUS_SYNCED)
        self.assertIsNotNone(history["milestones"]["captured"])
        self.assertIsNotNone(history["milestones"]["synced"])
        self.assertIsNotNone(history["last_status_change"]["at"])


class AssessmentLifecycleAPITest(TestCase):
    """Testes de integração dos endpoints de ciclo de vida."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123"
        )
        self.client.force_authenticate(user=self.user)
        self.assessment = RiskAssessment.objects.create(
            created_by=self.user,
            title="Test Assessment",
            status=RiskAssessment.STATUS_DRAFT,
        )

    def test_capture_endpoint_success(self):
        """POST /assessments/<id>/capture deve transicionar para CAPTURED."""
        url = reverse("assessment-capture", kwargs={"assessment_id": self.assessment.id})
        response = self.client.post(url, {}, format="json")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], RiskAssessment.STATUS_CAPTURED)
        self.assertEqual(response.data["previous_status"], RiskAssessment.STATUS_DRAFT)
        
        self.assessment.refresh_from_db()
        self.assertEqual(self.assessment.status, RiskAssessment.STATUS_CAPTURED)

    def test_capture_endpoint_with_reason(self):
        """POST /assessments/<id>/capture com motivo deve ser registrado."""
        url = reverse("assessment-capture", kwargs={"assessment_id": self.assessment.id})
        response = self.client.post(url, {"reason": "Captura realizada no local"}, format="json")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.assessment.refresh_from_db()
        self.assertEqual(self.assessment.status_change_reason, "Captura realizada no local")

    def test_sync_endpoint_requires_captured(self):
        """POST /assessments/<id>/sync sem CAPTURED anterior deve retornar 400."""
        url = reverse("assessment-sync", kwargs={"assessment_id": self.assessment.id})
        response = self.client.post(url, {}, format="json")
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
        self.assertIn("Transição inválida", response.data["error"])

    def test_complete_lifecycle_via_api(self):
        """Testa ciclo de vida completo via API."""
        # CAPTURE
        url = reverse("assessment-capture", kwargs={"assessment_id": self.assessment.id})
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # SYNC
        url = reverse("assessment-sync", kwargs={"assessment_id": self.assessment.id})
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # AI REVIEWED
        url = reverse("assessment-mark-ai-reviewed", kwargs={"assessment_id": self.assessment.id})
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # HUMAN VALIDATED
        url = reverse("assessment-human-validate", kwargs={"assessment_id": self.assessment.id})
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # FINALIZE
        url = reverse("assessment-finalize", kwargs={"assessment_id": self.assessment.id})
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verificar estado final
        self.assessment.refresh_from_db()
        self.assertEqual(self.assessment.status, RiskAssessment.STATUS_FINALIZED)

    def test_invalid_transition_returns_400(self):
        """Transição inválida deve retornar HTTP 400 com mensagem clara."""
        url = reverse("assessment-finalize", kwargs={"assessment_id": self.assessment.id})
        response = self.client.post(url, {})
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
        # Mensagem deve conter informações sobre transições válidas
        self.assertIn("Transição inválida", response.data["error"])

    def test_nonexistent_assessment_returns_404(self):
        """Endpoint com ID inexistente deve retornar 404."""
        url = reverse("assessment-capture", kwargs={"assessment_id": 99999})
        response = self.client.post(url, {})
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_status_history_endpoint(self):
        """GET /assessments/<id>/status-history deve retornar histórico."""
        # Primeiro faz algumas transições
        AssessmentLifecycleService.capture(self.assessment, self.user)
        
        url = reverse("assessment-status-history", kwargs={"assessment_id": self.assessment.id})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("current_status", response.data)
        self.assertIn("milestones", response.data)
        self.assertIn("captured", response.data["milestones"])

    def test_valid_transitions_endpoint(self):
        """GET /assessments/<id>/valid-transitions deve retornar transições válidas."""
        url = reverse("assessment-valid-transitions", kwargs={"assessment_id": self.assessment.id})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("current_status", response.data)
        self.assertIn("valid_transitions", response.data)
        
        # Deve ter CAPTURED e ERROR como válidos a partir de DRAFT
        transition_values = [t["value"] for t in response.data["valid_transitions"]]
        self.assertIn(RiskAssessment.STATUS_CAPTURED, transition_values)
        self.assertIn(RiskAssessment.STATUS_ERROR, transition_values)

    def test_unauthenticated_access_denied(self):
        """Acesso sem autenticação deve ser negado."""
        self.client.force_authenticate(user=None)
        
        url = reverse("assessment-capture", kwargs={"assessment_id": self.assessment.id})
        response = self.client.post(url, {})
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class AssessmentStatusChoicesTest(TestCase):
    """Testes para garantir que os choices do modelo estão corretos."""

    def test_all_statuses_defined(self):
        """Todos os estados esperados devem estar definidos."""
        statuses = dict(RiskAssessment.STATUS_CHOICES)
        
        self.assertIn(RiskAssessment.STATUS_DRAFT, statuses)
        self.assertIn(RiskAssessment.STATUS_CAPTURED, statuses)
        self.assertIn(RiskAssessment.STATUS_SYNCED, statuses)
        self.assertIn(RiskAssessment.STATUS_AI_REVIEWED, statuses)
        self.assertIn(RiskAssessment.STATUS_HUMAN_VALIDATED, statuses)
        self.assertIn(RiskAssessment.STATUS_FINALIZED, statuses)
        self.assertIn(RiskAssessment.STATUS_ERROR, statuses)

    def test_default_status_is_draft(self):
        """Status padrão deve ser DRAFT."""
        user = User.objects.create_user(email="test@example.com", password="testpass123")
        assessment = RiskAssessment.objects.create(created_by=user, title="Test")
        
        self.assertEqual(assessment.status, RiskAssessment.STATUS_DRAFT)
