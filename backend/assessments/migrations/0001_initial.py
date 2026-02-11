# Generated manually for F12.1–F12.5 (RiskAssessment, Evidence, RiskFinding, AIInferenceResult, HumanValidationDecision)

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="RiskAssessment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("draft", "Rascunho"), ("submitted", "Enviada"), ("in_review", "Em revisão"), ("closed", "Encerrada")], default="draft", max_length=20)),
                ("title", models.CharField(blank=True, max_length=255, verbose_name="título")),
                ("description", models.TextField(blank=True, verbose_name="descrição")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(null=True, on_delete=models.SET_NULL, related_name="risk_assessments", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "avaliação de risco",
                "verbose_name_plural": "avaliações de risco",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="AIInferenceResult",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("raw_result", models.JSONField(blank=True, default=dict, verbose_name="resultado bruto")),
                ("confidence", models.CharField(blank=True, max_length=50, verbose_name="confiança")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("assessment", models.ForeignKey(on_delete=models.CASCADE, related_name="inferences", to="assessments.riskassessment")),
            ],
            options={
                "verbose_name": "resultado de inferência IA",
                "verbose_name_plural": "resultados de inferência IA",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="Evidence",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file", models.FileField(max_length=500, upload_to="assessments.models.evidence_upload_to", verbose_name="arquivo")),
                ("file_hash", models.CharField(blank=True, max_length=64, verbose_name="hash do arquivo")),
                ("file_size", models.BigIntegerField(blank=True, null=True, verbose_name="tamanho em bytes")),
                ("mime_type", models.CharField(blank=True, max_length=255, verbose_name="tipo MIME")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("assessment", models.ForeignKey(on_delete=models.CASCADE, related_name="evidences", to="assessments.riskassessment")),
            ],
            options={
                "verbose_name": "evidência",
                "verbose_name_plural": "evidências",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="RiskFinding",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("description", models.TextField(verbose_name="descrição")),
                ("severity", models.CharField(blank=True, max_length=50, verbose_name="severidade")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("assessment", models.ForeignKey(on_delete=models.CASCADE, related_name="findings", to="assessments.riskassessment")),
            ],
            options={
                "verbose_name": "achado de risco",
                "verbose_name_plural": "achados de risco",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="HumanValidationDecision",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("decision", models.CharField(choices=[("pending", "Pendente"), ("approved", "Aprovado"), ("rejected", "Rejeitado")], default="pending", max_length=20)),
                ("comment", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("inference", models.ForeignKey(on_delete=models.CASCADE, related_name="decisions", to="assessments.aiinferenceresult")),
                ("validator", models.ForeignKey(null=True, on_delete=models.SET_NULL, related_name="validation_decisions", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "decisão de validação humana",
                "verbose_name_plural": "decisões de validação humana",
                "ordering": ["-created_at"],
            },
        ),
    ]
