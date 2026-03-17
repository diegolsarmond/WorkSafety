# Generated migration file

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('assessments', '0015_olimpia_detection_result'),
    ]

    operations = [
        migrations.AddField(
            model_name='riskfinding',
            name='ai_confidence',
            field=models.DecimalField(
                blank=True,
                decimal_places=3,
                help_text='Confiança da detecção de IA para este risco específico',
                max_digits=4,
                null=True,
                verbose_name='confiança da IA'
            ),
        ),
    ]
