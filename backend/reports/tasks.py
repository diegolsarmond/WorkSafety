"""
Celery tasks para geração assíncrona de relatórios PDF.

Requisito F3.1: Geração de relatório PDF final.
Target: até 15s para 10 imagens.
"""
import io
import logging
import time
import os
from datetime import datetime, timedelta

from celery import shared_task
from django.utils import timezone
from django.db import transaction
from django.conf import settings
from django.template.loader import render_to_string

# WeasyPrint import
from weasyprint import HTML, CSS

from .models import Report
from assessments.models import RiskAssessment, Evidence, RiskFinding
from assessments.serializers import RiskAssessmentDetailSerializer

logger = logging.getLogger(__name__)

# Target de performance: 15s para 10 imagens
PERFORMANCE_TARGET_SECONDS = 15
MAX_IMAGES_TARGET = 10


def _resolve_inspector_name(created_by) -> str:
    """Resolve a display-safe inspector name for report rendering."""
    if not created_by:
        return "Not informed"

    full_name = (created_by.get_full_name() or "").strip()
    if full_name:
        return full_name

    email = (getattr(created_by, 'email', '') or '').strip()
    if email:
        return email.split('@', 1)[0]

    return "Not informed"


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def generate_report(self, report_id: int):
    """
    Gera um relatório PDF para uma avaliação de risco.
    
    Esta task é executada em background pelo Celery.
    Atualiza o status do relatório durante o processo.
    
    Args:
        report_id: ID do relatório a ser gerado
        
    Returns:
        dict: Resultado da operação com status e métricas
    """
    start_time = time.time()
    logger.info(f"Starting PDF generation for report {report_id}")
    
    try:
        # Carregar relatório
        try:
            report = Report.objects.select_related('assessment').get(id=report_id)
        except Report.DoesNotExist:
            logger.error(f"Report {report_id} not found")
            return {"status": "error", "message": "Report not found"}
        
        assessment = report.assessment
        
        # Atualizar status para generating (caso ainda não esteja)
        report.status = Report.STATUS_GENERATING
        report.save(update_fields=['status'])
        
        # Coletar dados da avaliação
        assessment_data = _collect_assessment_data(assessment)
        
        # Gerar PDF
        pdf_buffer = _generate_pdf_document(assessment, assessment_data)
        
        # Salvar arquivo
        timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")
        filename = f"report_assessment_{assessment.id}_{timestamp}.pdf"
        
        with transaction.atomic():
            # Salvar o arquivo
            report.file.save(filename, pdf_buffer, save=False)
            report.status = Report.STATUS_READY
            report.generated_at = timezone.now()
            report.generation_time_seconds = round(time.time() - start_time, 3)
            report.error_message = ""
            report.save()
        
        elapsed_time = time.time() - start_time
        evidence_count = len(assessment_data.get('evidences', []))
        
        # Log de performance
        _log_performance_metrics(elapsed_time, evidence_count)
        
        logger.info(
            f"Report {report_id} generated successfully in {elapsed_time:.2f}s "
            f"({evidence_count} evidences)"
        )
        
        return {
            "status": "success",
            "report_id": report_id,
            "assessment_id": assessment.id,
            "generation_time_seconds": round(elapsed_time, 3),
            "evidence_count": evidence_count,
        }
        
    except Exception as e:
        elapsed_time = time.time() - start_time
        logger.exception(f"Failed to generate report {report_id}: {e}")
        
        # Atualizar relatório com erro
        try:
            report = Report.objects.get(id=report_id)
            report.status = Report.STATUS_FAILED
            report.error_message = str(e)[:500]  # Limitar tamanho
            report.generation_time_seconds = round(elapsed_time, 3)
            report.save(update_fields=['status', 'error_message', 'generation_time_seconds'])
        except Exception:
            pass
        
        # Retry em caso de erro transitório
        if self.request.retries < self.max_retries:
            logger.info(f"Retrying report {report_id} (attempt {self.request.retries + 1})")
            raise self.retry(exc=e)
        
        return {
            "status": "error",
            "report_id": report_id,
            "error": str(e),
            "generation_time_seconds": round(elapsed_time, 3),
        }


def _collect_assessment_data(assessment: RiskAssessment) -> dict:
    """
    Coleta todos os dados necessários da avaliação.
    
    LGPD/GDPR: Inclui verificação de que evidências estão anonimizadas
    antes de serem incluídas no relatório.
    
    Args:
        assessment: Avaliação de risco
        
    Returns:
        dict: Dados estruturados da avaliação
    """
    from assessments.anonymization import get_anonymization_service
    
    # Usar serializer existente para manter consistência
    serializer = RiskAssessmentDetailSerializer(assessment)
    data = serializer.data
    
    # Adicionar dados adicionais
    data['findings'] = list(assessment.findings.all().values())
    
    # LGPD/GDPR: Verificar status de anonimização das evidências
    # Se houver evidências pendentes, aguardar ou processar
    evidences = assessment.evidences.all()
    pending_evidences = evidences.filter(anonymization_status='pending')
    
    if pending_evidences.exists():
        # Tentar anonimizar evidências pendentes sincronamente
        logger.info(f"Found {pending_evidences.count()} pending evidences for report generation")
        service = get_anonymization_service()
        
        for evidence in pending_evidences:
            try:
                result = service.anonymize_evidence(evidence)
                if result.success:
                    logger.info(f"Anonymized evidence {evidence.id} during report generation")
                else:
                    logger.warning(f"Failed to anonymize evidence {evidence.id}: {result.error_message}")
            except Exception as e:
                logger.exception(f"Error anonymizing evidence {evidence.id}: {e}")
    
    # Incluir dados das evidências (agora garantidamente anonimizadas ou com status conhecido)
    data['evidences'] = list(evidences.values())
    
    # Adicionar informação de compliance LGPD ao relatório
    data['lgpd_compliance'] = {
        'legal_basis': assessment.legal_basis,
        'legal_basis_display': assessment.get_legal_basis_display(),
        'all_evidences_anonymized': not evidences.filter(is_anonymized=False).exists(),
    }
    
    return data


def _generate_pdf_document(assessment: RiskAssessment, data: dict) -> io.BytesIO:
    """
    Generates the PDF document using WeasyPrint with modern HTML template.
    Uses Tailwind CSS and professional styling.
    """
    try:
        # Mapping from severity to badge info for the template
        SEVERITY_MAP = {
            'rule_1_violation': {'severity': 'HIGH', 'name': 'Uso de EPI'},
            'rule_2_violation': {'severity': 'CRITICAL', 'name': 'Trabalho em Altura'},
            'rule_3_violation': {'severity': 'HIGH', 'name': 'Escavações'},
            'rule_4_violation': {'severity': 'CRITICAL', 'name': 'Proximidade com Máquinas'},
            'rule_5_violation': {'severity': 'CRITICAL', 'name': 'Espaço Confinado'},
            'rule_6_violation': {'severity': 'HIGH', 'name': 'Proteção Elétrica'},
            'rule_7_violation': {'severity': 'MEDIUM', 'name': 'Risco Ocupacional'},
            'rule_8_violation': {'severity': 'MEDIUM', 'name': 'Risco Ocupacional'},
        }

        # Collect evidences with file paths
        evidences = list(assessment.evidences.all())
        evidence_items = []
        for idx, evidence in enumerate(evidences):
            evidence_image_url = None
            if evidence.file:
                try:
                    evidence_image_url = f"file://{os.path.normpath(evidence.file.path).replace(chr(92), '/')}"
                except Exception:
                    evidence_image_url = None

            evidence_timestamp = None
            if evidence.captured_at:
                evidence_timestamp = evidence.captured_at.strftime("%I:%M %p")

            evidence_items.append({
                'index': idx + 1,
                'image_url': evidence_image_url,
                'timestamp': evidence_timestamp,
                'findings': [],  # will be populated below
            })

        # Build per-evidence findings from AI inference raw result
        latest_inference = assessment.inferences.first()
        raw_result = latest_inference.result_json if latest_inference else {}

        # Handle legacy wrapped format
        if isinstance(raw_result, dict) and 'individual_responses' in raw_result:
            merged = {}
            for resp in (raw_result.get('individual_responses') or []):
                if not isinstance(resp, dict):
                    continue
                for k, v in resp.items():
                    if not k.endswith('_violation'):
                        continue
                    if v is None:
                        merged.setdefault(k, None)
                    elif isinstance(v, list):
                        if not isinstance(merged.get(k), list):
                            merged[k] = []
                        merged[k].extend(v)
            if merged:
                raw_result = merged

        if isinstance(raw_result, dict):
            for rule_key, detections in raw_result.items():
                if not rule_key.endswith('_violation') or not isinstance(detections, list):
                    continue
                rule_info = SEVERITY_MAP.get(rule_key, {'severity': 'MEDIUM', 'name': rule_key})
                for detection in detections:
                    if not isinstance(detection, dict):
                        continue

                    severity = rule_info['severity'].lower()
                    is_critical = severity == 'critical' or severity == 'high'
                    is_warning = severity == 'medium'

                    confidence_val = detection.get('confidence')
                    try:
                        confidence = int(float(confidence_val) * 100)
                    except (TypeError, ValueError):
                        confidence = 0

                    reason = detection.get('reason', '') or rule_info['name']
                    short_title = reason[:60]
                    if len(reason) > 60:
                        short_title += '...'

                    finding_data = {
                        'title': short_title,
                        'description': reason,
                        'is_critical': is_critical,
                        'is_warning': is_warning,
                        'confidence': confidence,
                        'rule_id': rule_key,
                    }

                    # Associate with the correct evidence using evidence_index
                    ev_idx = detection.get('evidence_index')
                    if ev_idx is not None and 0 <= ev_idx < len(evidence_items):
                        evidence_items[ev_idx]['findings'].append(finding_data)
                    elif evidence_items:
                        evidence_items[0]['findings'].append(finding_data)

        # If no raw result data, fallback to DB RiskFindings
        has_any_findings = any(ei['findings'] for ei in evidence_items)
        if not has_any_findings:
            for finding in assessment.findings.all():
                severity = finding.severity.lower() if finding.severity else ''
                is_critical = 'critical' in severity or 'high' in severity
                is_warning = 'medium' in severity

                if getattr(finding, 'ai_confidence', None) is not None:
                    confidence = int(float(finding.ai_confidence) * 100)
                else:
                    confidence = 0

                title_text = (finding.description or 'Risk finding').strip()
                short_title = title_text[:60]
                if len(title_text) > 60:
                    short_title += '...'

                finding_data = {
                    'title': short_title,
                    'description': finding.description or 'No description provided',
                    'is_critical': is_critical,
                    'is_warning': is_warning,
                    'confidence': confidence,
                    'rule_id': '',
                }

                # Associate via FK relationship
                if finding.evidence_id:
                    for ei_idx, ei in enumerate(evidence_items):
                        if ei_idx + 1 == finding.evidence_id or (ei_idx < len(evidences) and evidences[ei_idx].id == finding.evidence_id):
                            ei['findings'].append(finding_data)
                            break
                    else:
                        if evidence_items:
                            evidence_items[0]['findings'].append(finding_data)
                elif evidence_items:
                    evidence_items[0]['findings'].append(finding_data)

        # Collect all findings for the flat list (used by recommendations)
        all_findings = []
        for ei in evidence_items:
            all_findings.extend(ei['findings'])

        # Preparar recomendações
        recommendations = [
            "Stop work in the affected area until critical hazards are resolved.",
            "Issue formal warning to site supervisor regarding compliance issues.",
        ]
        
        # Data de follow-up (2 dias após criação)
        follow_up_date = assessment.created_at + timedelta(days=2) if assessment.created_at else timezone.now() + timedelta(days=2)
        
        # Número de caso
        case_number = f"#ANLY-{assessment.created_at.year if assessment.created_at else timezone.now().year}-{assessment.id:03d}"
        
        # Dados do inspetor
        inspector_name = "Not informed"
        inspector_id = "0"
        if assessment.created_by:
            inspector_name = _resolve_inspector_name(assessment.created_by)
            inspector_id = str(assessment.created_by.id)
        
        # Localização
        location = assessment.environment_type.name if assessment.environment_type else "Unspecified Location"
        
        # Context para o template
        context = {
            'case_number': case_number,
            'generated_date': assessment.created_at or timezone.now(),
            'location': location,
            'inspector_name': inspector_name,
            'inspector_id': inspector_id,
            'evidence_items': evidence_items,
            'findings': all_findings,
            'recommendations': recommendations,
            'follow_up_date': follow_up_date,
            'signature_name': 'Safety Analysis Assessment',
            'manager_id': '4421',
            'approved_date': assessment.created_at or timezone.now(),
        }
        
        # Renderizar template HTML
        html_string = render_to_string('reports/inspection_report.html', context)
        
        # Converter HTML para PDF usando WeasyPrint
        # base_url aponta para MEDIA_ROOT para que URLs relativas de imagem sejam resolvidas
        base_url = f"file://{settings.MEDIA_ROOT}/"
        pdf_document = HTML(string=html_string, base_url=base_url)
        pdf_buffer = pdf_document.write_pdf()
        
        # Retornar como BytesIO
        return io.BytesIO(pdf_buffer)
        
    except Exception as e:
        logger.error(f"Error generating PDF with WeasyPrint: {e}", exc_info=True)
        raise


def _log_performance_metrics(elapsed_time: float, evidence_count: int):
    """
    Registra métricas de performance e alerta se exceder o target.
    
    Args:
        elapsed_time: Tempo de geração em segundos
        evidence_count: Número de evidências processadas
    """
    logger.info(
        f"PDF Generation Performance: {elapsed_time:.2f}s for {evidence_count} images "
        f"(target: {PERFORMANCE_TARGET_SECONDS}s for {MAX_IMAGES_TARGET} images)"
    )
    
    # Alerta se exceder o target
    if evidence_count <= MAX_IMAGES_TARGET and elapsed_time > PERFORMANCE_TARGET_SECONDS:
        logger.warning(
            f"PDF generation exceeded target time: {elapsed_time:.2f}s "
            f"(target: {PERFORMANCE_TARGET_SECONDS}s for {MAX_IMAGES_TARGET} images)"
        )
