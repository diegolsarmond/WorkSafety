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
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY

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
    
    Args:
        assessment: Avaliação de risco
        
    Returns:
        dict: Dados estruturados da avaliação
    """
    # Usar serializer existente para manter consistência
    serializer = RiskAssessmentDetailSerializer(assessment)
    data = serializer.data
    
    # Adicionar dados adicionais
    data['findings'] = list(assessment.findings.all().values())
    data['evidences'] = list(assessment.evidences.all().values())
    
    return data


def _generate_pdf_document(assessment: RiskAssessment, data: dict) -> io.BytesIO:
    """
    Gera o documento PDF do relatório.
    
    Args:
        assessment: Avaliação de risco
        data: Dados da avaliação
        
    Returns:
        BytesIO: Buffer com o PDF gerado
    """
    buffer = io.BytesIO()
    
    # Configurar documento
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm,
    )
    
    # Estilos
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=20,
        alignment=TA_CENTER,
    )
    heading2_style = ParagraphStyle(
        'CustomHeading2',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#334155'),
        spaceAfter=12,
        spaceBefore=12,
    )
    heading3_style = ParagraphStyle(
        'CustomHeading3',
        parent=styles['Heading3'],
        fontSize=12,
        textColor=colors.HexColor('#475569'),
        spaceAfter=8,
        spaceBefore=8,
    )
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        alignment=TA_JUSTIFY,
        spaceAfter=6,
    )
    
    # Elementos do documento
    elements = []
    
    # ===== CAPA =====
    elements.append(Spacer(1, 3*cm))
    elements.append(Paragraph("RELATÓRIO DE AVALIAÇÃO DE RISCOS", title_style))
    elements.append(Spacer(1, 1*cm))
    
    # Informações principais
    cover_data = [
        ["Título:", assessment.title or "Sem título"],
        ["ID da Avaliação:", str(assessment.id)],
        ["Status:", assessment.get_status_display()],
        ["Data de Criação:", assessment.created_at.strftime("%d/%m/%Y %H:%M") if assessment.created_at else "-"],
        ["Tipo de Avaliação:", data.get('assessment_type', {}).get('name', 'Não especificado') if data.get('assessment_type') else 'Não especificado'],
        ["Tipo de Ambiente:", data.get('environment_type', {}).get('name', 'Não especificado') if data.get('environment_type') else 'Não especificado'],
    ]
    
    cover_table = Table(cover_data, colWidths=[4*cm, 10*cm])
    cover_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f1f5f9')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(cover_table)
    elements.append(Spacer(1, 1*cm))
    
    # Descrição
    if assessment.description:
        elements.append(Paragraph("Descrição", heading2_style))
        elements.append(Paragraph(assessment.description, normal_style))
        elements.append(Spacer(1, 0.5*cm))
    
    # Score de compliance
    compliance_score = data.get('compliance_score', 0)
    elements.append(Paragraph(f"Score de Compliance: {compliance_score}%", heading2_style))
    elements.append(Spacer(1, 0.5*cm))
    
    elements.append(PageBreak())
    
    # ===== SEÇÃO: RISCOS IDENTIFICADOS =====
    elements.append(Paragraph("RISCOS IDENTIFICADOS", heading2_style))
    elements.append(Spacer(1, 0.3*cm))
    
    findings = list(assessment.findings.all())
    if findings:
        for i, finding in enumerate(findings, 1):
            finding_elements = []
            finding_elements.append(Paragraph(f"Risco #{i}", heading3_style))
            
            risk_data = [
                ["Descrição:", finding.description or "-"],
                ["Severidade:", finding.severity or "Não classificada"],
                ["Localização:", finding.location or "Não especificada"],
            ]
            
            risk_table = Table(risk_data, colWidths=[3*cm, 11*cm])
            risk_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#fef3c7')),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
                ('PADDING', (0, 0), (-1, -1), 6),
            ]))
            finding_elements.append(risk_table)
            finding_elements.append(Spacer(1, 0.3*cm))
            
            elements.append(KeepTogether(finding_elements))
    else:
        elements.append(Paragraph("Nenhum risco identificado.", normal_style))
    
    elements.append(PageBreak())
    
    # ===== SEÇÃO: EVIDÊNCIAS =====
    elements.append(Paragraph("EVIDÊNCIAS", heading2_style))
    elements.append(Spacer(1, 0.3*cm))
    
    evidences = list(assessment.evidences.all())
    if evidences:
        elements.append(Paragraph(f"Total de evidências: {len(evidences)}", normal_style))
        elements.append(Spacer(1, 0.5*cm))
        
        for i, evidence in enumerate(evidences, 1):
            evidence_elements = []
            evidence_elements.append(Paragraph(f"Evidência #{i}", heading3_style))
            
            # Metadados da evidência
            meta_data = [
                ["ID:", str(evidence.id)],
                ["Arquivo:", evidence.file.name.split('/')[-1] if evidence.file else "-"],
                ["Tamanho:", f"{evidence.file_size} bytes" if evidence.file_size else "-"],
                ["Hash:", evidence.file_hash[:16] + "..." if evidence.file_hash and len(evidence.file_hash) > 16 else (evidence.file_hash or "-")],
                ["Capturada em:", evidence.captured_at.strftime("%d/%m/%Y %H:%M") if evidence.captured_at else "-"],
            ]
            
            meta_table = Table(meta_data, colWidths=[3*cm, 11*cm])
            meta_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e0f2fe')),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
                ('PADDING', (0, 0), (-1, -1), 4),
            ]))
            evidence_elements.append(meta_table)
            evidence_elements.append(Spacer(1, 0.3*cm))
            
            # Tentar incluir a imagem (reduzida para performance)
            if evidence.file:
                try:
                    img_path = evidence.file.path
                    # Limitar tamanho da imagem no PDF (largura máxima 15cm)
                    img = Image(img_path, width=15*cm, height=10*cm)
                    img.drawHeight = 10*cm
                    img.drawWidth = 15*cm
                    img.hAlign = 'CENTER'
                    evidence_elements.append(img)
                    evidence_elements.append(Spacer(1, 0.5*cm))
                except Exception as img_error:
                    logger.warning(f"Could not include image for evidence {evidence.id}: {img_error}")
                    evidence_elements.append(Paragraph(f"[Imagem não disponível: {img_error}]", normal_style))
            
            elements.append(KeepTogether(evidence_elements))
            
            # Nova página a cada 2 evidências para não sobrecarregar
            if i % 2 == 0 and i < len(evidences):
                elements.append(PageBreak())
    else:
        elements.append(Paragraph("Nenhuma evidência registrada.", normal_style))
    
    elements.append(PageBreak())
    
    # ===== SEÇÃO: CHECKLIST DE VALIDAÇÃO =====
    elements.append(Paragraph("CHECKLIST DE VALIDAÇÃO", heading2_style))
    elements.append(Spacer(1, 0.3*cm))
    
    checklist_data = [
        ["Item", "Status", "Data"],
        ["Captura", "✓ Concluído" if assessment.captured_at else "○ Pendente", 
         assessment.captured_at.strftime("%d/%m/%Y %H:%M") if assessment.captured_at else "-"],
        ["Sincronização", "✓ Concluído" if assessment.synced_at else "○ Pendente",
         assessment.synced_at.strftime("%d/%m/%Y %H:%M") if assessment.synced_at else "-"],
        ["Revisão por IA", "✓ Concluído" if assessment.ai_reviewed_at else "○ Pendente",
         assessment.ai_reviewed_at.strftime("%d/%m/%Y %H:%M") if assessment.ai_reviewed_at else "-"],
        ["Validação Humana", "✓ Concluído" if assessment.human_validated_at else "○ Pendente",
         assessment.human_validated_at.strftime("%d/%m/%Y %H:%M") if assessment.human_validated_at else "-"],
        ["Finalização", "✓ Concluído" if assessment.finalized_at else "○ Pendente",
         assessment.finalized_at.strftime("%d/%m/%Y %H:%M") if assessment.finalized_at else "-"],
    ]
    
    checklist_table = Table(checklist_data, colWidths=[5*cm, 4*cm, 5*cm])
    checklist_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#334155')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
    ]))
    elements.append(checklist_table)
    elements.append(Spacer(1, 1*cm))
    
    # ===== RODAPÉ =====
    elements.append(Spacer(1, 2*cm))
    elements.append(Paragraph("— Fim do Relatório —", ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.grey,
        alignment=TA_CENTER,
    )))
    
    # Gerar PDF
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
