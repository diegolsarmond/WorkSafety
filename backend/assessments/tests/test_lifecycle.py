"""
Testes do ciclo de vida de RiskAssessment (Sprint 3 – atualização).

Cobertura:
- Transições válidas na ordem correta
- Transições inválidas retornam 400
- Idempotência (transição para o mesmo estado)
- Timestamps de marco são registrados
- AssessmentStatusHistory é persistido a cada transição
- Endpoint reprocess-ai
- Estado ERROR_AI e recuperação
"""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import User
from assessments.models import RiskAssessment, AssessmentStatusHistory
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

    # ── Transições válidas ───────────────────────────────────────

    def test_valid_transitions_from_draft(self):
        """Transições válidas a partir de DRAFT: CAPTURED, ERROR_AI."""
        valid = AssessmentLifecycleService.get_valid_transitions(RiskAssessment.STATUS_DRAFT)
        self.assertIn(RiskAssessment.STATUS_CAPTURED, valid)
        self.assertIn(RiskAssessment.STATUS_ERROR_AI, valid)

    def test_valid_transitions_from_captured(self):
        """Transições válidas a partir de CAPTURED: SYNCED, ERROR_AI."""
        valid = AssessmentLifecycleService.get_valid_transitions(RiskAssessment.STATUS_CAPTURED)
        self.assertIn(RiskAssessment.STATUS_SYNCED, valid)
        self.assertIn(RiskAssessment.STATUS_ERROR_AI, valid)

    def test_valid_transitions_from_synced(self):
        """Transições válidas a partir de SYNCED: AI_REVIEWED, ERROR_AI."""
        valid = AssessmentLifecycleService.get_valid_transitions(RiskAssessment.STATUS_SYNCED)
        self.assertIn(RiskAssessment.STATUS_AI_REVIEWED, valid)
        self.assertIn(RiskAssessment.STATUS_ERROR_AI, valid)

    def test_valid_transitions_from_ai_reviewed(self):
        """Transições válidas a partir de AI_REVIEWED: HUMAN_VALIDATED, ERROR_AI."""
        valid = AssessmentLifecycleService.get_valid_transitions(RiskAssessment.STATUS_AI_REVIEWED)
        self.assertIn(RiskAssessment.STATUS_HUMAN_VALIDATED, valid)
        self.assertIn(RiskAssessment.STATUS_ERROR_AI, valid)

    def test_valid_transitions_from_human_validated(self):
        """Transições válidas a partir de HUMAN_VALIDATED: FINALIZED, ERROR_AI."""
        valid = AssessmentLifecycleService.get_valid_transitions(RiskAssessment.STATUS_HUMAN_VALIDATED)
        self.assertIn(RiskAssessment.STATUS_FINALIZED, valid)
        self.assertIn(RiskAssessment.STATUS_ERROR_AI, valid)

    def test_valid_transitions_from_finalized(self):
        """Transições válidas a partir de FINALIZED: apenas ERROR_AI."""
        valid = AssessmentLifecycleService.get_valid_transitions(RiskAssessment.STATUS_FINALIZED)
        self.assertIn(RiskAssessment.STATUS_ERROR_AI, valid)
        self.assertEqual(len(valid), 1)

    def test_valid_transitions_from_error_ai(self):
        """Transições válidas a partir de ERROR_AI: apenas SYNCED (reprocessamento)."""
        valid = AssessmentLifecycleService.get_valid_transitions(RiskAssessment.STATUS_ERROR_AI)
        self.assertIn(RiskAssessment.STATUS_SYNCED, valid)
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

    # ── Ciclo completo ───────────────────────────────────────────

    def test_complete_lifecycle_success(self):
        """Testa ciclo de vida completo: DRAFT -> CAPTURED -> SYNCED -> AI_REVIEWED -> HUMAN_VALIDATED -> FINALIZED."""
        # DRAFT -> CAPTURED
        AssessmentLifecycleService.capture(self.assessment, self.user)
        self.assessment.refresh_from_db()
        self.assertEqual(self.assessment.status, RiskAssessment.STATUS_CAPTURED)
        self.assertIsNotNone(self.assessment.captured_at)

        # CAPTURED -> SYNCED
        AssessmentLifecycleService.sync(self.assessment, self.user, queue_ai_processing=False)
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

    # ── Transições inválidas ────────────────────────────────────

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

    def test_invalid_transition_draft_to_synced(self):
        """Não deve permitir DRAFT -> SYNCED (pular CAPTURED)."""
        with self.assertRaises(InvalidTransitionError):
            AssessmentLifecycleService.sync(self.assessment, self.user)

    def test_invalid_transition_captured_to_ai_reviewed(self):
        """Não deve permitir CAPTURED -> AI_REVIEWED (pular SYNCED)."""
        AssessmentLifecycleService.capture(self.assessment, self.user)
        with self.assertRaises(InvalidTransitionError):
            AssessmentLifecycleService.mark_ai_reviewed(self.assessment, self.user)

    def test_invalid_transition_synced_to_human_validated(self):
        """Não deve permitir SYNCED -> HUMAN_VALIDATED (pular AI_REVIEWED)."""
        AssessmentLifecycleService.capture(self.assessment, self.user)
        AssessmentLifecycleService.sync(self.assessment, self.user, queue_ai_processing=False)
        with self.assertRaises(InvalidTransitionError):
            AssessmentLifecycleService.human_validate(self.assessment, self.user)

    def test_invalid_transition_ai_reviewed_to_finalized(self):
        """Não deve permitir AI_REVIEWED -> FINALIZED (pular HUMAN_VALIDATED)."""
        AssessmentLifecycleService.capture(self.assessment, self.user)
        AssessmentLifecycleService.sync(self.assessment, self.user, queue_ai_processing=False)
        AssessmentLifecycleService.mark_ai_reviewed(self.assessment, self.user)
        with self.assertRaises(InvalidTransitionError):
            AssessmentLifecycleService.finalize(self.assessment, self.user)

    # ── Idempotência ────────────────────────────────────────────

    def test_idempotency_same_state(self):
        """Transição para o mesmo estado deve ser permitida (idempotência)."""
        result = AssessmentLifecycleService.transition(
            self.assessment, RiskAssessment.STATUS_DRAFT, self.user
        )
        self.assertEqual(result.status, RiskAssessment.STATUS_DRAFT)

    def test_idempotency_no_history_created(self):
        """Transição idempotente NÃO deve gerar registro no histórico."""
        initial_count = AssessmentStatusHistory.objects.count()
        AssessmentLifecycleService.transition(
            self.assessment, RiskAssessment.STATUS_DRAFT, self.user
        )
        self.assertEqual(AssessmentStatusHistory.objects.count(), initial_count)

    # ── ERROR_AI e recuperação ──────────────────────────────────

    def test_error_ai_from_synced(self):
        """Deve permitir SYNCED -> ERROR_AI."""
        AssessmentLifecycleService.capture(self.assessment, self.user)
        AssessmentLifecycleService.sync(self.assessment, self.user, queue_ai_processing=False)
        AssessmentLifecycleService.mark_error_ai(self.assessment, self.user, "Falha de IA")
        self.assessment.refresh_from_db()
        self.assertEqual(self.assessment.status, RiskAssessment.STATUS_ERROR_AI)

    def test_error_ai_recovery_to_synced(self):
        """Deve permitir ERROR_AI -> SYNCED (reprocessamento)."""
        self.assessment.status = RiskAssessment.STATUS_ERROR_AI
        self.assessment.save()

        AssessmentLifecycleService.reprocess_ai(self.assessment, self.user, "Reprocessar")
        self.assessment.refresh_from_db()
        self.assertEqual(self.assessment.status, RiskAssessment.STATUS_SYNCED)
        self.assertEqual(self.assessment.status_change_reason, "Reprocessar")

    def test_error_ai_cannot_go_to_draft(self):
        """ERROR_AI NÃO deve permitir voltar a DRAFT."""
        self.assessment.status = RiskAssessment.STATUS_ERROR_AI
        self.assessment.save()
        with self.assertRaises(InvalidTransitionError):
            AssessmentLifecycleService.transition(
                self.assessment, RiskAssessment.STATUS_DRAFT, self.user
            )

    # ── Histórico de transições ─────────────────────────────────

    def test_history_created_on_transition(self):
        """Cada transição deve criar um registro no AssessmentStatusHistory."""
        AssessmentLifecycleService.capture(self.assessment, self.user, "Motivo 1")
        self.assessment.refresh_from_db()

        history = AssessmentStatusHistory.objects.filter(assessment=self.assessment)
        self.assertEqual(history.count(), 1)

        entry = history.first()
        self.assertEqual(entry.from_status, RiskAssessment.STATUS_DRAFT)
        self.assertEqual(entry.to_status, RiskAssessment.STATUS_CAPTURED)
        self.assertEqual(entry.changed_by, self.user)
        self.assertEqual(entry.reason, "Motivo 1")
        self.assertIsNotNone(entry.changed_at)

    def test_history_multiple_transitions(self):
        """Ciclo completo deve gerar 5 registros de histórico."""
        AssessmentLifecycleService.capture(self.assessment, self.user)
        AssessmentLifecycleService.sync(self.assessment, self.user, queue_ai_processing=False)
        AssessmentLifecycleService.mark_ai_reviewed(self.assessment, self.user)
        AssessmentLifecycleService.human_validate(self.assessment, self.user)
        AssessmentLifecycleService.finalize(self.assessment, self.user)

        history = AssessmentStatusHistory.objects.filter(
            assessment=self.assessment
        ).order_by("changed_at")
        self.assertEqual(history.count(), 5)

        # Verificar ordem
        transitions = list(history.values_list("from_status", "to_status"))
        expected = [
            ("draft", "captured"),
            ("captured", "synced"),
            ("synced", "ai_reviewed"),
            ("ai_reviewed", "human_validated"),
            ("human_validated", "finalized"),
        ]
        self.assertEqual(transitions, expected)

    def test_history_with_system_actor(self):
        """Transição sem ator (sistema) deve ser registrada com changed_by=None."""
        AssessmentLifecycleService.capture(self.assessment, None, "Ação de sistema")

        entry = AssessmentStatusHistory.objects.filter(assessment=self.assessment).first()
        self.assertIsNone(entry.changed_by)
        self.assertEqual(entry.reason, "Ação de sistema")

    def test_get_status_history_returns_transitions(self):
        """get_status_history deve retornar transições persistidas."""
        AssessmentLifecycleService.capture(self.assessment, self.user)
        AssessmentLifecycleService.sync(self.assessment, self.user, queue_ai_processing=False)

        history = AssessmentLifecycleService.get_status_history(self.assessment)

        self.assertEqual(history["current_status"], RiskAssessment.STATUS_SYNCED)
        self.assertEqual(len(history["transitions"]), 2)
        self.assertIsNotNone(history["milestones"]["captured"])
        self.assertIsNotNone(history["milestones"]["synced"])
        self.assertIsNotNone(history["last_status_change"]["at"])

        # Verificar estrutura de cada transição
        first_transition = history["transitions"][0]
        self.assertEqual(first_transition["from_status"], "draft")
        self.assertEqual(first_transition["to_status"], "captured")
        self.assertIn("changed_at", first_transition)
        self.assertIn("changed_by", first_transition)


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

    # ── Endpoints de transição ──────────────────────────────────

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

    def test_ai_reviewed_endpoint_success(self):
        """POST /assessments/<id>/ai-reviewed deve transicionar de SYNCED."""
        # Preparar: DRAFT -> CAPTURED -> SYNCED
        AssessmentLifecycleService.capture(self.assessment, self.user)
        AssessmentLifecycleService.sync(self.assessment, self.user, queue_ai_processing=False)

        url = reverse("assessment-ai-reviewed", kwargs={"assessment_id": self.assessment.id})
        response = self.client.post(url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], RiskAssessment.STATUS_AI_REVIEWED)

    def test_human_validated_endpoint_success(self):
        """POST /assessments/<id>/human-validated deve transicionar de AI_REVIEWED."""
        # Preparar: DRAFT -> CAPTURED -> SYNCED -> AI_REVIEWED
        AssessmentLifecycleService.capture(self.assessment, self.user)
        AssessmentLifecycleService.sync(self.assessment, self.user, queue_ai_processing=False)
        AssessmentLifecycleService.mark_ai_reviewed(self.assessment, self.user)

        url = reverse("assessment-human-validated", kwargs={"assessment_id": self.assessment.id})
        response = self.client.post(url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], RiskAssessment.STATUS_HUMAN_VALIDATED)

    def test_finalize_endpoint_success(self):
        """POST /assessments/<id>/finalize deve transicionar de HUMAN_VALIDATED."""
        # Preparar ciclo completo até HUMAN_VALIDATED
        AssessmentLifecycleService.capture(self.assessment, self.user)
        AssessmentLifecycleService.sync(self.assessment, self.user, queue_ai_processing=False)
        AssessmentLifecycleService.mark_ai_reviewed(self.assessment, self.user)
        AssessmentLifecycleService.human_validate(self.assessment, self.user)

        url = reverse("assessment-finalize", kwargs={"assessment_id": self.assessment.id})
        response = self.client.post(url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], RiskAssessment.STATUS_FINALIZED)

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
        url = reverse("assessment-ai-reviewed", kwargs={"assessment_id": self.assessment.id})
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # HUMAN VALIDATED
        url = reverse("assessment-human-validated", kwargs={"assessment_id": self.assessment.id})
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # FINALIZE
        url = reverse("assessment-finalize", kwargs={"assessment_id": self.assessment.id})
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verificar estado final
        self.assessment.refresh_from_db()
        self.assertEqual(self.assessment.status, RiskAssessment.STATUS_FINALIZED)

        # Verificar que 5 registros de histórico foram criados
        history_count = AssessmentStatusHistory.objects.filter(assessment=self.assessment).count()
        self.assertEqual(history_count, 5)

    # ── Transições inválidas via API ────────────────────────────

    def test_invalid_transition_returns_400(self):
        """Transição inválida deve retornar HTTP 400 com mensagem clara."""
        url = reverse("assessment-finalize", kwargs={"assessment_id": self.assessment.id})
        response = self.client.post(url, {})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
        self.assertIn("Transição inválida", response.data["error"])

    def test_skip_step_returns_400(self):
        """Pular etapas (DRAFT -> AI_REVIEWED) deve retornar 400."""
        url = reverse("assessment-ai-reviewed", kwargs={"assessment_id": self.assessment.id})
        response = self.client.post(url, {})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Transição inválida", response.data["error"])

    def test_nonexistent_assessment_returns_404(self):
        """Endpoint com ID inexistente deve retornar 404."""
        url = reverse("assessment-capture", kwargs={"assessment_id": 99999})
        response = self.client.post(url, {})

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ── Endpoint de histórico ──────────────────────────────────

    def test_status_history_endpoint(self):
        """GET /assessments/<id>/status-history deve retornar histórico completo."""
        # Fazer transições
        AssessmentLifecycleService.capture(self.assessment, self.user, "Motivo captura")
        AssessmentLifecycleService.sync(self.assessment, self.user, queue_ai_processing=False)

        url = reverse("assessment-status-history", kwargs={"assessment_id": self.assessment.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("current_status", response.data)
        self.assertIn("transitions", response.data)
        self.assertIn("milestones", response.data)

        # Verificar transições retornadas
        self.assertEqual(len(response.data["transitions"]), 2)
        first = response.data["transitions"][0]
        self.assertEqual(first["from_status"], "draft")
        self.assertEqual(first["to_status"], "captured")
        self.assertIn("changed_at", first)

    def test_status_history_empty_for_new_assessment(self):
        """Avaliação nova não deve ter transições no histórico."""
        url = reverse("assessment-status-history", kwargs={"assessment_id": self.assessment.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["transitions"]), 0)
        self.assertEqual(response.data["current_status"], "draft")

    # ── Endpoint de transições válidas ─────────────────────────

    def test_valid_transitions_endpoint(self):
        """GET /assessments/<id>/valid-transitions deve retornar transições válidas."""
        url = reverse("assessment-valid-transitions", kwargs={"assessment_id": self.assessment.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("current_status", response.data)
        self.assertIn("valid_transitions", response.data)

        # Deve ter CAPTURED e ERROR_AI como válidos a partir de DRAFT
        transition_values = [t["value"] for t in response.data["valid_transitions"]]
        self.assertIn(RiskAssessment.STATUS_CAPTURED, transition_values)
        self.assertIn(RiskAssessment.STATUS_ERROR_AI, transition_values)

    # ── Endpoint reprocess-ai ──────────────────────────────────

    def test_reprocess_ai_endpoint_requires_error_ai(self):
        """POST /assessments/<id>/reprocess-ai sem ERROR_AI deve retornar 400."""
        url = reverse("assessment-reprocess-ai", kwargs={"assessment_id": self.assessment.id})
        response = self.client.post(url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_reprocess_ai_endpoint_creates_history(self):
        """POST /assessments/<id>/reprocess-ai deve gerar registro no histórico."""
        # Preparar: colocar em ERROR_AI
        self.assessment.status = RiskAssessment.STATUS_ERROR_AI
        self.assessment.save()

        url = reverse("assessment-reprocess-ai", kwargs={"assessment_id": self.assessment.id})
        response = self.client.post(url, {"reason": "Retentar IA"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["previous_status"], RiskAssessment.STATUS_ERROR_AI)

        # Verificar que histórico foi criado
        history = AssessmentStatusHistory.objects.filter(
            assessment=self.assessment,
            from_status=RiskAssessment.STATUS_ERROR_AI,
            to_status=RiskAssessment.STATUS_SYNCED,
        )
        self.assertEqual(history.count(), 1)

    # ── Status na listagem e detalhe ───────────────────────────

    def test_status_visible_in_list(self):
        """Status deve ser visível na listagem de avaliações."""
        url = reverse("assessment-list-create")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(len(response.data) > 0)
        self.assertIn("status", response.data[0])
        self.assertEqual(response.data[0]["status"], "draft")

    def test_status_visible_in_detail(self):
        """Status deve ser visível no detalhe de avaliação."""
        url = reverse("assessment-detail", kwargs={"assessment_id": self.assessment.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("status", response.data)
        self.assertIn("status_display", response.data)
        self.assertEqual(response.data["status"], "draft")
        self.assertEqual(response.data["status_display"], "Rascunho")

    # ── Autenticação ───────────────────────────────────────────

    def test_unauthenticated_access_denied(self):
        """Acesso sem autenticação deve ser negado."""
        self.client.force_authenticate(user=None)

        url = reverse("assessment-capture", kwargs={"assessment_id": self.assessment.id})
        response = self.client.post(url, {})

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_other_user_cannot_transition(self):
        """Outro usuário não pode transicionar avaliação alheia."""
        other_user = User.objects.create_user(
            email="other@example.com",
            password="testpass123"
        )
        self.client.force_authenticate(user=other_user)

        url = reverse("assessment-capture", kwargs={"assessment_id": self.assessment.id})
        response = self.client.post(url, {})

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


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
        self.assertIn(RiskAssessment.STATUS_ERROR_AI, statuses)

    def test_default_status_is_draft(self):
        """Status padrão deve ser DRAFT."""
        user = User.objects.create_user(email="test@example.com", password="testpass123")
        assessment = RiskAssessment.objects.create(created_by=user, title="Test")

        self.assertEqual(assessment.status, RiskAssessment.STATUS_DRAFT)

    def test_error_ai_status_value(self):
        """STATUS_ERROR_AI deve ter o valor 'error_ai'."""
        self.assertEqual(RiskAssessment.STATUS_ERROR_AI, "error_ai")


class AssessmentStatusHistoryModelTest(TestCase):
    """Testes unitários para o model AssessmentStatusHistory."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123"
        )
        self.assessment = RiskAssessment.objects.create(
            created_by=self.user,
            title="Test Assessment",
        )

    def test_create_history_entry(self):
        """Deve criar um registro de histórico corretamente."""
        entry = AssessmentStatusHistory.objects.create(
            assessment=self.assessment,
            from_status="draft",
            to_status="captured",
            changed_by=self.user,
            reason="Teste",
        )
        self.assertEqual(entry.assessment, self.assessment)
        self.assertEqual(entry.from_status, "draft")
        self.assertEqual(entry.to_status, "captured")
        self.assertEqual(entry.changed_by, self.user)
        self.assertEqual(entry.reason, "Teste")
        self.assertIsNotNone(entry.changed_at)

    def test_history_str(self):
        """__str__ deve ser legível."""
        entry = AssessmentStatusHistory.objects.create(
            assessment=self.assessment,
            from_status="draft",
            to_status="captured",
            changed_by=self.user,
        )
        s = str(entry)
        self.assertIn("draft", s)
        self.assertIn("captured", s)
        self.assertIn(self.user.email, s)

    def test_history_without_actor(self):
        """Registro sem ator deve funcionar (ações de sistema)."""
        entry = AssessmentStatusHistory.objects.create(
            assessment=self.assessment,
            from_status="synced",
            to_status="error_ai",
            changed_by=None,
            reason="Falha de IA automática",
        )
        self.assertIsNone(entry.changed_by)
        self.assertIn("Sistema", str(entry))

    def test_history_cascade_delete(self):
        """Ao excluir a avaliação, histórico deve ser excluído também."""
        AssessmentStatusHistory.objects.create(
            assessment=self.assessment,
            from_status="draft",
            to_status="captured",
            changed_by=self.user,
        )
        self.assessment.delete()
        self.assertEqual(AssessmentStatusHistory.objects.count(), 0)

    def test_history_ordering(self):
        """Registros devem estar ordenados por -changed_at (mais recente primeiro)."""
        AssessmentStatusHistory.objects.create(
            assessment=self.assessment,
            from_status="draft",
            to_status="captured",
            changed_by=self.user,
        )
        AssessmentStatusHistory.objects.create(
            assessment=self.assessment,
            from_status="captured",
            to_status="synced",
            changed_by=self.user,
        )
        entries = AssessmentStatusHistory.objects.filter(assessment=self.assessment)
        self.assertEqual(entries[0].to_status, "synced")  # Mais recente primeiro
        self.assertEqual(entries[1].to_status, "captured")
