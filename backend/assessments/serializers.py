from rest_framework import serializers
from .models import Evidence, RiskAssessment

class RiskAssessmentSerializer(serializers.ModelSerializer):
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


class EvidenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Evidence
        fields = ['id', 'file', 'file_hash', 'file_size', 'mime_type', 'captured_at', 'created_at']
        read_only_fields = ['file_hash', 'file_size', 'mime_type', 'captured_at', 'created_at']

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
