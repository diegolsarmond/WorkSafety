from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("assessments", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="riskassessment",
            name="client_ref",
            field=models.UUIDField(blank=True, null=True, unique=True, verbose_name="client_ref"),
        ),
        migrations.AddField(
            model_name="evidence",
            name="client_ref",
            field=models.UUIDField(blank=True, null=True, unique=True, verbose_name="client_ref"),
        ),
        migrations.AddField(
            model_name="evidence",
            name="captured_at",
            field=models.DateTimeField(blank=True, null=True, verbose_name="captured_at"),
        ),
        migrations.AddField(
            model_name="evidence",
            name="latitude",
            field=models.FloatField(blank=True, null=True, verbose_name="latitude"),
        ),
        migrations.AddField(
            model_name="evidence",
            name="longitude",
            field=models.FloatField(blank=True, null=True, verbose_name="longitude"),
        ),
    ]

