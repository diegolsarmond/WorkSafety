"""Testes para AssessmentType e EnvironmentType em RiskAssessment."""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import User
from assessments.models import RiskAssessment
from configurations.models import AssessmentType, EnvironmentType


class AssessmentTypeEnvironmentTypeAPITest(TestCase):
    """Testes para criação de avaliações com tipos de avaliação e ambiente."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123"
        )
        self.client.force_authenticate(user=self.user)
        self.list_url = reverse("assessment-list-create")

        # Criar tipos ativos
        self.active_assessment_type = AssessmentType.objects.create(
            name="Inspeção de Segurança",
            description="Inspeção regular de segurança do trabalho",
            active=True,
        )
        self.active_environment_type = EnvironmentType.objects.create(
            name="Canteiro de Obras",
            description="Área de construção civil",
            active=True,
        )

        # Criar tipos inativos
        self.inactive_assessment_type = AssessmentType.objects.create(
            name="Auditoria Antiga",
            description="Tipo descontinuado",
            active=False,
        )
        self.inactive_environment_type = EnvironmentType.objects.create(
            name="Mina Desativada",
            description="Área não utilizada",
            active=False,
        )

    def test_create_assessment_with_valid_types(self):
        """
        Critério: POST /api/assessments/ aceita assessment_type_id e environment_type_id válidos.
        """
        data = {
            "title": "Avaliação com Tipos",
            "description": "Teste de criação com tipos",
            "assessment_type_id": self.active_assessment_type.id,
            "environment_type_id": self.active_environment_type.id,
        }

        response = self.client.post(self.list_url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(RiskAssessment.objects.count(), 1)

        assessment = RiskAssessment.objects.first()
        self.assertEqual(assessment.assessment_type, self.active_assessment_type)
        self.assertEqual(assessment.environment_type, self.active_environment_type)

    def test_create_assessment_with_inactive_assessment_type_returns_400(self):
        """
        Critério: Tipos inativos não devem ser selecionáveis (retornar 400).
        """
        data = {
            "title": "Avaliação com Tipo Inativo",
            "description": "Teste de validação",
            "assessment_type_id": self.inactive_assessment_type.id,
        }

        response = self.client.post(self.list_url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("assessment_type_id", str(response.data).lower())
        self.assertEqual(RiskAssessment.objects.count(), 0)

    def test_create_assessment_with_inactive_environment_type_returns_400(self):
        """
        Critério: Tipos de ambiente inativos não devem ser selecionáveis (retornar 400).
        """
        data = {
            "title": "Avaliação com Ambiente Inativo",
            "description": "Teste de validação",
            "environment_type_id": self.inactive_environment_type.id,
        }

        response = self.client.post(self.list_url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("environment_type_id", str(response.data).lower())
        self.assertEqual(RiskAssessment.objects.count(), 0)

    def test_create_assessment_without_types_is_backward_compatible(self):
        """
        Critério: Compatibilidade retroativa quando o cliente não enviar esses campos.
        """
        data = {
            "title": "Avaliação sem Tipos",
            "description": "Teste de compatibilidade",
        }

        response = self.client.post(self.list_url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(RiskAssessment.objects.count(), 1)

        assessment = RiskAssessment.objects.first()
        self.assertIsNone(assessment.assessment_type)
        self.assertIsNone(assessment.environment_type)

    def test_create_assessment_with_only_assessment_type(self):
        """
        Critério: Criação com apenas assessment_type_id (environment_type opcional).
        """
        data = {
            "title": "Avaliação Parcial",
            "description": "Teste de campos opcionais",
            "assessment_type_id": self.active_assessment_type.id,
        }

        response = self.client.post(self.list_url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        assessment = RiskAssessment.objects.first()
        self.assertEqual(assessment.assessment_type, self.active_assessment_type)
        self.assertIsNone(assessment.environment_type)

    def test_list_returns_types_with_objects(self):
        """
        Critério: GET /api/assessments/ retorna assessment_type e environment_type como objetos.
        """
        # Criar uma avaliação com tipos
        assessment = RiskAssessment.objects.create(
            created_by=self.user,
            title="Avaliação com Tipos",
            assessment_type=self.active_assessment_type,
            environment_type=self.active_environment_type,
        )

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

        result = response.data[0]
        self.assertIn("assessment_type", result)
        self.assertIn("environment_type", result)

        # Verificar estrutura do objeto assessment_type
        self.assertEqual(result["assessment_type"]["id"], self.active_assessment_type.id)
        self.assertEqual(result["assessment_type"]["name"], self.active_assessment_type.name)
        self.assertEqual(result["assessment_type"]["active"], True)

        # Verificar estrutura do objeto environment_type
        self.assertEqual(result["environment_type"]["id"], self.active_environment_type.id)
        self.assertEqual(result["environment_type"]["name"], self.active_environment_type.name)
        self.assertEqual(result["environment_type"]["active"], True)

    def test_detail_returns_types_with_objects(self):
        """
        Critério: GET /api/assessments/:id/ retorna assessment_type e environment_type como objetos.
        """
        assessment = RiskAssessment.objects.create(
            created_by=self.user,
            title="Avaliação com Tipos",
            assessment_type=self.active_assessment_type,
            environment_type=self.active_environment_type,
        )
        detail_url = reverse("assessment-detail", kwargs={"assessment_id": assessment.id})

        response = self.client.get(detail_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verificar estrutura dos objetos
        self.assertIn("assessment_type", response.data)
        self.assertIn("environment_type", response.data)

        self.assertEqual(response.data["assessment_type"]["id"], self.active_assessment_type.id)
        self.assertEqual(response.data["assessment_type"]["name"], self.active_assessment_type.name)
        self.assertEqual(response.data["assessment_type"]["description"], self.active_assessment_type.description)
        self.assertEqual(response.data["assessment_type"]["active"], True)

        self.assertEqual(response.data["environment_type"]["id"], self.active_environment_type.id)
        self.assertEqual(response.data["environment_type"]["name"], self.active_environment_type.name)

    def test_detail_returns_null_for_unset_types(self):
        """
        Critério: GET /api/assessments/:id/ retorna null quando tipos não estão definidos.
        """
        assessment = RiskAssessment.objects.create(
            created_by=self.user,
            title="Avaliação sem Tipos",
        )
        detail_url = reverse("assessment-detail", kwargs={"assessment_id": assessment.id})

        response = self.client.get(detail_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["assessment_type"])
        self.assertIsNone(response.data["environment_type"])

    def test_create_assessment_with_nonexistent_type_returns_400(self):
        """
        Critério: Tentar usar um tipo inexistente retorna 400.
        """
        data = {
            "title": "Avaliação Inválida",
            "description": "Teste de validação",
            "assessment_type_id": 99999,  # ID inexistente
        }

        response = self.client.post(self.list_url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(RiskAssessment.objects.count(), 0)
