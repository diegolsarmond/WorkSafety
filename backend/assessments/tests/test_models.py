"""Testes mínimos dos modelos F12.1–F12.5 (assessments)."""
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile

from accounts.models import User
from assessments.models import (
    RiskAssessment,
    Evidence,
    RiskFinding,
    AIInferenceResult,
    HumanValidationDecision,
    AssessmentStatusHistory,
)


class RiskAssessmentModelTest(TestCase):
    def test_create_risk_assessment(self):
        user = User.objects.create_user(email="creator@example.com", password="pass")
        assessment = RiskAssessment.objects.create(
            created_by=user,
            status="draft",
            title="Avaliação 1",
            description="Descrição",
        )
        self.assertEqual(assessment.status, "draft")
        self.assertEqual(assessment.title, "Avaliação 1")
        self.assertEqual(assessment.created_by_id, user.id)
        self.assertIsNotNone(assessment.created_at)
        self.assertIsNotNone(assessment.updated_at)
        self.assertIn("Avaliação 1", str(assessment))


class EvidenceModelTest(TestCase):
    def test_create_evidence(self):
        user = User.objects.create_user(email="u@example.com", password="pass")
        assessment = RiskAssessment.objects.create(created_by=user, title="A1")
        content = b"conteudo do arquivo"
        f = SimpleUploadedFile("foto.jpg", content, content_type="image/jpeg")
        evidence = Evidence.objects.create(assessment=assessment, file=f)
        self.assertEqual(evidence.assessment_id, assessment.id)
        self.assertIsNotNone(evidence.file)
        # Backend preenche file_hash, file_size e mime_type ao salvar
        self.assertEqual(evidence.file_size, len(content))
        self.assertEqual(len(evidence.file_hash), 64)  # sha256 hex
        self.assertEqual(evidence.mime_type, "image/jpeg")


class RiskFindingModelTest(TestCase):
    def test_create_risk_finding(self):
        user = User.objects.create_user(email="u@example.com", password="pass")
        assessment = RiskAssessment.objects.create(created_by=user, title="A1")
        finding = RiskFinding.objects.create(
            assessment=assessment,
            description="Risco de queda",
            severity="alto",
        )
        self.assertEqual(finding.assessment_id, assessment.id)
        self.assertEqual(finding.description, "Risco de queda")
        self.assertIsNotNone(finding.created_at)


class AIInferenceResultModelTest(TestCase):
    def test_create_ai_inference_result(self):
        user = User.objects.create_user(email="u@example.com", password="pass")
        assessment = RiskAssessment.objects.create(created_by=user, title="A1")
        inference = AIInferenceResult.objects.create(
            assessment=assessment,
            result_json={"labels": ["risk"]},
            confidence="0.95",
        )
        self.assertEqual(inference.assessment_id, assessment.id)
        self.assertEqual(inference.result_json, {"labels": ["risk"]})
        self.assertIsNotNone(inference.created_at)


class HumanValidationDecisionModelTest(TestCase):
    def test_create_human_validation_decision(self):
        user = User.objects.create_user(email="u@example.com", password="pass")
        assessment = RiskAssessment.objects.create(created_by=user, title="A1")
        inference = AIInferenceResult.objects.create(assessment=assessment, result_json={})
        decision = HumanValidationDecision.objects.create(
            inference=inference,
            validator=user,
            decision="approved",
            comment="OK",
        )
        self.assertEqual(decision.inference_id, inference.id)
        self.assertEqual(decision.validator_id, user.id)
        self.assertEqual(decision.decision, "approved")
