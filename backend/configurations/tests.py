"""
Tests for configurations app.
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from .models import AssessmentType, EnvironmentType, RiskType, AIThreshold, AuditLog

User = get_user_model()


class BaseConfigTestCase(APITestCase):
    """Base test case for configuration tests."""
    
    def setUp(self):
        """Set up test data."""
        # Create admin user
        self.admin_user = User.objects.create_user(
            email='admin@test.com',
            password='admin123',
            is_staff=True,
            is_active=True
        )
        
        # Create regular user
        self.regular_user = User.objects.create_user(
            email='user@test.com',
            password='user123',
            is_staff=False,
            is_active=True
        )
        
        # Create test data
        self.assessment_type = AssessmentType.objects.create(
            name='Inspeção',
            description='Inspeção de segurança',
            active=True,
            created_by=self.admin_user
        )
        
        self.environment_type = EnvironmentType.objects.create(
            name='Canteiro',
            description='Canteiro de obras',
            active=True,
            created_by=self.admin_user
        )
        
        self.risk_type = RiskType.objects.create(
            name='Queda',
            description='Risco de queda',
            active=True,
            created_by=self.admin_user
        )
        
        self.ai_threshold = AIThreshold.objects.create(
            threshold_type=AIThreshold.THRESHOLD_TYPE_CONFIDENCE,
            threshold_value=60.00,
            description='Limiar mínimo de confiança',
            updated_by=self.admin_user
        )

    def get_token_for_user(self, user):
        """Generate JWT token for user."""
        refresh = RefreshToken.for_user(user)
        return str(refresh.access_token)


class AssessmentTypeTests(BaseConfigTestCase):
    """Tests for AssessmentType endpoints (F16.1)."""
    
    def test_list_assessment_types_authenticated(self):
        """Test listing assessment types with authentication."""
        token = self.get_token_for_user(self.regular_user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        
        response = self.client.get('/api/admin/assessment-types/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Inspeção')
        self.assertEqual(response.data[0]['active'], 1)
    
    def test_list_assessment_types_unauthenticated(self):
        """Test listing assessment types without authentication."""
        response = self.client.get('/api/admin/assessment-types/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_create_assessment_type_as_admin(self):
        """Test creating assessment type as admin."""
        token = self.get_token_for_user(self.admin_user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        
        data = {
            'name': 'Auditoria',
            'description': 'Auditoria completa'
        }
        response = self.client.post('/api/admin/assessment-types/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Auditoria')
        self.assertEqual(response.data['active'], 1)
        
        # Check audit log was created
        audit_log = AuditLog.objects.filter(
            entity_type='AssessmentType',
            action=AuditLog.ACTION_CREATE
        ).first()
        self.assertIsNotNone(audit_log)
    
    def test_create_assessment_type_as_regular_user(self):
        """Test creating assessment type as regular user (should fail)."""
        token = self.get_token_for_user(self.regular_user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        
        data = {
            'name': 'Auditoria',
            'description': 'Auditoria completa'
        }
        response = self.client.post('/api/admin/assessment-types/', data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_deactivate_assessment_type(self):
        """Test deactivating assessment type."""
        token = self.get_token_for_user(self.admin_user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        
        response = self.client.post(
            f'/api/admin/assessment-types/{self.assessment_type.id}/deactivate/'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify it was deactivated
        self.assessment_type.refresh_from_db()
        self.assertFalse(self.assessment_type.active)
        
        # Check audit log
        audit_log = AuditLog.objects.filter(
            entity_type='AssessmentType',
            action=AuditLog.ACTION_DEACTIVATE
        ).first()
        self.assertIsNotNone(audit_log)


class EnvironmentTypeTests(BaseConfigTestCase):
    """Tests for EnvironmentType endpoints (F16.2)."""
    
    def test_list_environment_types(self):
        """Test listing environment types."""
        token = self.get_token_for_user(self.regular_user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        
        response = self.client.get('/api/admin/environment-types/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Canteiro')
    
    def test_create_environment_type(self):
        """Test creating environment type."""
        token = self.get_token_for_user(self.admin_user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        
        data = {
            'name': 'Fábrica',
            'description': 'Fábrica industrial'
        }
        response = self.client.post('/api/admin/environment-types/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Fábrica')


class RiskTypeTests(BaseConfigTestCase):
    """Tests for RiskType endpoints (F16.3)."""
    
    def test_list_risk_types(self):
        """Test listing risk types."""
        token = self.get_token_for_user(self.regular_user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        
        response = self.client.get('/api/admin/risk-types/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Queda')
    
    def test_create_risk_type(self):
        """Test creating risk type."""
        token = self.get_token_for_user(self.admin_user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        
        data = {
            'name': 'Incêndio',
            'description': 'Risco de incêndio'
        }
        response = self.client.post('/api/admin/risk-types/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Incêndio')


class AIThresholdTests(BaseConfigTestCase):
    """Tests for AIThreshold endpoints (F16.6)."""
    
    def test_get_current_confidence_threshold(self):
        """Test getting current confidence threshold."""
        token = self.get_token_for_user(self.regular_user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        
        response = self.client.get('/api/admin/ai-thresholds/confidence/current/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['threshold_value'], '60.00')
    
    def test_update_confidence_threshold(self):
        """Test updating confidence threshold."""
        token = self.get_token_for_user(self.admin_user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        
        data = {'threshold_value': 75.00}
        response = self.client.put('/api/admin/ai-thresholds/confidence/', data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['threshold_value'], '75.00')
        
        # Check audit log was created
        audit_log = AuditLog.objects.filter(
            entity_type='AIThreshold',
            action=AuditLog.ACTION_UPDATE
        ).first()
        self.assertIsNotNone(audit_log)
    
    def test_update_confidence_threshold_as_regular_user(self):
        """Test updating confidence threshold as regular user (should fail)."""
        token = self.get_token_for_user(self.regular_user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        
        data = {'threshold_value': 75.00}
        response = self.client.put('/api/admin/ai-thresholds/confidence/', data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_default_threshold_value(self):
        """Test that default threshold is 60%."""
        # Create new threshold to test default
        threshold = AIThreshold.objects.create(
            threshold_type=AIThreshold.THRESHOLD_TYPE_SEVERITY,
            description='Test threshold'
        )
        self.assertEqual(threshold.threshold_value, 60.00)


class AuditLogTests(BaseConfigTestCase):
    """Tests for AuditLog endpoints."""
    
    def test_list_audit_logs(self):
        """Test listing audit logs."""
        # Create an audit log entry
        AuditLog.objects.create(
            entity_type='AssessmentType',
            entity_id=1,
            action=AuditLog.ACTION_CREATE,
            performed_by=self.admin_user
        )
        
        token = self.get_token_for_user(self.admin_user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        
        response = self.client.get('/api/admin/audit-logs/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
    
    def test_filter_audit_logs_by_entity_type(self):
        """Test filtering audit logs by entity type."""
        AuditLog.objects.create(
            entity_type='AssessmentType',
            entity_id=1,
            action=AuditLog.ACTION_CREATE,
            performed_by=self.admin_user
        )
        AuditLog.objects.create(
            entity_type='RiskType',
            entity_id=1,
            action=AuditLog.ACTION_CREATE,
            performed_by=self.admin_user
        )
        
        token = self.get_token_for_user(self.admin_user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        
        response = self.client.get('/api/admin/audit-logs/?entity_type=AssessmentType')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
