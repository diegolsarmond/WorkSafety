"""
Migration: Add assessment_type and environment_type FKs to RiskAssessment.

Adds foreign keys to configurations.AssessmentType and configurations.EnvironmentType,
supporting F16.1 and F16.2 features.
"""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("assessments", "0012_assessment_status_history"),
        ("configurations", "0001_initial"),
    ]

    operations = [
        # Add FK to AssessmentType (F16.1)
        migrations.AddField(
            model_name="riskassessment",
            name="assessment_type",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="assessments",
                to="configurations.assessmenttype",
                verbose_name="tipo de avaliação",
            ),
        ),
        # Add FK to EnvironmentType (F16.2)
        migrations.AddField(
            model_name="riskassessment",
            name="environment_type",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="assessments",
                to="configurations.environmenttype",
                verbose_name="tipo de ambiente",
            ),
        ),
    ]
