# Generated migration for RiskFinding location and evidence fields

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("assessments", "0009_assessment_lifecycle_states"),
    ]

    operations = [
        migrations.AddField(
            model_name="riskfinding",
            name="location",
            field=models.CharField(
                blank=True, 
                max_length=255, 
                verbose_name="localização"
            ),
        ),
        migrations.AddField(
            model_name="riskfinding",
            name="evidence",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="findings",
                to="assessments.evidence",
                verbose_name="evidência",
            ),
        ),
    ]
