"""
Testes de autorização e isolamento de dados entre usuários.

Garante que usuários só possam ver, modificar e acessar suas próprias RiskAssessments.
Retorna 404 para avaliações inexistentes ou não pertencentes ao usuário.
"""
import io
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from PIL import Image

from accounts.models import User
from assessments.models import RiskAssessment
from assessments.services import AssessmentLifecycleService


def create_image_file(name="test.jpg", content_type="image/jpeg"):
    """Cria um arquivo de imagem válido em memória."""
    image = Image.new("RGB", (100, 100), color="red")
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    buffer.seek(0)
    return SimpleUploadedFile(name, buffer.read(), content_type=content_type)


class RiskAssessmentAuthorizationTest(TestCase):
    """Testes de autorização para RiskAssessment (list, create, retrieve)."""

    def setUp(self):
        self.client = APIClient()
        
        # Usuário 1 (dono das avaliações)
        self.user1 = User.objects.create_user(
            email="user1@example.com",
            password="testpass123"
        )
        
        # Usuário 2 (outro usuário)
        self.user2 = User.objects.create_user(
            email="user2@example.com",
            password="testpass123"
        )
        
        # Avaliação do user1
        self.assessment_user1 = RiskAssessment.objects.create(
            created_by=self.user1,
            title="Avaliação do Usuário 1",
            description="Esta avaliação pertence ao user1"
        )
        
        # Avaliação do user2
        self.assessment_user2 = RiskAssessment.objects.create(
            created_by=self.user2,
            title="Avaliação do Usuário 2",
            description="Esta avaliação pertence ao user2"
        )

    def test_list_only_returns_own_assessments(self):
        """Listagem deve retornar apenas avaliações do usuário autenticado."""
        self.client.force_authenticate(user=self.user1)
        url = reverse("assessment-list-create")
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Deve retornar apenas 1 avaliação (a do user1)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "Avaliação do Usuário 1")
        self.assertEqual(response.data[0]["created_by_email"], "user1@example.com")

    def test_list_user2_only_sees_own_assessments(self):
        """User2 deve ver apenas suas próprias avaliações."""
        self.client.force_authenticate(user=self.user2)
        url = reverse("assessment-list-create")
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "Avaliação do Usuário 2")
        self.assertEqual(response.data[0]["created_by_email"], "user2@example.com")

    def test_detail_retrieves_own_assessment(self):
        """Usuário pode acessar detalhes de sua própria avaliação."""
        self.client.force_authenticate(user=self.user1)
        url = reverse(
            "assessment-detail", 
            kwargs={"assessment_id": self.assessment_user1.id}
        )
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Avaliação do Usuário 1")

    def test_detail_other_user_assessment_returns_404(self):
        """Acessar avaliação de outro usuário deve retornar 404."""
        self.client.force_authenticate(user=self.user1)
        url = reverse(
            "assessment-detail", 
            kwargs={"assessment_id": self.assessment_user2.id}
        )
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_detail_nonexistent_assessment_returns_404(self):
        """Acessar avaliação inexistente deve retornar 404."""
        self.client.force_authenticate(user=self.user1)
        url = reverse(
            "assessment-detail", 
            kwargs={"assessment_id": 99999}
        )
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_assessment_sets_created_by(self):
        """Ao criar avaliação, created_by deve ser o usuário autenticado."""
        self.client.force_authenticate(user=self.user1)
        url = reverse("assessment-list-create")
        data = {
            "title": "Nova Avaliação",
            "description": "Descrição da nova avaliação"
        }
        response = self.client.post(url, data, format="json")
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verificar no banco que foi criado com o user1
        assessment = RiskAssessment.objects.get(id=response.data["id"])
        self.assertEqual(assessment.created_by, self.user1)


class EvidenceUploadAuthorizationTest(TestCase):
    """Testes de autorização para upload de evidências."""

    def setUp(self):
        self.client = APIClient()
        
        self.user1 = User.objects.create_user(
            email="user1@example.com",
            password="testpass123"
        )
        self.user2 = User.objects.create_user(
            email="user2@example.com",
            password="testpass123"
        )
        
        self.assessment_user1 = RiskAssessment.objects.create(
            created_by=self.user1,
            title="Avaliação do Usuário 1"
        )
        self.assessment_user2 = RiskAssessment.objects.create(
            created_by=self.user2,
            title="Avaliação do Usuário 2"
        )

    def test_upload_to_own_assessment_succeeds(self):
        """Upload de evidência para própria avaliação deve funcionar."""
        self.client.force_authenticate(user=self.user1)
        url = reverse(
            "evidence-upload", 
            kwargs={"assessment_id": self.assessment_user1.id}
        )
        image = create_image_file("photo.jpg")
        
        response = self.client.post(
            url,
            {"images": [image]},
            format="multipart"
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_upload_to_other_user_assessment_returns_404(self):
        """Upload para avaliação de outro usuário deve retornar 404."""
        self.client.force_authenticate(user=self.user1)
        url = reverse(
            "evidence-upload", 
            kwargs={"assessment_id": self.assessment_user2.id}
        )
        image = create_image_file("photo.jpg")
        
        response = self.client.post(
            url,
            {"images": [image]},
            format="multipart"
        )
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_upload_to_nonexistent_assessment_returns_404(self):
        """Upload para avaliação inexistente deve retornar 404."""
        self.client.force_authenticate(user=self.user1)
        url = reverse(
            "evidence-upload", 
            kwargs={"assessment_id": 99999}
        )
        image = create_image_file("photo.jpg")
        
        response = self.client.post(
            url,
            {"images": [image]},
            format="multipart"
        )
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class LifecycleTransitionAuthorizationTest(TestCase):
    """Testes de autorização para transições de ciclo de vida."""

    def setUp(self):
        self.client = APIClient()
        
        self.user1 = User.objects.create_user(
            email="user1@example.com",
            password="testpass123"
        )
        self.user2 = User.objects.create_user(
            email="user2@example.com",
            password="testpass123"
        )
        
        self.assessment_user1 = RiskAssessment.objects.create(
            created_by=self.user1,
            title="Avaliação do Usuário 1",
            status=RiskAssessment.STATUS_DRAFT
        )
        self.assessment_user2 = RiskAssessment.objects.create(
            created_by=self.user2,
            title="Avaliação do Usuário 2",
            status=RiskAssessment.STATUS_DRAFT
        )

    def test_transition_own_assessment_succeeds(self):
        """Transição de própria avaliação deve funcionar."""
        self.client.force_authenticate(user=self.user1)
        url = reverse(
            "assessment-capture", 
            kwargs={"assessment_id": self.assessment_user1.id}
        )
        response = self.client.post(url, {})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assessment_user1.refresh_from_db()
        self.assertEqual(self.assessment_user1.status, RiskAssessment.STATUS_CAPTURED)

    def test_transition_other_user_assessment_returns_404(self):
        """Transição de avaliação de outro usuário deve retornar 404."""
        self.client.force_authenticate(user=self.user1)
        url = reverse(
            "assessment-capture", 
            kwargs={"assessment_id": self.assessment_user2.id}
        )
        response = self.client.post(url, {})
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        # Status não deve ter mudado
        self.assessment_user2.refresh_from_db()
        self.assertEqual(self.assessment_user2.status, RiskAssessment.STATUS_DRAFT)

    def test_capture_transition_other_user_returns_404(self):
        """Capture de avaliação de outro usuário deve retornar 404."""
        self.client.force_authenticate(user=self.user1)
        url = reverse(
            "assessment-capture", 
            kwargs={"assessment_id": self.assessment_user2.id}
        )
        response = self.client.post(url, {})
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_sync_transition_other_user_returns_404(self):
        """Sync de avaliação de outro usuário deve retornar 404."""
        # Preparar avaliação do user2 como CAPTURED
        AssessmentLifecycleService.capture(self.assessment_user2, self.user2)
        
        self.client.force_authenticate(user=self.user1)
        url = reverse(
            "assessment-sync", 
            kwargs={"assessment_id": self.assessment_user2.id}
        )
        response = self.client.post(url, {})
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_mark_ai_reviewed_other_user_returns_404(self):
        """Mark AI reviewed de avaliação de outro usuário deve retornar 404."""
        AssessmentLifecycleService.capture(self.assessment_user2, self.user2)
        AssessmentLifecycleService.sync(self.assessment_user2, self.user2)
        
        self.client.force_authenticate(user=self.user1)
        url = reverse(
            "assessment-ai-reviewed", 
            kwargs={"assessment_id": self.assessment_user2.id}
        )
        response = self.client.post(url, {})
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_human_validate_other_user_returns_404(self):
        """Human validate de avaliação de outro usuário deve retornar 404."""
        AssessmentLifecycleService.capture(self.assessment_user2, self.user2)
        AssessmentLifecycleService.sync(self.assessment_user2, self.user2)
        AssessmentLifecycleService.mark_ai_reviewed(self.assessment_user2, self.user2)
        
        self.client.force_authenticate(user=self.user1)
        url = reverse(
            "assessment-human-validated", 
            kwargs={"assessment_id": self.assessment_user2.id}
        )
        response = self.client.post(url, {})
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_finalize_other_user_returns_404(self):
        """Finalize de avaliação de outro usuário deve retornar 404."""
        AssessmentLifecycleService.capture(self.assessment_user2, self.user2)
        AssessmentLifecycleService.sync(self.assessment_user2, self.user2)
        AssessmentLifecycleService.mark_ai_reviewed(self.assessment_user2, self.user2)
        AssessmentLifecycleService.human_validate(self.assessment_user2, self.user2)
        
        self.client.force_authenticate(user=self.user1)
        url = reverse(
            "assessment-finalize", 
            kwargs={"assessment_id": self.assessment_user2.id}
        )
        response = self.client.post(url, {})
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_transition_nonexistent_assessment_returns_404(self):
        """Transição de avaliação inexistente deve retornar 404."""
        self.client.force_authenticate(user=self.user1)
        url = reverse(
            "assessment-capture", 
            kwargs={"assessment_id": 99999}
        )
        response = self.client.post(url, {})
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class StatusHistoryAuthorizationTest(TestCase):
    """Testes de autorização para histórico de status."""

    def setUp(self):
        self.client = APIClient()
        
        self.user1 = User.objects.create_user(
            email="user1@example.com",
            password="testpass123"
        )
        self.user2 = User.objects.create_user(
            email="user2@example.com",
            password="testpass123"
        )
        
        self.assessment_user1 = RiskAssessment.objects.create(
            created_by=self.user1,
            title="Avaliação do Usuário 1"
        )
        self.assessment_user2 = RiskAssessment.objects.create(
            created_by=self.user2,
            title="Avaliação do Usuário 2"
        )

    def test_status_history_own_assessment_succeeds(self):
        """Acessar histórico de própria avaliação deve funcionar."""
        self.client.force_authenticate(user=self.user1)
        url = reverse(
            "assessment-status-history", 
            kwargs={"assessment_id": self.assessment_user1.id}
        )
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("current_status", response.data)

    def test_status_history_other_user_returns_404(self):
        """Acessar histórico de avaliação de outro usuário deve retornar 404."""
        self.client.force_authenticate(user=self.user1)
        url = reverse(
            "assessment-status-history", 
            kwargs={"assessment_id": self.assessment_user2.id}
        )
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class ValidTransitionsAuthorizationTest(TestCase):
    """Testes de autorização para consulta de transições válidas."""

    def setUp(self):
        self.client = APIClient()
        
        self.user1 = User.objects.create_user(
            email="user1@example.com",
            password="testpass123"
        )
        self.user2 = User.objects.create_user(
            email="user2@example.com",
            password="testpass123"
        )
        
        self.assessment_user1 = RiskAssessment.objects.create(
            created_by=self.user1,
            title="Avaliação do Usuário 1"
        )
        self.assessment_user2 = RiskAssessment.objects.create(
            created_by=self.user2,
            title="Avaliação do Usuário 2"
        )

    def test_valid_transitions_own_assessment_succeeds(self):
        """Acessar transições válidas de própria avaliação deve funcionar."""
        self.client.force_authenticate(user=self.user1)
        url = reverse(
            "assessment-valid-transitions", 
            kwargs={"assessment_id": self.assessment_user1.id}
        )
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("valid_transitions", response.data)

    def test_valid_transitions_other_user_returns_404(self):
        """Acessar transições válidas de avaliação de outro usuário deve retornar 404."""
        self.client.force_authenticate(user=self.user1)
        url = reverse(
            "assessment-valid-transitions", 
            kwargs={"assessment_id": self.assessment_user2.id}
        )
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class DataIsolationTest(TestCase):
    """Testes de isolamento de dados entre múltiplos usuários."""

    def setUp(self):
        self.client = APIClient()
        
        # Criar 3 usuários
        self.users = []
        for i in range(3):
            user = User.objects.create_user(
                email=f"user{i+1}@example.com",
                password="testpass123"
            )
            self.users.append(user)
            # Criar 2 avaliações para cada usuário
            for j in range(2):
                RiskAssessment.objects.create(
                    created_by=user,
                    title=f"Avaliação {j+1} do Usuário {i+1}"
                )

    def test_user_cannot_access_any_other_user_data(self):
        """Usuário não deve conseguir acessar dados de nenhum outro usuário."""
        user1 = self.users[0]
        user2 = self.users[1]
        
        # Obter uma avaliação do user2
        user2_assessment = RiskAssessment.objects.filter(created_by=user2).first()
        
        self.client.force_authenticate(user=user1)
        
        # Tentar acessar detalhes
        url = reverse(
            "assessment-detail", 
            kwargs={"assessment_id": user2_assessment.id}
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        
        # Tentar fazer upload
        url = reverse(
            "evidence-upload", 
            kwargs={"assessment_id": user2_assessment.id}
        )
        image = create_image_file()
        response = self.client.post(url, {"images": [image]}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        
        # Tentar transição
        url = reverse(
            "assessment-capture", 
            kwargs={"assessment_id": user2_assessment.id}
        )
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_returns_only_own_data(self):
        """Listagem deve retornar apenas dados do usuário autenticado."""
        for user in self.users:
            self.client.force_authenticate(user=user)
            url = reverse("assessment-list-create")
            response = self.client.get(url)
            
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(len(response.data), 2)  # Cada usuário tem 2 avaliações
            
            # Verificar que todas as avaliações pertencem ao usuário
            for assessment_data in response.data:
                self.assertEqual(
                    assessment_data["created_by_email"], 
                    user.email
                )

    def test_user1_cannot_enumerate_user2_assessments(self):
        """User1 não deve conseguir enumerar avaliações de user2 via 404."""
        user1 = self.users[0]
        user2 = self.users[1]
        
        self.client.force_authenticate(user=user1)
        
        # Obter IDs das avaliações do user2
        user2_assessment_ids = list(
            RiskAssessment.objects.filter(created_by=user2)
            .values_list('id', flat=True)
        )
        
        # Tentar acessar cada uma - deve retornar 404
        for assessment_id in user2_assessment_ids:
            url = reverse(
                "assessment-detail", 
                kwargs={"assessment_id": assessment_id}
            )
            response = self.client.get(url)
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
