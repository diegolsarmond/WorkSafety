# Generated manually on 2026-03-12

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('assessments', '0007_remove_evidence_uq_evidence_client_ref_assessment_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='evidence',
            name='captured_at',
            field=models.DateTimeField(
                blank=True,
                db_index=True,
                help_text='Timestamp informado pelo cliente (quando a foto foi tirada). Se não informado, permanece null.',
                null=True,
                verbose_name='timestamp de captura',
            ),
        ),
    ]
