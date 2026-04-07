"""
Celery tasks for asynchronous AI processing of assessments.
"""
import logging
from typing import Optional

from celery import shared_task
from django.conf import settings
from django.utils import timezone
from django.db import transaction

from .models import RiskAssessment, AIInferenceResult, RiskFinding, Evidence
from .services import AssessmentLifecycleService
from .ai_client import get_ai_client, AIInferenceRequest

logger = logging.getLogger(__name__)


# =============================================================================
# LGPD/GDPR - Anonymization Tasks
# =============================================================================

@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def anonymize_evidence_task(self, evidence_id: int, user_id: Optional[int] = None):
    """
    Task Celery para anonimização assíncrona de evidências.
    
    Esta task é executada após o upload de evidências para processar
    a anonimização de dados pessoais (rostos, placas) em background.
    
    Args:
        evidence_id: ID da evidência a ser anonimizada
        user_id: ID do usuário que fez o upload (opcional, para auditoria)
    
    Returns:
        Dict com resultado da operação
    """
    from django.contrib.auth import get_user_model
    from .anonymization import anonymize_evidence
    
    User = get_user_model()
    
    logger.info(f"Starting anonymization for evidence {evidence_id}")
    
    try:
        # Buscar evidência
        try:
            evidence = Evidence.objects.get(id=evidence_id)
        except Evidence.DoesNotExist:
            logger.error(f"Evidence {evidence_id} not found")
            return {"status": "error", "message": "Evidence not found"}
        
        # Buscar usuário se fornecido
        user = None
        if user_id:
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                logger.warning(f"User {user_id} not found, proceeding without user attribution")
        
        # Verificar se já foi anonimizada
        if evidence.is_anonymized and evidence.anonymization_status == "completed":
            logger.info(f"Evidence {evidence_id} already anonymized, skipping")
            return {
                "status": "skipped",
                "evidence_id": evidence_id,
                "message": "Already anonymized",
            }
        
        # Atualizar status para processing
        evidence.anonymization_status = "processing"
        evidence.save(update_fields=["anonymization_status"])
        
        # Executar anonimização
        result = anonymize_evidence(evidence, user)
        
        if result.success:
            logger.info(
                f"Evidence {evidence_id} anonymized successfully: "
                f"{result.faces_anonymized} faces, {result.plates_anonymized} plates"
            )
            return {
                "status": "success",
                "evidence_id": evidence_id,
                "faces_detected": result.faces_detected,
                "faces_anonymized": result.faces_anonymized,
                "plates_detected": result.plates_detected,
                "plates_anonymized": result.plates_anonymized,
                "processing_duration_ms": result.processing_duration_ms,
            }
        else:
            # Falha na anonimização
            logger.error(f"Anonymization failed for evidence {evidence_id}: {result.error_message}")
            
            # Retry em caso de erro transitório
            if self.request.retries < self.max_retries:
                logger.info(f"Retrying anonymization for evidence {evidence_id}")
                raise self.retry(exc=Exception(result.error_message))
            
            return {
                "status": "error",
                "evidence_id": evidence_id,
                "error": result.error_message,
                "retries_exhausted": True,
            }
            
    except Exception as e:
        logger.exception(f"Unexpected error anonymizing evidence {evidence_id}: {e}")
        
        # Tentar atualizar status da evidência para falha
        try:
            evidence = Evidence.objects.get(id=evidence_id)
            evidence.anonymization_status = "failed"
            evidence.save(update_fields=["anonymization_status"])
        except Exception:
            pass
        
        # Retry
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        
        return {
            "status": "error",
            "evidence_id": evidence_id,
            "error": str(e),
            "retries_exhausted": True,
        }


@shared_task
def batch_anonymize_assessment_evidences(assessment_id: int, user_id: Optional[int] = None):
    """
    Anonimiza todas as evidências pendentes de uma avaliação.
    
    Útil para processar evidências em lote ou reprocessar
    evidências que falharam anteriormente.
    
    Args:
        assessment_id: ID da avaliação
        user_id: ID do usuário (opcional)
    
    Returns:
        Dict com resultados do processamento em lote
    """
    logger.info(f"Starting batch anonymization for assessment {assessment_id}")
    
    try:
        assessment = RiskAssessment.objects.get(id=assessment_id)
    except RiskAssessment.DoesNotExist:
        return {"status": "error", "message": "Assessment not found"}
    
    # Buscar evidências pendentes
    pending_evidences = Evidence.objects.filter(
        assessment=assessment,
        anonymization_status__in=["pending", "failed"]
    )
    
    results = {
        "status": "queued",
        "assessment_id": assessment_id,
        "total": pending_evidences.count(),
        "queued": 0,
        "failed": 0,
        "task_ids": [],
    }
    
    for evidence in pending_evidences:
        try:
            task = anonymize_evidence_task.delay(evidence.id, user_id)
            results["queued"] += 1
            results["task_ids"].append(task.id)
        except Exception as e:
            logger.error(f"Failed to queue anonymization for evidence {evidence.id}: {e}")
            results["failed"] += 1
    
    logger.info(
        f"Batch anonymization for assessment {assessment_id}: "
        f"{results['queued']} queued, {results['failed']} failed"
    )
    
    return results


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
            RiskAssessment.STATUS_AI_REVIEWED,
            RiskAssessment.STATUS_ERROR_AI,
        ]:
            logger.warning(
                f"Assessment {assessment_id} has invalid status for processing: {assessment.status}"
            )
            return {
                "status": "skipped",
                "message": f"Invalid status: {assessment.status}",
            }
        
        # Reset assessment to synced when reprocessing from ai_reviewed
        if assessment.status == RiskAssessment.STATUS_AI_REVIEWED:
            AssessmentLifecycleService.transition(
                assessment, RiskAssessment.STATUS_SYNCED,
                actor=None, reason="Reprocessing AI analysis",
            )
        
        # Buscar ou criar registro de inferência — reset if reprocessing
        inference, created = AIInferenceResult.objects.get_or_create(
            assessment=assessment,
            defaults={
                "status": AIInferenceResult.STATUS_PENDING,
                "result_json": {},
            },
        )
        
        # Reset inference for reprocessing
        inference.status = AIInferenceResult.STATUS_RUNNING
        inference.result_json = {}
        inference.confidence = ""
        inference.error_message = ""
        inference.started_at = timezone.now()
        inference.finished_at = None
        inference.save()
        
        # Coletar URLs e IDs das evidências (ordenados de forma consistente)
        evidences = list(Evidence.objects.filter(assessment=assessment))
        evidence_urls = []
        evidence_ids = []
        for evidence in evidences:
            if evidence.file:
                evidence_urls.append(evidence.file.url)
                evidence_ids.append(evidence.id)

        if not evidence_urls:
            logger.warning(f"Assessment {assessment_id} has no evidences")
            raise ValueError("Assessment has no evidences to analyze")

        logger.info(
            f"Assessment {assessment_id}: analisando {len(evidence_urls)} foto(s) "
            f"individualmente — IDs {evidence_ids}"
        )

        # Preparar requisição com IDs explícitos para vinculação por foto
        request = AIInferenceRequest(
            assessment_id=assessment.id,
            evidence_urls=evidence_urls,
            evidence_ids=evidence_ids,
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
                _update_risk_findings(assessment, result.findings, evidences, result)
                
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
    inference_result=None,
):
    """
    Atualiza os RiskFindings baseado nos resultados da IA.
    
    Args:
        assessment: Avaliação sendo processada
        findings_data: Lista de achados retornados pela IA
        evidences: QuerySet de evidências da avaliação
        inference_result: Instância opcional de AIInferenceResult com violations
    """
    from .image_processor import process_evidence_with_olimpia, calculate_compliance_score
    
    # Converter evidências para lista para indexação
    evidence_list = list(evidences)
    
    # Agrupar findings por categoria para melhor associação com evidências
    findings_by_category = {}
    for finding_data in findings_data:
        category = finding_data.get("category", "GENERAL")
        if category not in findings_by_category:
            findings_by_category[category] = []
        findings_by_category[category].append(finding_data)
    
    # Criar novos findings
    created_findings = []
    for i, finding_data in enumerate(findings_data):
        # Associar com evidência correspondente (circular)
        evidence = evidence_list[i % len(evidence_list)] if evidence_list else None
        
        # Extrair confiança do finding_data (pode vir como decimal 0-1 ou string)
        confidence = finding_data.get("confidence", None)
        if isinstance(confidence, str):
            try:
                # Tentar converter string para float
                confidence = float(confidence)
            except (ValueError, TypeError):
                confidence = None
        
        finding = RiskFinding.objects.create(
            assessment=assessment,
            description=finding_data.get("description", ""),
            severity=finding_data.get("severity", "MEDIUM"),
            location=finding_data.get("location", ""),
            evidence=evidence,
            ai_confidence=confidence,  # Preencher com confiança individual
        )
        created_findings.append(finding)
        
        # Se tivermos violations do Olimpia e evidência, processar imagem
        if (
            inference_result
            and hasattr(inference_result, 'violations')
            and evidence
            and getattr(settings, 'SAFETY_IMAGE_DRAW_BOUNDING_BOXES', True)
        ):
            # Encontrar violations correspondentes a este finding
            matching_violations = [
                v for v in inference_result.violations
                if v.description in finding_data.get("description", "")
            ]
            
            if matching_violations:
                try:
                    processed_url = process_evidence_with_olimpia(
                        evidence,
                        matching_violations,
                        save_processed_image=True,
                    )
                    if processed_url:
                        logger.info(f"Imagem processada salva: {processed_url}")
                except Exception as e:
                    logger.warning(f"Erro ao processar imagem da evidência {evidence.id}: {e}")
    
    # Calcular e logar score de compliance
    try:
        compliance = calculate_compliance_score(findings_data)
        logger.info(
            f"Compliance score para avaliação {assessment.id}: "
            f"{compliance['score']}/100 ({compliance['status']})"
        )
    except Exception as e:
        logger.warning(f"Erro ao calcular compliance: {e}")
    
    return created_findings


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
