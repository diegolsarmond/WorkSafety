"""
Migration: LGPD/GDPR Privacy Compliance - Anonymization and Legal Basis.

Adds:
1. legal_basis and legal_basis_notes fields to RiskAssessment
2. Anonymization tracking fields to Evidence (is_anonymized, anonymized_at, etc.)
3. EvidenceAnonymizationLog model for audit trail
"""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("assessments", "0013_add_assessment_environment_types"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Add legal_basis field to RiskAssessment
        migrations.AddField(
            model_name="riskassessment",
            name="legal_basis",
            field=models.CharField(
                choices=[
                    ("consent", "Consentimento do titular"),
                    ("legitimate_interest", "Interesse legítimo"),
                    ("legal_obligation", "Cumprimento de obrigação legal"),
                    ("contract", "Execução de contrato"),
                    ("public_interest", "Missão de interesse público"),
                    ("vital_interest", "Proteção da vida"),
                ],
                default="legitimate_interest",
                help_text="Base legal para processamento de dados pessoais conforme LGPD/GDPR",
                max_length=30,
                verbose_name="base legal LGPD",
            ),
        ),
        # Add legal_basis_notes field to RiskAssessment
        migrations.AddField(
            model_name="riskassessment",
            name="legal_basis_notes",
            field=models.TextField(
                blank=True,
                help_text="Justificativa adicional para a base legal selecionada",
                verbose_name="notas da base legal",
            ),
        ),
        # Add is_anonymized field to Evidence
        migrations.AddField(
            model_name="evidence",
            name="is_anonymized",
            field=models.BooleanField(
                default=False,
                help_text="Indica se a evidência foi processada para remoção de dados pessoais",
                verbose_name="anonimizado",
            ),
        ),
        # Add anonymized_at field to Evidence
        migrations.AddField(
            model_name="evidence",
            name="anonymized_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
                verbose_name="anonimizado em",
            ),
        ),
        # Add anonymization_status field to Evidence
        migrations.AddField(
            model_name="evidence",
            name="anonymization_status",
            field=models.CharField(
                choices=[
                    ("pending", "Pendente"),
                    ("processing", "Processando"),
                    ("completed", "Concluído"),
                    ("failed", "Falhou"),
                    ("skipped", "Ignorado"),
                ],
                default="pending",
                help_text="Estado atual do processo de anonimização",
                max_length=20,
                verbose_name="status da anonimização",
            ),
        ),
        # Add original_file_hash field to Evidence
        migrations.AddField(
            model_name="evidence",
            name="original_file_hash",
            field=models.CharField(
                blank=True,
                help_text="SHA-256 do arquivo original antes da anonimização (para auditoria)",
                max_length=64,
                verbose_name="hash do arquivo original",
            ),
        ),
        # Create EvidenceAnonymizationLog model
        migrations.CreateModel(
            name="EvidenceAnonymizationLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "operation",
                    models.CharField(
                        choices=[
                            ("anonymize", "Anonimização"),
                            ("restore", "Restauração"),
                            ("verify", "Verificação"),
                        ],
                        default="anonymize",
                        max_length=20,
                        verbose_name="operação",
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("success", "Sucesso"),
                            ("failed", "Falha"),
                            ("partial", "Parcial"),
                        ],
                        default="success",
                        max_length=20,
                        verbose_name="status",
                    ),
                ),
                (
                    "faces_detected",
                    models.IntegerField(blank=True, null=True, verbose_name="rostos detectados"),
                ),
                (
                    "faces_anonymized",
                    models.IntegerField(blank=True, null=True, verbose_name="rostos anonimizados"),
                ),
                (
                    "plates_detected",
                    models.IntegerField(blank=True, null=True, verbose_name="placas detectadas"),
                ),
                (
                    "plates_anonymized",
                    models.IntegerField(blank=True, null=True, verbose_name="placas anonimizadas"),
                ),
                ("error_message", models.TextField(blank=True, verbose_name="mensagem de erro")),
                (
                    "processing_duration_ms",
                    models.IntegerField(blank=True, null=True, verbose_name="duração do processamento (ms)"),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="anonymization_logs",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="executado por",
                    ),
                ),
                (
                    "evidence",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="anonymization_logs",
                        to="assessments.evidence",
                        verbose_name="evidência",
                    ),
                ),
            ],
            options={
                "verbose_name": "log de anonimização",
                "verbose_name_plural": "logs de anonimização",
                "ordering": ["-created_at"],
            },
        ),
        # Add index for EvidenceAnonymizationLog
        migrations.AddIndex(
            model_name="evidenceanonymizationlog",
            index=models.Index(fields=["evidence", "-created_at"], name="idx_ev_anon_evid_cat"),
        ),
        migrations.AddIndex(
            model_name="evidenceanonymizationlog",
            index=models.Index(fields=["operation", "status"], name="idx_ev_anon_op_stat"),
        ),
    ]
