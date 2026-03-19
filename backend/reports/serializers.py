from rest_framework import serializers
from django.urls import reverse
from .models import Report


class ReportSerializer(serializers.ModelSerializer):
    """
    Serializer para relatórios.
    
    Campos expostos para compatibilidade com WorkSafetyWeb/src/pages/Reports.tsx:
    - id, assessment_id, status, file_url, created_at
    """
    assessment_id = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    generation_time_seconds = serializers.SerializerMethodField()
    
    def get_assessment_id(self, obj: Report) -> int | None:
        """Retorna o ID da avaliação ou None se não existir."""
        if obj.assessment_id:
            return int(obj.assessment_id)
        return None
    
    def get_generation_time_seconds(self, obj: Report) -> float | None:
        """Retorna o tempo de geração ou None se não existir."""
        if obj.generation_time_seconds is not None:
            return float(obj.generation_time_seconds)
        return None

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
        """Retorna URL da API para download do PDF sem depender de alias /media no proxy."""
        if obj.file:
            request = self.context.get('request')
            download_path = reverse('report-download', kwargs={'report_id': obj.id})
            if request:
                return request.build_absolute_uri(download_path)
            return download_path
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
