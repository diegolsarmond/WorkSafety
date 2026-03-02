from rest_framework import serializers
from .models import Evidence, RiskAssessment

class RiskAssessmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = RiskAssessment
        fields = ['id', 'created_by', 'status', 'title', 'description', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']


class EvidenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Evidence
        fields = ['id', 'file', 'file_hash', 'file_size', 'mime_type', 'created_at']
        read_only_fields = ['file_hash', 'file_size', 'mime_type', 'created_at']

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
            raise serializers.ValidationError({"timestamps": "A quantidade de timestamps deve corresponder à quantidade de imagens, se enviados."})
        return data
