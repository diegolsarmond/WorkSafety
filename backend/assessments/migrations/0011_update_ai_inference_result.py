"""
Update AIInferenceResult model to support status tracking and detailed logging.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("assessments", "0010_riskfinding_evidence_riskfinding_location"),
    ]

    operations = [
        # Add status field
        migrations.AddField(
            model_name="aiinferenceresult",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pendente"),
                    ("running", "Em execução"),
                    ("succeeded", "Sucesso"),
                    ("failed", "Falha"),
                ],
                default="pending",
                max_length=20,
                verbose_name="status",
            ),
        ),
        # Add error_message field
        migrations.AddField(
            model_name="aiinferenceresult",
            name="error_message",
            field=models.TextField(
                blank=True,
                verbose_name="mensagem de erro",
            ),
        ),
        # Add model_version field
        migrations.AddField(
            model_name="aiinferenceresult",
            name="model_version",
            field=models.CharField(
                blank=True,
                max_length=100,
                verbose_name="versão do modelo",
            ),
        ),
        # Add started_at field
        migrations.AddField(
            model_name="aiinferenceresult",
            name="started_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
                verbose_name="iniciado em",
            ),
        ),
        # Add finished_at field
        migrations.AddField(
            model_name="aiinferenceresult",
            name="finished_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
                verbose_name="finalizado em",
            ),
        ),
        # Rename raw_result to result_json for clarity
        migrations.RenameField(
            model_name="aiinferenceresult",
            old_name="raw_result",
            new_name="result_json",
        ),
    ]
