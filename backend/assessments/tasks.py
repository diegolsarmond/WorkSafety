"""
Celery tasks for asynchronous AI processing of assessments.
"""
import logging
from typing import Optional

from celery import shared_task
from django.utils import timezone
from django.db import transaction

from .models import RiskAssessment, AIInferenceResult, RiskFinding, Evidence
from .services import AssessmentLifecycleService
from .ai_client import get_ai_client, AIInferenceRequest

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_assessment(self, assessment_id: int):
    """
    Processa uma avaliação através do serviço de IA.
    
    Esta task é enfileirada automaticamente quando uma avaliação
    atinge o status SYNCED, ou pode ser chamada manualmente
    para reprocessamento.
    
    Args:
        assessment_id: ID da avaliação a ser processada
    """
    logger.info(f"Starting AI processing for assessment {assessment_id}")
    
    try:
        # Carregar avaliação
        try:
            assessment = RiskAssessment.objects.select_related('created_by').get(
                id=assessment_id
            )
        except RiskAssessment.DoesNotExist:
            logger.error(f"Assessment {assessment_id} not found")
            return {"status": "error", "message": "Assessment not found"}
        
        # Verificar se a avaliação pode ser processada
        if assessment.status not in [
            RiskAssessment.STATUS_SYNCED,
            RiskAssessment.STATUS_ERROR_AI,
        ]:
            logger.warning(
                f"Assessment {assessment_id} has invalid status for processing: {assessment.status}"
            )
            return {
                "status": "skipped",
                "message": f"Invalid status: {assessment.status}",
            }
        
        # Buscar ou criar registro de inferência
        inference, created = AIInferenceResult.objects.get_or_create(
            assessment=assessment,
            defaults={
                "status": AIInferenceResult.STATUS_PENDING,
                "result_json": {},
            },
        )
        
        # Atualizar status para running
        inference.status = AIInferenceResult.STATUS_RUNNING
        inference.started_at = timezone.now()
        inference.error_message = ""
        inference.save()
        
        # Coletar URLs das evidências
        evidences = Evidence.objects.filter(assessment=assessment)
        evidence_urls = []
        for evidence in evidences:
            if evidence.file:
                # Construir URL absoluta
                evidence_urls.append(evidence.file.url)
        
        if not evidence_urls:
            logger.warning(f"Assessment {assessment_id} has no evidences")
            raise ValueError("Assessment has no evidences to analyze")
        
        # Preparar requisição
        request = AIInferenceRequest(
            assessment_id=assessment.id,
            evidence_urls=evidence_urls,
            title=assessment.title or "",
            description=assessment.description or "",
        )
        
        # Chamar serviço de IA
        ai_client = get_ai_client()
        result = ai_client.analyze_assessment(request)
        
        # Processar resultado
        with transaction.atomic():
            if result.success:
                # Atualizar inferência com sucesso
                inference.status = AIInferenceResult.STATUS_SUCCEEDED
                inference.result_json = result.raw_response or {}
                inference.confidence = result.confidence
                inference.model_version = result.model_version
                inference.finished_at = timezone.now()
                inference.save()
                
                # Criar/atualizar RiskFindings
                _update_risk_findings(assessment, result.findings, evidences)
                
                # Transicionar avaliação para AI_REVIEWED
                AssessmentLifecycleService.mark_ai_reviewed(
                    assessment,
                    actor=None,  # System action
                    reason=f"AI processing completed with {len(result.findings)} findings",
                )
                
                logger.info(
                    f"Assessment {assessment_id} processed successfully. "
                    f"Found {len(result.findings)} risks."
                )
                
                return {
                    "status": "success",
                    "assessment_id": assessment_id,
                    "findings_count": len(result.findings),
                    "confidence": result.confidence,
                }
            else:
                # Falha na inferência
                raise AIProcessingError(result.error_message or "Unknown AI error")
                
    except AIProcessingError as e:
        logger.error(f"AI processing failed for assessment {assessment_id}: {e}")
        _handle_processing_error(assessment_id, str(e))
        
        # Retry em caso de erro transitório
        if self.request.retries < self.max_retries:
            logger.info(f"Retrying assessment {assessment_id} (attempt {self.request.retries + 1})")
            raise self.retry(exc=e)
        
        return {
            "status": "error",
            "assessment_id": assessment_id,
            "error": str(e),
            "retries_exhausted": True,
        }
        
    except Exception as e:
        logger.exception(f"Unexpected error processing assessment {assessment_id}: {e}")
        _handle_processing_error(assessment_id, f"Unexpected error: {str(e)}")
        
        # Retry em caso de erro inesperado
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        
        return {
            "status": "error",
            "assessment_id": assessment_id,
            "error": str(e),
            "retries_exhausted": True,
        }


@shared_task
def reprocess_assessment(assessment_id: int):
    """
    Reprocessa uma avaliação que falhou anteriormente.
    
    Args:
        assessment_id: ID da avaliação a ser reprocessada
    """
    logger.info(f"Reprocessing assessment {assessment_id}")
    
    try:
        assessment = RiskAssessment.objects.get(id=assessment_id)
    except RiskAssessment.DoesNotExist:
        return {"status": "error", "message": "Assessment not found"}
    
    # Verificar se está em estado de erro
    if assessment.status != RiskAssessment.STATUS_ERROR_AI:
        return {
            "status": "skipped",
            "message": f"Assessment is not in error state. Current status: {assessment.status}",
        }
    
    # Resetar para synced e enfileirar processamento
    assessment.status = RiskAssessment.STATUS_SYNCED
    assessment.status_change_reason = "Reprocessing initiated"
    assessment.save()
    
    # Enfileirar processamento
    process_assessment.delay(assessment_id)
    
    return {
        "status": "queued",
        "assessment_id": assessment_id,
        "message": "Assessment queued for reprocessing",
    }


def _update_risk_findings(
    assessment: RiskAssessment,
    findings_data: list,
    evidences,
):
    """
    Atualiza os RiskFindings baseado nos resultados da IA.
    
    Args:
        assessment: Avaliação sendo processada
        findings_data: Lista de achados retornados pela IA
        evidences: QuerySet de evidências da avaliação
    """
    # Converter evidências para lista para indexação
    evidence_list = list(evidences)
    
    # Criar novos findings
    for i, finding_data in enumerate(findings_data):
        # Associar com evidência correspondente (circular)
        evidence = evidence_list[i % len(evidence_list)] if evidence_list else None
        
        RiskFinding.objects.create(
            assessment=assessment,
            description=finding_data.get("description", ""),
            severity=finding_data.get("severity", "MEDIUM"),
            location=finding_data.get("location", ""),
            evidence=evidence,
        )


def _handle_processing_error(assessment_id: int, error_message: str):
    """
    Manipula erro de processamento, atualizando status e registro.
    
    Args:
        assessment_id: ID da avaliação
        error_message: Mensagem de erro
    """
    try:
        with transaction.atomic():
            assessment = RiskAssessment.objects.get(id=assessment_id)
            
            # Atualizar inferência
            inference = AIInferenceResult.objects.filter(
                assessment=assessment
            ).first()
            
            if inference:
                inference.status = AIInferenceResult.STATUS_FAILED
                inference.error_message = error_message
                inference.finished_at = timezone.now()
                inference.save()
            
            # Transicionar para erro
            AssessmentLifecycleService.mark_error_ai(
                assessment,
                actor=None,  # System action
                reason=f"AI processing failed: {error_message}",
            )
    except Exception as e:
        logger.exception(f"Error handling processing error: {e}")


class AIProcessingError(Exception):
    """Exceção para erros de processamento de IA."""
    pass


@shared_task
def cleanup_stalled_processes():
    """
    Limpa processos de IA travados (running por muito tempo).
    
    Task de manutenção periódica.
    """
    from datetime import timedelta
    
    stalled_threshold = timezone.now() - timedelta(hours=1)
    
    stalled_inferences = AIInferenceResult.objects.filter(
        status=AIInferenceResult.STATUS_RUNNING,
        started_at__lt=stalled_threshold,
    )
    
    count = 0
    for inference in stalled_inferences:
        inference.status = AIInferenceResult.STATUS_FAILED
        inference.error_message = "Process stalled - timed out"
        inference.finished_at = timezone.now()
        inference.save()
        
        # Atualizar avaliação
        assessment = inference.assessment
        if assessment.status == RiskAssessment.STATUS_SYNCED:
            AssessmentLifecycleService.mark_error_ai(
                assessment,
                actor=None,
                reason="AI processing timed out",
            )
        count += 1
    
    logger.info(f"Cleaned up {count} stalled AI processes")
    return {"cleaned_count": count}
