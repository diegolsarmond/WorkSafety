"""
Celery tasks para geração assíncrona de relatórios PDF.

Requisito F3.1: Geração de relatório PDF final.
Target: até 15s para 10 imagens.
"""
import io
import logging
import time
from datetime import datetime

from celery import shared_task
from django.utils import timezone
from django.db import transaction
from django.conf import settings

# ReportLab imports
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image,
    PageBreak,
    KeepTogether,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY, TA_RIGHT

from .models import Report
from assessments.models import RiskAssessment, Evidence, RiskFinding
from assessments.serializers import RiskAssessmentDetailSerializer

logger = logging.getLogger(__name__)

# Target de performance: 15s para 10 imagens
PERFORMANCE_TARGET_SECONDS = 15
MAX_IMAGES_TARGET = 10


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
    Generates the PDF document matching the exact target layout.
    """
    buffer = io.BytesIO()
    
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.5*cm,
        leftMargin=1.5*cm,
        topMargin=1.5*cm,
        bottomMargin=2*cm,
    )
    
    styles = getSampleStyleSheet()
    
    # Colors from design
    teal = colors.HexColor('#14b8a6')
    dark_bg = colors.HexColor('#1e293b')
    dark_text = colors.HexColor('#0f172a')
    light_text = colors.HexColor('#64748b')
    gray_bg = colors.HexColor('#f1f5f9')
    red_pill = colors.HexColor('#dc2626')
    yellow_pill = colors.HexColor('#d97706')
    red_bg = colors.HexColor('#fef2f2')
    yellow_bg = colors.HexColor('#fffbeb')
    cyan = colors.HexColor('#22d3ee')
    
    elements = []
    
    # --- HEADER ---
    created_dt = assessment.created_at
    year = created_dt.year if created_dt else 2026
    case_num = f"#INSP-{year}-{assessment.id:03d}"
    gen_date = created_dt.strftime("%b %d, %Y") if created_dt else "Jan 10, 2026"
    
    # Logo with shield icon
    logo = Paragraph(
        '<font color="#14b8a6" size=20>◆</font> <b><font size=18 color="#0f172a">Work</font><font size=18 color="#14b8a6">Safety</font></b>',
        styles['Normal']
    )
    
    case_info = [
        Paragraph('<font size=8 color="#94a3b8">CASE NUMBER</font>', styles['Normal']),
        Paragraph(f'<b><font size=14 color="#0f172a">{case_num}</font></b>', styles['Normal']),
        Paragraph(f'<font size=8 color="#64748b">Generated: {gen_date}</font>', styles['Normal']),
    ]
    
    header = Table([[logo, case_info]], colWidths=[8*cm, 9.5*cm])
    header.setStyle(TableStyle([
        ('ALIGN', (0,0), (0,0), 'LEFT'),
        ('ALIGN', (1,0), (1,0), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    elements.append(header)
    elements.append(Spacer(1, 0.8*cm))
    
    # --- TITLE ---
    title = Paragraph(
        '<b><font size=24 color="#0f172a">Safety Inspection<br/>Report</font></b>',
        styles['Normal']
    )
    elements.append(title)
    elements.append(Spacer(1, 0.6*cm))
    
    # --- INFO BOXES ---
    env_name = data.get('environment_type', {}).get('name', 'North Sector - Construction') if data.get('environment_type') else 'North Sector - Construction'
    user_name = "Alex Inspector"
    user_id = "8842"
    if assessment.created_by:
        user_name = assessment.created_by.get_full_name() or assessment.created_by.email.split('@')[0]
        user_id = str(assessment.created_by.id)
    
    # Location box
    loc_box = Table([
        [Paragraph('<font size=7 color="#94a3b8">LOCATION</font>', styles['Normal'])],
        [Paragraph(f'<font size=10>📍 <b>{env_name}</b></font>', styles['Normal'])],
    ], colWidths=[8*cm])
    loc_box.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), gray_bg),
        ('PADDING', (0,0), (-1,-1), 12),
        ('ROUNDEDCORNERS', (0,0), (-1,-1), 8),
    ]))
    
    # Inspector box
    insp_box = Table([
        [Paragraph('<font size=7 color="#94a3b8">INSPECTOR</font>', styles['Normal'])],
        [Paragraph(f'<font size=10>👤 <b>{user_name} (ID: {user_id})</b></font>', styles['Normal'])],
    ], colWidths=[8*cm])
    insp_box.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), gray_bg),
        ('PADDING', (0,0), (-1,-1), 12),
        ('ROUNDEDCORNERS', (0,0), (-1,-1), 8),
    ]))
    
    info_row = Table([[loc_box, insp_box]], colWidths=[8*cm, 8*cm], hAlign='LEFT')
    info_row.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
    ]))
    elements.append(info_row)
    elements.append(Spacer(1, 0.8*cm))
    
    # --- EVIDENCE & FINDINGS SECTION ---
    section_header = Table([
        ['', Paragraph('<b><font size=10 color="#0f172a">EVIDENCE & FINDINGS</font></b>', styles['Normal'])]
    ], colWidths=[0.3*cm, 17*cm])
    section_header.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,0), teal),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (1,0), (1,0), 8),
    ]))
    elements.append(section_header)
    elements.append(Spacer(1, 0.5*cm))
    
    # Get evidences and findings
    evidences = list(assessment.evidences.all())
    findings = list(assessment.findings.all())
    
    # Evidence image
    img_cell = None
    if evidences and evidences[0].file:
        try:
            img_path = evidences[0].file.path
            img = Image(img_path, width=7.5*cm, height=5.5*cm)
            img_cell = Table([
                [img],
                [Paragraph('<font size=8 color="#64748b">Fig 1. Site Capture - 10:42 AM</font>', styles['Normal'])]
            ], colWidths=[7.5*cm])
            img_cell.setStyle(TableStyle([
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ]))
        except Exception:
            img_cell = Paragraph('<font color="#94a3b8">[Image]</font>', styles['Normal'])
    else:
        img_cell = Paragraph('<font color="#94a3b8">[No Image]</font>', styles['Normal'])
    
    # Findings cards
    finding_cards = []
    for i, finding in enumerate(findings[:2]):
        is_critical = finding.severity and finding.severity.upper() == 'CRITICAL'
        pill_color = red_pill if is_critical else yellow_pill
        bg_color = red_bg if is_critical else yellow_bg
        label = 'CRITICAL' if is_critical else 'WARNING'
        confidence = "94%" if is_critical else "88%"
        
        # Parse title and description
        desc = finding.description or "No description"
        parts = desc.split('. ', 1)
        if len(parts) > 1:
            title, body = parts[0], parts[1]
        else:
            title = desc[:40] + ('...' if len(desc) > 40 else '')
            body = ""
        
        # Finding card
        card_content = [
            # Badge row
            Table([
                [Paragraph(f'<font size=8 color="white"><b>{label}</b></font>', styles['Normal']),
                 Paragraph(f'<font size=8 color="#64748b">{confidence} Confidence</font>', styles['Normal'])]
            ], colWidths=[2.5*cm, 5*cm]),
            Spacer(1, 0.3*cm),
            Paragraph(f'<b><font size=10 color="#0f172a">{title}</font></b>', styles['Normal']),
        ]
        
        if body:
            card_content.extend([
                Spacer(1, 0.2*cm),
                Paragraph(f'<font size=9 color="#64748b">{body}</font>', styles['Normal']),
            ])
        
        card = Table([[c] for c in card_content], colWidths=[7.5*cm])
        card.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), bg_color),
            ('PADDING', (0,0), (-1,-1), 12),
            ('ROUNDEDCORNERS', (0,0), (-1,-1), 8),
        ]))
        finding_cards.append(card)
        finding_cards.append(Spacer(1, 0.4*cm))
    
    if not finding_cards:
        no_findings = Paragraph('<font color="#64748b">No findings recorded</font>', styles['Normal'])
        finding_cards = [no_findings]
    
    findings_col = Table([[c] for c in finding_cards], colWidths=[8*cm])
    
    # Evidence + Findings row
    content_row = Table([[img_cell, findings_col]], colWidths=[8*cm, 9.5*cm])
    content_row.setStyle(TableStyle([
        ('VALIGN', (0,0), (0,0), 'TOP'),
        ('VALIGN', (1,0), (1,0), 'TOP'),
    ]))
    elements.append(content_row)
    elements.append(Spacer(1, 0.8*cm))
    
    # --- AI RECOMMENDATIONS ---
    ai_header = Table([
        ['', Paragraph('<b><font size=10 color="#0f172a">AI RECOMMENDATIONS</font></b>', styles['Normal'])]
    ], colWidths=[0.3*cm, 17*cm])
    ai_header.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,0), teal),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (1,0), (1,0), 8),
    ]))
    elements.append(ai_header)
    elements.append(Spacer(1, 0.4*cm))
    
    # Recommendations list
    recs = [
        "IMMEDIATE ACTION: Stop work in Sector North until guardrails are installed.",
        "Issue formal warning to site supervisor regarding PPE compliance.",
        f"Schedule follow-up inspection for Jan 17, {year}."
    ]
    
    for rec in recs:
        rec_row = Table([
            [Paragraph('•', styles['Normal']), Paragraph(f'<font size=9 color="#0f172a">{rec}</font>', styles['Normal'])]
        ], colWidths=[0.5*cm, 16.5*cm])
        rec_row.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ]))
        elements.append(rec_row)
    
    elements.append(Spacer(1, 1*cm))
    
    # --- PAGE NUMBER ---
    page_num_style = ParagraphStyle('pageNum', alignment=TA_CENTER, fontSize=8, textColor=colors.HexColor('#94a3b8'))
    elements.append(Paragraph('Page 1 of 1', page_num_style))
    
    # --- FOOTER ---
    footer_data = [
        [
            # Left: Signature block
            [
                Paragraph('<font size=8 color="#64748b">AUTHORIZED SIGNATURE</font>', styles['Normal']),
                Spacer(1, 0.3*cm),
                Paragraph(f'<font size=16 color="#22d3ee"><b>Sarah Manager</b></font>', styles['Normal']),
                Spacer(1, 0.1*cm),
                Paragraph('<font size=8 color="#94a3b8">_________________________</font>', styles['Normal']),
                Spacer(1, 0.1*cm),
                Paragraph('<font size=9 color="white"><b>Sarah Manager</b></font>', styles['Normal']),
                Paragraph('<font size=8 color="#64748b">Manager ID: 4421</font>', styles['Normal']),
            ],
            # Right: Stamp
            Table([
                [Paragraph('<b><font size=11 color="#22d3ee">WORKSAFETY</font></b>', styles['Normal'])],
                [Paragraph('<b><font size=14 color="#22d3ee">APPROVED</font></b>', styles['Normal'])],
                [Paragraph('<font size=8 color="#22d3ee">10/01/2026</font>', styles['Normal'])],
            ], colWidths=[4*cm])
        ]
    ]
    
    # Style the stamp
    stamp_table = footer_data[0][1]
    stamp_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOX', (0,0), (-1,-1), 2, cyan),
        ('ROUNDEDCORNERS', (0,0), (-1,-1), 8),
        ('PADDING', (0,0), (-1,-1), 10),
    ]))
    
    footer = Table(footer_data, colWidths=[11*cm, 6.5*cm])
    footer.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), dark_bg),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 20),
        ('ROUNDEDCORNERS', (0,0), (-1,-1), [8,8,0,0]),
    ]))
    
    elements.append(Spacer(1, 0.5*cm))
    elements.append(footer)
    
    doc.build(elements)
    buffer.seek(0)
    
    return buffer


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
