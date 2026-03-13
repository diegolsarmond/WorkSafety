from rest_framework import serializers
from .models import (
    Evidence,
    RiskAssessment,
    RiskFinding,
    AIInferenceResult,
    HumanValidationDecision,
    AssessmentStatusHistory,
)


class EvidenceSerializer(serializers.ModelSerializer):
    """Serializer para evidências (fotos)."""
    url = serializers.SerializerMethodField()
    
    class Meta:
        model = Evidence
        fields = ['id', 'file', 'url', 'file_hash', 'file_size', 'mime_type', 'captured_at', 'created_at']
        read_only_fields = ['file_hash', 'file_size', 'mime_type', 'captured_at', 'created_at']
    
    def get_url(self, obj: Evidence) -> str:
        """Retorna a URL completa do arquivo."""
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return ""


class EvidenceRefSerializer(serializers.ModelSerializer):
    """Serializer simplificado para referência de evidência (miniatura)."""
    thumbnail_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Evidence
        fields = ['id', 'thumbnail_url', 'captured_at']
    
    def get_thumbnail_url(self, obj: Evidence) -> str:
        """Retorna a URL da evidência para exibição."""
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
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
        return recommendations.get(obj.severity.upper(), [])
    
    def get_ai_confidence(self, obj: RiskFinding) -> str:
        """Retorna a confiança da IA se disponível."""
        inference = AIInferenceResult.objects.filter(
            assessment=obj.assessment
        ).first()
        if inference:
            return inference.confidence
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
    
    class Meta:
        model = RiskAssessment
        fields = [
            'id', 'title', 'description', 'status', 'created_by_email',
            'risk_count', 'captured_at', 'ai_reviewed_at', 
            'human_validated_at', 'created_at'
        ]
    
    def get_created_by_email(self, obj: RiskAssessment) -> str:
        return obj.created_by.email if obj.created_by else ""
    
    def get_risk_count(self, obj: RiskAssessment) -> int:
        return obj.findings.count()


class RiskAssessmentDetailSerializer(serializers.ModelSerializer):
    """Serializer detalhado para avaliação com riscos e evidências."""
    created_by_email = serializers.SerializerMethodField()
    risks = RiskItemSerializer(source='findings', many=True, read_only=True)
    evidences = EvidenceSerializer(many=True, read_only=True)
    inferences = AIInferenceDetailSerializer(many=True, read_only=True)
    compliance_score = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    valid_transitions = serializers.SerializerMethodField()
    
    class Meta:
        model = RiskAssessment
        fields = [
            'id', 'title', 'description', 'status', 'status_display',
            'created_by', 'created_by_email', 'risks', 'evidences', 
            'inferences', 'compliance_score', 'valid_transitions',
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
            weight = severity_weights.get(risk.severity.upper(), 50)
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
    class Meta:
        model = RiskAssessment
        fields = [
            'id', 'created_by', 'status', 'title', 'description',
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
