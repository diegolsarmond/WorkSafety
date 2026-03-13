"""
Migration: Create AssessmentStatusHistory model and rename error -> error_ai.

- Creates the AssessmentStatusHistory table for full transition audit log
- Renames RiskAssessment status 'error' to 'error_ai'
- Updates existing records that have status='error' to 'error_ai'
"""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def rename_error_to_error_ai(apps, schema_editor):
    """Update existing records with status='error' to 'error_ai'."""
    RiskAssessment = apps.get_model("assessments", "RiskAssessment")
    RiskAssessment.objects.filter(status="error").update(status="error_ai")


def rename_error_ai_to_error(apps, schema_editor):
    """Reverse: Update existing records with status='error_ai' back to 'error'."""
    RiskAssessment = apps.get_model("assessments", "RiskAssessment")
    RiskAssessment.objects.filter(status="error_ai").update(status="error")


class Migration(migrations.Migration):

    dependencies = [
        ("assessments", "0011_update_ai_inference_result"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. Create AssessmentStatusHistory table
        migrations.CreateModel(
            name="AssessmentStatusHistory",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "from_status",
                    models.CharField(
                        choices=[
                            ("draft", "Rascunho"),
                            ("captured", "Capturado"),
                            ("synced", "Sincronizado"),
                            ("ai_reviewed", "Revisado por IA"),
                            ("human_validated", "Validado por Humano"),
                            ("finalized", "Finalizado"),
                            ("error_ai", "Erro IA"),
                        ],
                        max_length=20,
                        verbose_name="de",
                    ),
                ),
                (
                    "to_status",
                    models.CharField(
                        choices=[
                            ("draft", "Rascunho"),
                            ("captured", "Capturado"),
                            ("synced", "Sincronizado"),
                            ("ai_reviewed", "Revisado por IA"),
                            ("human_validated", "Validado por Humano"),
                            ("finalized", "Finalizado"),
                            ("error_ai", "Erro IA"),
                        ],
                        max_length=20,
                        verbose_name="para",
                    ),
                ),
                (
                    "changed_at",
                    models.DateTimeField(
                        auto_now_add=True,
                        db_index=True,
                        verbose_name="alterado em",
                    ),
                ),
                (
                    "reason",
                    models.TextField(
                        blank=True,
                        default="",
                        verbose_name="motivo",
                    ),
                ),
                (
                    "assessment",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="status_history",
                        to="assessments.riskassessment",
                    ),
                ),
                (
                    "changed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="assessment_status_changes",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="alterado por",
                    ),
                ),
            ],
            options={
                "verbose_name": "histórico de status",
                "verbose_name_plural": "histórico de status",
                "ordering": ["-changed_at"],
            },
        ),
        # 2. Add composite index for efficient history queries
        migrations.AddIndex(
            model_name="assessmentstatushistory",
            index=models.Index(
                fields=["assessment", "-changed_at"],
                name="assessments__assessm_b1e2c3_idx",
            ),
        ),
        # 3. Update RiskAssessment.status choices (error -> error_ai)
        migrations.AlterField(
            model_name="riskassessment",
            name="status",
            field=models.CharField(
                choices=[
                    ("draft", "Rascunho"),
                    ("captured", "Capturado"),
                    ("synced", "Sincronizado"),
                    ("ai_reviewed", "Revisado por IA"),
                    ("human_validated", "Validado por Humano"),
                    ("finalized", "Finalizado"),
                    ("error_ai", "Erro IA"),
                ],
                default="draft",
                max_length=20,
            ),
        ),
        # 4. Data migration: rename existing 'error' to 'error_ai'
        migrations.RunPython(
            rename_error_to_error_ai,
            rename_error_ai_to_error,
        ),
    ]
