from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("assessments", "0005_human_validation_override_reason"),
    ]

    operations = [
        migrations.AddField(
            model_name="riskassessment",
            name="environment",
            field=models.CharField(blank=True, max_length=100, verbose_name="environment"),
        ),
        migrations.AddField(
            model_name="riskassessment",
            name="category",
            field=models.CharField(blank=True, max_length=100, verbose_name="category"),
        ),
    ]

