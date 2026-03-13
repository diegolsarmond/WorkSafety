from rest_framework import serializers
from .models import Report


class ReportSerializer(serializers.ModelSerializer):
    """
    Serializer para relatórios.
    
    Campos expostos para compatibilidade com WorkSafetyWeb/src/pages/Reports.tsx:
    - id, assessment_id, status, file_url, created_at
    """
    assessment_id = serializers.IntegerField(source='assessment.id', read_only=True)
    file_url = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Report
        fields = [
            'id',
            'assessment_id',
            'status',
            'status_display',
            'file_url',
            'error_message',
            'generation_time_seconds',
            'generated_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_file_url(self, obj: Report) -> str | None:
        """Retorna a URL completa do arquivo PDF."""
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class ReportGenerateRequestSerializer(serializers.Serializer):
    """Serializer para requisição de geração de relatório."""
    assessment_id = serializers.IntegerField(
        help_text="ID da avaliação para gerar o relatório"
    )


class ReportGenerateResponseSerializer(serializers.Serializer):
    """Serializer para resposta de geração de relatório."""
    message = serializers.CharField()
    report_id = serializers.IntegerField()
    task_id = serializers.CharField()
    status = serializers.CharField()
