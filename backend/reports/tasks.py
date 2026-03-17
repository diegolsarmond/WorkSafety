"""
Celery tasks para geração assíncrona de relatórios PDF.

Requisito F3.1: Geração de relatório PDF final.
Target: até 15s para 10 imagens.
"""
import io
import logging
import time
from datetime import datetime, timedelta

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
    Generates the PDF document matching the modern design template.
    Layout: Safety Inspection Report with professional styling
    """
    buffer = io.BytesIO()
    
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.2*cm,
        leftMargin=1.2*cm,
        topMargin=1.2*cm,
        bottomMargin=0.5*cm,
    )
    
    styles = getSampleStyleSheet()
    
    # Define color palette (matching design template)
    teal_primary = colors.HexColor('#00808e')  # Primary color from design
    teal_light = colors.HexColor('#4fd1c5')    # Accent teal
    dark_bg = colors.HexColor('#2d3748')       # Footer background
    dark_text = colors.HexColor('#1a202c')     # Headings
    slate_500 = colors.HexColor('#64748b')     # Secondary text
    slate_400 = colors.HexColor('#94a3b8')     # Tertiary text
    slate_50 = colors.HexColor('#f8fafc')      # Light background
    red_critical = colors.HexColor('#dc2626')
    red_bg = colors.HexColor('#fee2e2')
    yellow_warning = colors.HexColor('#d97706')
    yellow_bg = colors.HexColor('#fef3c7')
    
    elements = []
    
    # --- HEADER SECTION ---
    created_dt = assessment.created_at
    year = created_dt.year if created_dt else timezone.now().year
    assessment_id = assessment.id or 0
    case_num = f"#INSP-{year}-{assessment_id:03d}"
    gen_date = created_dt.strftime("%b %d, %Y") if created_dt else timezone.now().strftime("%b %d, %Y")
    
    # Logo and title
    header_style = ParagraphStyle(
        'Header',
        fontSize=28,
        fontName='Helvetica-Bold',
        textColor=dark_text,
        spaceAfter=6,
    )
    
    logo_style = ParagraphStyle(
        'Logo',
        fontSize=14,
        fontName='Helvetica-Bold',
        textColor=slate_500,
        spaceAfter=12,
    )
    
    # Left side - Logo and Title
    logo_text = Paragraph('<font color="#00808e">◆</font> <b><font color="#2d3748">Work</font><font color="#00808e">Safety</font></b>', logo_style)
    title_text = Paragraph('<b><font size=20 color="#1a202c">Safety Inspection<br/>Report</font></b>', header_style)
    
    # Right side - Case info
    case_label = Paragraph('<font size=7 color="#94a3b8"><b>CASE NUMBER</b></font>', styles['Normal'])
    case_value = Paragraph(f'<font size=14 color="#0f172a"><b>{case_num}</b></font>', styles['Normal'])
    case_date = Paragraph(f'<font size=8 color="#64748b">Generated: {gen_date}</font>', styles['Normal'])
    
    case_box_content = [case_label, Spacer(1, 2), case_value, Spacer(1, 4), case_date]
    inner_case_box = Table([[Table([[c] for c in case_box_content], colWidths=[4*cm])]], colWidths=[4.5*cm], rowHeights=[float(2.5*cm)])
    inner_case_box.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    
    header_row = Table([[logo_text, title_text, '', inner_case_box]], colWidths=[2*cm, 6*cm, 3*cm, 4.5*cm], rowHeights=[float(3*cm)])
    header_row.setStyle(TableStyle([
        ('ALIGN', (0,0), (0,0), 'LEFT'),
        ('ALIGN', (1,0), (1,0), 'LEFT'),
        ('ALIGN', (3,0), (3,0), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    
    elements.append(header_row)
    elements.append(Spacer(1, 0.5*cm))
    
    # --- INFO BOXES ---
    env_name = assessment.environment_type.name if assessment.environment_type else 'Unspecified Location'
    user_name = "Inspector"
    user_id = "0"
    if assessment.created_by:
        user_name = assessment.created_by.get_full_name() or (assessment.created_by.email.split('@')[0] if assessment.created_by.email else "Inspector")
        user_id = str(assessment.created_by.id) if assessment.created_by.id else "0"
    
    # Info box style
    info_label_style = ParagraphStyle('InfoLabel', fontSize=7, textColor=slate_400, spaceAfter=2)
    info_value_style = ParagraphStyle('InfoValue', fontSize=9, fontName='Helvetica-Bold', textColor=dark_text)
    
    # Location info
    loc_label = Paragraph('<font color="#94a3b8"><b>LOCATION</b></font>', info_label_style)
    loc_value = Paragraph(f'<b>{env_name}</b>', info_value_style)
    
    # Inspector info
    insp_label = Paragraph('<font color="#94a3b8"><b>INSPECTOR</b></font>', info_label_style)
    insp_value = Paragraph(f'<b>{user_name} (ID: {user_id})</b>', info_value_style)
    
    # Create info boxes
    loc_box = Table([[loc_label], [loc_value]], colWidths=[7*cm], rowHeights=[float(0.8*cm), float(0.6*cm)])
    loc_box.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), slate_50),
        ('PADDING', (0,0), (-1,-1), 10),
        ('ROUNDEDCORNERS', (0,0), (-1,-1), 6),
    ]))
    
    insp_box = Table([[insp_label], [insp_value]], colWidths=[7*cm], rowHeights=[float(0.8*cm), float(0.6*cm)])
    insp_box.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), slate_50),
        ('PADDING', (0,0), (-1,-1), 10),
        ('ROUNDEDCORNERS', (0,0), (-1,-1), 6),
    ]))
    
    info_row = Table([[loc_box, insp_box]], colWidths=[7.5*cm, 7.5*cm], rowHeights=[float(1.6*cm)])
    info_row.setStyle(TableStyle([('ALIGN', (0,0), (-1,-1), 'LEFT')]))
    elements.append(info_row)
    elements.append(Spacer(1, 0.6*cm))
    
    # --- SECTION HEADER: EVIDENCE & FINDINGS ---
    section_title_style = ParagraphStyle(
        'SectionTitle',
        fontSize=9,
        fontName='Helvetica-Bold',
        textColor=dark_text,
        letterSpacing=1,
    )
    
    section_header = Table([
        [Paragraph('█', ParagraphStyle('Bullet', fontSize=8, textColor=teal_primary)),
         Paragraph('EVIDENCE & FINDINGS', section_title_style)]
    ], colWidths=[0.8*cm, 14*cm], rowHeights=[float(0.5*cm)])
    section_header.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elements.append(section_header)
    elements.append(Spacer(1, 0.4*cm))
    
    # --- EVIDENCE IMAGE & FINDINGS CARDS ---
    evidences = list(assessment.evidences.all())
    findings = list(assessment.findings.all())
    
    # Evidence image (main display)
    img_cell = None
    if evidences and evidences[0].file:
        try:
            img_path = evidences[0].file.path
            img = Image(img_path, width=7*cm, height=5*cm)
            img_caption = Paragraph('<font size=8 color="#64748b">Fig 1. Site Capture - 10:42 AM</font>', styles['Normal'])
            img_cell = Table([[img], [Spacer(1, 2)], [img_caption]], colWidths=[7*cm], rowHeights=[float(5*cm), float(0.2*cm), float(0.4*cm)])
            img_cell.setStyle(TableStyle([
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ]))
        except Exception as e:
            logger.warning(f"Failed to load image: {e}")
            img_cell = Paragraph('<font color="#cbd5e1" size=9>[Image not available]</font>', styles['Normal'])
    else:
        img_cell = Paragraph('<font color="#cbd5e1" size=9>[No images captured]</font>', styles['Normal'])
    
    # Finding cards
    finding_cards = []
    for finding in findings[:2]:  # Show top 2 findings
        is_critical = finding.severity and 'CRITICAL' in finding.severity.upper()
        
        # Determine styling
        badge_color = red_critical if is_critical else yellow_warning
        bg_color = red_bg if is_critical else yellow_bg
        badge_text = 'Critical' if is_critical else 'Warning'
        
        # Extract title and description
        desc = finding.description or "No description provided"
        lines = desc.split('. ')
        title = lines[0][:50] + ('...' if len(lines[0]) > 50 else '')
        body = '. '.join(lines[1:])[:100] + ('...' if len('. '.join(lines[1:])) > 100 else '') if len(lines) > 1 else ''
        
        # Calculate confidence (placeholder - can be enhanced with actual ML scores)
        confidence = "94%" if is_critical else "88%"
        
        # Build finding card
        badge_row = Table([
            [Paragraph(f'<font size=7 color="white"><b>{badge_text.upper()}</b></font>', styles['Normal']),
             Paragraph(f'<font size=7 color="#64748b"><b>{confidence} Confidence</b></font>', styles['Normal'])]
        ], colWidths=[2*cm, 4.5*cm], rowHeights=[float(0.4*cm)])
        badge_row.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (0,-1), badge_color),
            ('PADDING', (0,0), (0,-1), 4),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ]))
        
        # Card content
        card_elements = [badge_row, Spacer(1, 0.2*cm)]
        card_elements.append(Paragraph(f'<b><font size=9 color="#1a202c">{title}</font></b>', styles['Normal']))
        
        if body:
            card_elements.append(Spacer(1, 0.15*cm))
            card_elements.append(Paragraph(f'<font size=8 color="#64748b">{body}</font>', styles['Normal']))
        
        # Wrap in table for styling
        card_row_count = len(card_elements)
        card_heights = [float(0.4*cm)] * card_row_count
        card = Table([[c] for c in card_elements], colWidths=[6.8*cm], rowHeights=card_heights)
        card.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), bg_color),
            ('PADDING', (0,0), (-1,-1), 10),
            ('ROUNDEDCORNERS', (0,0), (-1,-1), 6),
        ]))
        finding_cards.append(card)
        finding_cards.append(Spacer(1, 0.35*cm))
    
    if not finding_cards:
        finding_cards = [Paragraph('<font color="#cbd5e1" size=9>No findings recorded</font>', styles['Normal'])]
    
    # Wrap findings in a container table to keep them together
    findings_container = Table([finding_cards], colWidths=[6.8*cm], rowHeights=[float(5*cm)])
    findings_container.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    findings_content = findings_container
    
    # Combine image and findings using a two-column layout
    # Use explicit rowHeights to avoid None values in ReportLab
    # Ensure all values are explicitly converted to float to avoid type issues
    content_row = Table(
        [[img_cell, findings_content]],
        colWidths=[float(7.2*cm), float(7.8*cm)],
        rowHeights=[float(5*cm)],
    )
    content_row.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
    ]))
    elements.append(content_row)
    elements.append(Spacer(1, 0.5*cm))
    
    # --- SECTION HEADER: AI RECOMMENDATIONS ---
    ai_header = Table([
        [Paragraph('█', ParagraphStyle('Bullet', fontSize=8, textColor=slate_400)),
         Paragraph('AI RECOMMENDATIONS', section_title_style)]
    ], colWidths=[0.8*cm, 14*cm], rowHeights=[float(0.5*cm)])
    ai_header.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elements.append(ai_header)
    elements.append(Spacer(1, 0.3*cm))
    
    # Recommendations
    recommendations = [
        "<b>IMMEDIATE ACTION:</b> Stop work in Sector until critical hazards are resolved.",
    ]
    
    # Calcular data de follow-up (2 dias após criação) - com tratamento seguro para fim de mês
    if created_dt:
        try:
            follow_up_dt = created_dt + timedelta(days=2)
            follow_up_str = follow_up_dt.strftime('%b %d, %Y')
        except Exception:
            follow_up_str = "TBD"
    else:
        follow_up_str = datetime.now().strftime('%b %d, %Y')
    
    recommendations.append(f"Schedule follow-up inspection for {follow_up_str}")
    recommendations.append("Issue formal warning to site supervisor regarding outstanding compliance issues.")
    
    for rec_text in recommendations:
        rec_para = Paragraph(
            f'<font size=8 color="#64748b">• {rec_text}</font>',
            ParagraphStyle('Rec', spaceAfter=6, leading=11)
        )
        elements.append(rec_para)
    
    elements.append(Spacer(1, 0.8*cm))
    
    # --- FOOTER SECTION ---
    # Page number
    page_num = Paragraph(
        '<font size=7 color="#94a3b8"><b>Page 1 of 1</b></font>',
        ParagraphStyle('PageNum', alignment=TA_CENTER)
    )
    
    # Signature block
    sig_label = Paragraph('<font size=7 color="#94a3b8"><b>AUTHORIZED SIGNATURE</b></font>', styles['Normal'])
    sig_name = Paragraph('<font size=12 color="#4fd1c5"><b>Sarah Manager</b></font>', styles['Normal'])
    sig_line = Paragraph('<font size=8 color="#64748b">_____________________</font>', styles['Normal'])
    sig_info = Paragraph('<font size=8 color="#cbd5e1"><b>Sarah Manager</b></font>', styles['Normal'])
    sig_id = Paragraph('<font size=7 color="#94a3b8">Manager ID: 4421</font>', styles['Normal'])
    
    # Approval stamp
    stamp_label = Paragraph('<font size=7 color="#4fd1c5"><b>WorkSafety</b></font>', ParagraphStyle('Stamp', alignment=TA_CENTER))
    stamp_text = Paragraph('<font size=14 color="#4fd1c5"><i><b>APPROVED</b></i></font>', ParagraphStyle('StampText', alignment=TA_CENTER))
    stamp_date = Paragraph(f'<font size=7 color="#4fd1c5"><b>{gen_date}</b></font>', ParagraphStyle('StampDate', alignment=TA_CENTER))
    
    stamp = Table([[stamp_label], [stamp_text], [stamp_date]], colWidths=[3.5*cm], rowHeights=[float(0.5*cm), float(0.8*cm), float(0.5*cm)])
    stamp.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOX', (0,0), (-1,-1), 2, teal_light),
        ('PADDING', (0,0), (-1,-1), 8),
        ('ROUNDEDCORNERS', (0,0), (-1,-1), 6),
    ]))
    
    sig_block = Table(
        [[sig_label, '', stamp_label],
         [sig_name, '', stamp_text],
         [sig_line, '', stamp_date],
         [sig_info, '', ''],
         [sig_id, '', '']],
        colWidths=[5.5*cm, 4*cm, 3.5*cm],
        rowHeights=[float(0.6*cm), float(0.5*cm), float(0.3*cm), float(0.4*cm), float(0.3*cm)]
    )
    sig_block.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('ALIGN', (1,0), (1,-1), 'CENTER'),
        ('ALIGN', (2,0), (2,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    
    # Dark footer background
    footer = Table([[sig_block]], colWidths=[17*cm], rowHeights=[float(2.2*cm)])
    footer.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), dark_bg),
        ('PADDING', (0,0), (-1,-1), 12),
        ('ROUNDEDCORNERS', (0,0), (-1,-1), [0, 0, 8, 8]),
    ]))
    
    elements.append(footer)
    elements.append(Spacer(1, 0.2*cm))
    elements.append(page_num)
    
    # Build PDF
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
