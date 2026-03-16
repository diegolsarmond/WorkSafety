# Generated migration for OlimpiaDetectionResult model

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("assessments", "0014_lgpd_privacy_compliance"),
    ]

    operations = [
        migrations.CreateModel(
            name="OlimpiaDetectionResult",
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
                    "rule_id",
                    models.CharField(
                        blank=True, max_length=50, verbose_name="ID da regra"
                    ),
                ),
                (
                    "rule_name",
                    models.CharField(
                        blank=True, max_length=200, verbose_name="nome da regra"
                    ),
                ),
                ("description", models.TextField(verbose_name="descrição da detecção")),
                (
                    "confidence",
                    models.DecimalField(
                        blank=True,
                        decimal_places=3,
                        max_digits=4,
                        null=True,
                        verbose_name="confiança",
                    ),
                ),
                (
                    "bbox_x1",
                    models.DecimalField(
                        decimal_places=4, default=0, max_digits=5, verbose_name="X1"
                    ),
                ),
                (
                    "bbox_y1",
                    models.DecimalField(
                        decimal_places=4, default=0, max_digits=5, verbose_name="Y1"
                    ),
                ),
                (
                    "bbox_x2",
                    models.DecimalField(
                        decimal_places=4, default=1, max_digits=5, verbose_name="X2"
                    ),
                ),
                (
                    "bbox_y2",
                    models.DecimalField(
                        decimal_places=4, default=1, max_digits=5, verbose_name="Y2"
                    ),
                ),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("EPI", "EPI - Equipamento de Proteção Individual"),
                            ("QUEDA", "Queda de Altura"),
                            ("ESCAVACAO", "Escavação/Vala"),
                            ("MAQUINARIO", "Máquinas e Equipamentos"),
                            ("ESPACO_CONFINADO", "Espaço Confinado"),
                            ("ELETRICO", "Risco Elétrico"),
                            ("GENERAL", "Geral"),
                        ],
                        default="GENERAL",
                        max_length=30,
                        verbose_name="categoria",
                    ),
                ),
                (
                    "severity",
                    models.CharField(
                        choices=[
                            ("CRITICAL", "Crítica"),
                            ("HIGH", "Alta"),
                            ("MEDIUM", "Média"),
                            ("LOW", "Baixa"),
                        ],
                        default="MEDIUM",
                        max_length=20,
                        verbose_name="severidade",
                    ),
                ),
                (
                    "recommendation",
                    models.TextField(blank=True, verbose_name="recomendação"),
                ),
                (
                    "processed_image",
                    models.FileField(
                        blank=True,
                        max_length=500,
                        null=True,
                        upload_to="processed_detections/%Y/%m/",
                        verbose_name="imagem processada",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="criado em")),
                (
                    "evidence",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="olimpia_detections",
                        to="assessments.evidence",
                        verbose_name="evidência",
                    ),
                ),
                (
                    "inference",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="olimpia_detections",
                        to="assessments.aiinferenceresult",
                        verbose_name="inferência",
                    ),
                ),
            ],
            options={
                "verbose_name": "detecção Olímpia",
                "verbose_name_plural": "detecções Olímpia",
                "ordering": ["-confidence", "-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="olimpiadetectionresult",
            index=models.Index(
                fields=["evidence", "-confidence"], name="assessments_evidence_8c9ed3_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="olimpiadetectionresult",
            index=models.Index(
                fields=["category", "-confidence"], name="assessments_categor_7c12b1_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="olimpiadetectionresult",
            index=models.Index(
                fields=["severity", "-confidence"], name="assessments_severit_7a3ed1_idx"
            ),
        ),
    ]
