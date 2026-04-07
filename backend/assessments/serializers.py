from rest_framework import serializers
from django.urls import reverse
from django.conf import settings
from .models import (
    Evidence,
    RiskAssessment,
    RiskFinding,
    AIInferenceResult,
    HumanValidationDecision,
    AssessmentStatusHistory,
)
from configurations.models import AssessmentType, EnvironmentType


class AssessmentTypeRefSerializer(serializers.ModelSerializer):
    """Serializer para referência de tipo de avaliação (resumo)."""

    class Meta:
        model = AssessmentType
        fields = ['id', 'name', 'description', 'active']


class EnvironmentTypeRefSerializer(serializers.ModelSerializer):
    """Serializer para referência de tipo de ambiente (resumo)."""

    class Meta:
        model = EnvironmentType
        fields = ['id', 'name', 'description', 'active']


class EvidenceSerializer(serializers.ModelSerializer):
    """Serializer para evidências (fotos) com campos LGPD/GDPR."""
    url = serializers.SerializerMethodField()
    privacy_status = serializers.SerializerMethodField()

    class Meta:
        model = Evidence
        fields = [
            'id', 'file', 'url', 'file_hash', 'file_size', 'mime_type',
            'captured_at', 'created_at', 'updated_at',
            # Campos LGPD/GDPR
            'is_anonymized', 'anonymization_status', 'anonymized_at',
            'privacy_status',
        ]
        read_only_fields = [
            'file_hash', 'file_size', 'mime_type', 'captured_at', 'created_at', 'updated_at',
            'is_anonymized', 'anonymization_status', 'anonymized_at',
            'privacy_status',
        ]

    def get_url(self, obj: Evidence) -> str:
        """Retorna URL de download da API sem depender de /media no proxy."""
        if obj.file:
            download_path = reverse('evidence-download', kwargs={'evidence_id': obj.id})
            public_prefix = getattr(settings, 'PUBLIC_API_PREFIX', '/api/')
            normalized_prefix = '/' + public_prefix.strip('/') + '/'
            if download_path.startswith('/api/'):
                download_path = normalized_prefix + download_path[len('/api/'):]
            return download_path
        return ""

    def get_privacy_status(self, obj: Evidence) -> dict:
        """Retorna status de privacidade/LGPD da evidência."""
        return {
            'is_anonymized': obj.is_anonymized,
            'anonymization_status': obj.anonymization_status,
            'anonymized_at': obj.anonymized_at,
            'has_original_hash': bool(obj.original_file_hash),
        }


class EvidenceRefSerializer(serializers.ModelSerializer):
    """Serializer simplificado para referência de evidência (miniatura)."""
    thumbnail_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Evidence
        fields = ['id', 'thumbnail_url', 'captured_at']
    
    def get_thumbnail_url(self, obj: Evidence) -> str:
        """Retorna URL de evidência para exibição via API."""
        if obj.file:
            download_path = reverse('evidence-download', kwargs={'evidence_id': obj.id})
            public_prefix = getattr(settings, 'PUBLIC_API_PREFIX', '/api/')
            normalized_prefix = '/' + public_prefix.strip('/') + '/'
            if download_path.startswith('/api/'):
                download_path = normalized_prefix + download_path[len('/api/'):]
            return download_path
        return ""


class RecommendationSerializer(serializers.Serializer):
    """Serializer para recomendações de segurança."""
    id = serializers.CharField()
    title = serializers.CharField()
    description = serializers.CharField()
    priority = serializers.CharField()


class RiskItemSerializer(serializers.ModelSerializer):
    """Serializer para itens de risco detectados."""
    evidence = EvidenceRefSerializer(read_only=True)
    recommendations = serializers.SerializerMethodField()
    ai_confidence = serializers.SerializerMethodField()
    risk_status = serializers.SerializerMethodField()
    
    class Meta:
        model = RiskFinding
        fields = [
            'id', 'description', 'severity', 'location',
            'evidence', 'recommendations', 'ai_confidence', 'risk_status',
            'created_at', 'updated_at'
        ]
    
    def get_recommendations(self, obj: RiskFinding) -> list:
        """Retorna recomendações baseadas na severidade."""
        recommendations = {
            'CRITICAL': [
                {'id': '1', 'title': 'Immediate Action Required', 'description': 'Address immediately to prevent accidents', 'priority': 'critical'},
                {'id': '2', 'title': 'Stop Work', 'description': 'Halt operations in affected area', 'priority': 'critical'},
            ],
            'HIGH': [
                {'id': '3', 'title': 'Priority Fix', 'description': 'Address within 24 hours', 'priority': 'high'},
            ],
            'MEDIUM': [
                {'id': '4', 'title': 'Schedule Repair', 'description': 'Address within one week', 'priority': 'medium'},
            ],
            'LOW': [
                {'id': '5', 'title': 'Monitor', 'description': 'Monitor and address when possible', 'priority': 'low'},
            ],
        }
        severity = obj.severity.upper() if obj.severity else 'MEDIUM'
        return recommendations.get(severity, [])
    
    def get_ai_confidence(self, obj: RiskFinding) -> str:
        """Retorna a confiança da IA formatada como percentual."""
        if obj.ai_confidence:
            return f"{obj.ai_confidence * 100:.0f}%"
        return ""
    
    def get_risk_status(self, obj: RiskFinding) -> str:
        """Retorna o status de validação do risco."""
        inference = AIInferenceResult.objects.filter(
            assessment=obj.assessment
        ).first()
        if inference:
            decision = HumanValidationDecision.objects.filter(
                inference=inference
            ).first()
            if decision:
                return decision.decision
        # Retorna status baseado no ciclo de vida da avaliação
        status_map = {
            'draft': 'pending',
            'captured': 'pending',
            'synced': 'pending',
            'ai_reviewed': 'ai_detected',
            'human_validated': 'validated',
            'finalized': 'validated',
            'error_ai': 'error',
        }
        return status_map.get(obj.assessment.status, 'pending')


class AIInferenceDetailSerializer(serializers.ModelSerializer):
    """Serializer para resultados de inferência da IA."""
    decisions = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = AIInferenceResult
        fields = [
            'id', 'status', 'status_display', 'result_json', 'confidence',
            'error_message', 'model_version', 'started_at', 'finished_at',
            'decisions', 'created_at'
        ]
    
    def get_decisions(self, obj: AIInferenceResult) -> list:
        """Retorna as decisões de validação humana."""
        decisions = HumanValidationDecision.objects.filter(inference=obj)
        return [
            {
                'id': d.id,
                'decision': d.decision,
                'comment': d.comment,
                'validator': d.validator.email if d.validator else None,
                'created_at': d.created_at,
            }
            for d in decisions
        ]


class RiskAssessmentListSerializer(serializers.ModelSerializer):
    """Serializer para listagem de avaliações."""
    created_by_email = serializers.SerializerMethodField()
    risk_count = serializers.SerializerMethodField()
    assessment_type = AssessmentTypeRefSerializer(read_only=True)
    environment_type = EnvironmentTypeRefSerializer(read_only=True)
    legal_basis_display = serializers.CharField(source='get_legal_basis_display', read_only=True)

    class Meta:
        model = RiskAssessment
        fields = [
            'id', 'title', 'description', 'status', 'created_by_email',
            'risk_count', 'assessment_type', 'environment_type',
            'legal_basis', 'legal_basis_display',
            'captured_at', 'ai_reviewed_at',
            'human_validated_at', 'created_at',
        ]

    def get_created_by_email(self, obj: RiskAssessment) -> str:
        return obj.created_by.email if obj.created_by else ""

    def get_risk_count(self, obj: RiskAssessment) -> int:
        return obj.findings.count()


class RiskAssessmentDetailSerializer(serializers.ModelSerializer):
    """Serializer detalhado para avaliação com riscos e evidências."""
    created_by_email = serializers.SerializerMethodField()
    risks = serializers.SerializerMethodField()
    evidences = EvidenceSerializer(many=True, read_only=True)
    inferences = AIInferenceDetailSerializer(many=True, read_only=True)
    compliance_score = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    valid_transitions = serializers.SerializerMethodField()
    assessment_type = AssessmentTypeRefSerializer(read_only=True)
    environment_type = EnvironmentTypeRefSerializer(read_only=True)
    legal_basis_display = serializers.CharField(source='get_legal_basis_display', read_only=True)

    class Meta:
        model = RiskAssessment
        fields = [
            'id', 'title', 'description', 'status', 'status_display',
            'created_by', 'created_by_email', 'risks', 'evidences',
            'inferences', 'compliance_score', 'valid_transitions',
            'assessment_type', 'environment_type',
            'legal_basis', 'legal_basis_display', 'legal_basis_notes',
            'captured_at', 'synced_at', 'ai_reviewed_at',
            'human_validated_at', 'finalized_at',
            'status_changed_at', 'status_change_reason',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_by', 'status', 'captured_at', 'synced_at',
            'ai_reviewed_at', 'human_validated_at', 'finalized_at',
            'status_changed_at', 'status_changed_by',
            'created_at', 'updated_at'
        ]

    def get_created_by_email(self, obj: RiskAssessment) -> str:
        return obj.created_by.email if obj.created_by else ""

    def get_risks(self, obj: RiskAssessment) -> list:
        """
        Retorna riscos priorizando o payload bruto da API Olímpia.

        Suporta dois formatos:
          Novo  (v2): {"rule_1": {"name":"...", "violations":[{...}]}, ...}
          Legado:     {"rule_1_violation": [{...}], ...}
        """
        latest_inference = obj.inferences.first()
        raw_result = latest_inference.result_json if latest_inference else {}

        # Legacy wrapper: individual_responses
        if isinstance(raw_result, dict) and 'individual_responses' in raw_result:
            merged: dict = {}
            for resp in (raw_result.get('individual_responses') or []):
                if not isinstance(resp, dict):
                    continue
                for k, v in resp.items():
                    if not k.endswith('_violation'):
                        continue
                    if v is None:
                        merged.setdefault(k, None)
                    elif isinstance(v, list):
                        if not isinstance(merged.get(k), list):
                            merged[k] = []
                        merged[k].extend(v)
            if merged:
                raw_result = merged

        if not isinstance(raw_result, dict):
            return []

        severity_by_rule = {
            'rule_1': 'HIGH',   'rule_1_violation': 'HIGH',
            'rule_2': 'CRITICAL', 'rule_2_violation': 'CRITICAL',
            'rule_3': 'HIGH',   'rule_3_violation': 'HIGH',
            'rule_4': 'CRITICAL', 'rule_4_violation': 'CRITICAL',
            'rule_5': 'CRITICAL', 'rule_5_violation': 'CRITICAL',
            'rule_6': 'HIGH',   'rule_6_violation': 'HIGH',
            'rule_7': 'MEDIUM', 'rule_7_violation': 'MEDIUM',
            'rule_8': 'MEDIUM', 'rule_8_violation': 'MEDIUM',
        }

        # Collect (rule_key, detections_list) pairs from either format
        rule_detections: list = []
        for key, value in raw_result.items():
            if isinstance(value, dict) and 'violations' in value:
                # New format: rule_1 → {violations: [...]}
                detections = value.get('violations') or []
                if isinstance(detections, list):
                    rule_detections.append((key, detections))
            elif key.endswith('_violation') and isinstance(value, list):
                # Legacy format: rule_1_violation → [...]
                rule_detections.append((key, value))

        if not rule_detections:
            return []

        # Build list of all evidences to associate with detections
        evidence_list = list(obj.evidences.all())
        evidence_payloads = {}
        for idx, ev in enumerate(evidence_list):
            evidence_payloads[idx] = EvidenceRefSerializer(ev, context=self.context).data
        default_evidence_payload = evidence_payloads.get(0)

        status_map = {
            'draft': 'pending',
            'captured': 'pending',
            'synced': 'pending',
            'ai_reviewed': 'ai_detected',
            'human_validated': 'validated',
            'finalized': 'validated',
            'error_ai': 'error',
        }
        risk_status = status_map.get(obj.status, 'pending')

        risks = []
        for rule_key, detections in sorted(rule_detections, key=lambda x: x[0]):
            for detection_index, detection in enumerate(detections, start=1):
                if not isinstance(detection, dict):
                    continue

                reason = detection.get('reason') or ''
                confidence = detection.get('confidence')
                try:
                    confidence_pct = f"{float(confidence) * 100:.0f}%"
                except (TypeError, ValueError):
                    confidence_pct = ''

                bounding_box = detection.get('bounding_box')
                if not isinstance(bounding_box, list):
                    bounding_box = []

                ev_idx = detection.get('evidence_index')
                if ev_idx is not None and ev_idx in evidence_payloads:
                    evidence_payload = evidence_payloads[ev_idx]
                else:
                    evidence_payload = default_evidence_payload

                risks.append({
                    'id': f"{obj.id}-{rule_key}-{detection_index}",
                    'description': reason,
                    'reason': reason,
                    'rule_id': rule_key,
                    'bounding_box': bounding_box,
                    'severity': severity_by_rule.get(rule_key, 'MEDIUM'),
                    'location': '',
                    'evidence': evidence_payload,
                    'recommendations': [],
                    'ai_confidence': confidence_pct,
                    'risk_status': risk_status,
                    'created_at': obj.created_at,
                    'updated_at': obj.updated_at,
                })

        return risks

    def get_compliance_score(self, obj: RiskAssessment) -> int:
        """Calcula score de compliance baseado nos riscos."""
        risks = obj.findings.all()
        if not risks:
            return 100

        severity_weights = {
            'CRITICAL': 0,
            'HIGH': 25,
            'MEDIUM': 50,
            'LOW': 75,
        }

        total_score = 0
        for risk in risks:
            severity = risk.severity.upper() if risk.severity else 'MEDIUM'
            weight = severity_weights.get(severity, 50)
            total_score += weight

        return min(100, max(0, int(total_score / len(risks))))

    def get_status_display(self, obj: RiskAssessment) -> str:
        return obj.get_status_display()

    def get_valid_transitions(self, obj: RiskAssessment) -> list:
        """Retorna transições válidas do status atual."""
        from .services import AssessmentLifecycleService
        transitions = AssessmentLifecycleService.get_valid_transitions(obj.status)
        return [
            {'value': t, 'label': dict(RiskAssessment.STATUS_CHOICES).get(t, t)}
            for t in transitions
        ]


class RiskAssessmentSerializer(serializers.ModelSerializer):
    """Serializer básico para criação/atualização."""
    assessment_type_id = serializers.PrimaryKeyRelatedField(
        queryset=AssessmentType.objects.all(),
        source='assessment_type',
        required=False,
        allow_null=True,
        write_only=True,
    )
    environment_type_id = serializers.PrimaryKeyRelatedField(
        queryset=EnvironmentType.objects.all(),
        source='environment_type',
        required=False,
        allow_null=True,
        write_only=True,
    )
    legal_basis_display = serializers.CharField(source='get_legal_basis_display', read_only=True)

    class Meta:
        model = RiskAssessment
        fields = [
            'id', 'created_by', 'status', 'title', 'description',
            'assessment_type_id', 'environment_type_id',
            'legal_basis', 'legal_basis_display', 'legal_basis_notes',
            'captured_at', 'synced_at', 'ai_reviewed_at',
            'human_validated_at', 'finalized_at',
            'status_changed_at', 'status_change_reason',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_by', 'status',
            'captured_at', 'synced_at', 'ai_reviewed_at',
            'human_validated_at', 'finalized_at',
            'status_changed_at', 'status_changed_by',
            'created_at', 'updated_at'
        ]

    def validate_assessment_type(self, value: AssessmentType | None) -> AssessmentType | None:
        """Valida que o tipo de avaliação está ativo."""
        if value is not None and not value.active:
            raise serializers.ValidationError("Tipo de avaliação inativo não pode ser selecionado.")
        return value

    def validate_environment_type(self, value: EnvironmentType | None) -> EnvironmentType | None:
        """Valida que o tipo de ambiente está ativo."""
        if value is not None and not value.active:
            raise serializers.ValidationError("Tipo de ambiente inativo não pode ser selecionado.")
        return value


class RiskAssessmentStatusSerializer(serializers.Serializer):
    """Serializer para respostas de transição de status."""
    status = serializers.CharField()
    previous_status = serializers.CharField(required=False)
    message = serializers.CharField(required=False)
    timestamp = serializers.DateTimeField(required=False)


class AssessmentStatusHistorySerializer(serializers.ModelSerializer):
    """Serializer para o histórico de transições de status."""
    changed_by_email = serializers.SerializerMethodField()
    from_status_display = serializers.SerializerMethodField()
    to_status_display = serializers.SerializerMethodField()

    class Meta:
        model = AssessmentStatusHistory
        fields = [
            'id', 'assessment', 'from_status', 'from_status_display',
            'to_status', 'to_status_display', 'changed_by', 'changed_by_email',
            'changed_at', 'reason',
        ]
        read_only_fields = fields

    def get_changed_by_email(self, obj: AssessmentStatusHistory) -> str:
        return obj.changed_by.email if obj.changed_by else ""

    def get_from_status_display(self, obj: AssessmentStatusHistory) -> str:
        return str(dict(RiskAssessment.STATUS_CHOICES).get(obj.from_status, obj.from_status))

    def get_to_status_display(self, obj: AssessmentStatusHistory) -> str:
        return str(dict(RiskAssessment.STATUS_CHOICES).get(obj.to_status, obj.to_status))


class EvidenceUploadSerializer(serializers.Serializer):
    images = serializers.ListField(
        child=serializers.ImageField(),
        max_length=10,
        help_text="Lista de até 10 imagens (evidências)."
    )
    timestamps = serializers.ListField(
        child=serializers.DateTimeField(),
        required=False,
        help_text="Lista de timestamps em ISO 8601 correspondentes a cada imagem."
    )

    def validate(self, data):
        images = data.get('images', [])
        timestamps = data.get('timestamps', [])
        if timestamps and len(timestamps) != len(images):
            raise serializers.ValidationError({"timestamps": "A quantidade de timestamps deve corresponder à quantidade de imagens."})
        return data


class AIQueueItemSerializer(serializers.Serializer):
    """Serializer para itens da fila de processamento IA."""
    assessment_id = serializers.IntegerField()
    title = serializers.CharField()
    status = serializers.CharField()
    status_display = serializers.CharField()
    ai_status = serializers.CharField()
    ai_status_display = serializers.CharField()
    confidence = serializers.CharField(required=False, allow_blank=True)
    error_message = serializers.CharField(required=False, allow_blank=True)
    created_at = serializers.DateTimeField()
    started_at = serializers.DateTimeField(required=False, allow_null=True)
    finished_at = serializers.DateTimeField(required=False, allow_null=True)
    evidence_count = serializers.IntegerField()
    thumbnail_url = serializers.CharField(required=False, allow_blank=True)
