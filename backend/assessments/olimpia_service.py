"""
Serviço de integração com a API Olímpia (Dataprev).

Responsável por:
- Salvar resultados de detecção no banco de dados
- Processar violações e criar OlimpiaDetectionResult
- Gerenciar cache de resultados
- Integrar com RiskFinding
"""
import logging
from typing import List, Optional, Dict, Any
from django.db import transaction
from django.conf import settings

from .models import (
    RiskAssessment,
    Evidence,
    AIInferenceResult,
    RiskFinding,
    OlimpiaDetectionResult,
)
from .ai_client import OlimpiaAIClient, SafetyViolation, AIInferenceResult as AIResult
from .image_processor import process_evidence_with_olimpia, calculate_compliance_score

logger = logging.getLogger(__name__)


class OlimpiaService:
    """Serviço para processamento de resultados da API Olímpia."""

    def __init__(self):
        self.client = OlimpiaAIClient()
        self.min_confidence = getattr(settings, "OLIMPIA_MIN_CONFIDENCE", 0.70)

    def analyze_evidence(self, evidence: Evidence) -> Optional[AIResult]:
        """
        Analisa uma evidência individual via API Olímpia.
        
        Args:
            evidence: Instância de Evidence com arquivo de imagem
            
        Returns:
            AIInferenceResult ou None se falhar
        """
        if not evidence.file:
            logger.warning(f"Evidência {evidence.id} não tem arquivo")
            return None
        
        try:
            file_path = evidence.file.path
            result = self.client.analyze_image_file(file_path)
            
            if result.success:
                logger.info(
                    f"Evidência {evidence.id} analisada: "
                    f"{len(result.violations)} violações detectadas"
                )
            else:
                logger.warning(
                    f"Falha ao analisar evidência {evidence.id}: "
                    f"{result.error_message}"
                )
            
            return result
            
        except Exception as e:
            logger.exception(f"Erro analisando evidência {evidence.id}: {e}")
            return None

    @transaction.atomic
    def save_detection_results(
        self,
        evidence: Evidence,
        inference: AIInferenceResult,
        violations: List[SafetyViolation],
    ) -> List[OlimpiaDetectionResult]:
        """
        Salva resultados de detecção no banco de dados.
        
        Args:
            evidence: Evidência analisada
            inference: Resultado de inferência relacionado
            violations: Lista de violações detectadas
            
        Returns:
            Lista de OlimpiaDetectionResult criados
        """
        detection_results = []
        
        for violation in violations:
            # Verificar confiança mínima
            if violation.confidence < self.min_confidence:
                logger.debug(f"Ignorando violação com confiança {violation.confidence}")
                continue
            
            detection = OlimpiaDetectionResult.objects.create(
                evidence=evidence,
                inference=inference,
                rule_id=violation.rule_id,
                rule_name=violation.rule_name,
                description=violation.description,
                confidence=violation.confidence,
                bbox_x1=violation.bounding_box.x1,
                bbox_y1=violation.bounding_box.y1,
                bbox_x2=violation.bounding_box.x2,
                bbox_y2=violation.bounding_box.y2,
                category=violation.category,
                severity=violation.severity,
                recommendation=violation.recommendation,
            )
            detection_results.append(detection)
        
        logger.info(
            f"Salvos {len(detection_results)} resultados de detecção "
            f"para evidência {evidence.id}"
        )
        
        return detection_results

    @transaction.atomic
    def create_risk_findings_from_detections(
        self,
        assessment: RiskAssessment,
        detections: List[OlimpiaDetectionResult],
    ) -> List[RiskFinding]:
        """
        Cria RiskFinding a partir dos resultados de detecção.
        
        Args:
            assessment: Avaliação relacionada
            detections: Lista de detecções Olímpia
            
        Returns:
            Lista de RiskFinding criados
        """
        findings = []
        
        for detection in detections:
            # Verificar se já existe finding similar
            existing = RiskFinding.objects.filter(
                assessment=assessment,
                description__icontains=detection.description[:50],
            ).first()
            
            if existing:
                logger.debug(f"Finding similar já existe para detecção {detection.id}")
                continue
            
            finding = RiskFinding.objects.create(
                assessment=assessment,
                description=f"[{detection.rule_name}] {detection.description}",
                severity=detection.severity,
                location=f"Detectado na evidência #{detection.evidence_id}",
                evidence=detection.evidence,
                ai_confidence=detection.confidence,  # Armazenar confiança individual
            )
            findings.append(finding)
        
        return findings

    def process_assessment_with_detections(
        self,
        assessment: RiskAssessment,
        inference: AIInferenceResult,
    ) -> Dict[str, Any]:
        """
        Processa uma avaliação completa criando detecções e findings.
        
        Args:
            assessment: Avaliação a ser processada
            inference: Resultado de inferência da IA
            
        Returns:
            Dict com resumo do processamento
        """
        from .ai_client import get_ai_client, AIInferenceRequest
        
        # Buscar evidências
        evidences = list(Evidence.objects.filter(assessment=assessment))
        
        if not evidences:
            logger.warning(f"Avaliação {assessment.id} não tem evidências")
            return {
                "status": "error",
                "message": "No evidences found",
                "detections_count": 0,
                "findings_count": 0,
            }
        
        # Preparar requisição
        evidence_urls = [e.file.url for e in evidences if e.file]
        request = AIInferenceRequest(
            assessment_id=assessment.id,
            evidence_urls=evidence_urls,
            title=assessment.title or "",
            description=assessment.description or "",
        )
        
        # Analisar
        result = self.client.analyze_assessment(request)
        
        if not result.success:
            logger.error(f"Falha na análise Olímpia: {result.error_message}")
            return {
                "status": "error",
                "message": result.error_message,
                "detections_count": 0,
                "findings_count": 0,
            }
        
        # Agrupar violações por evidência
        violations_by_evidence = {}
        for i, violation in enumerate(result.violations):
            # Distribuir violations entre evidências (round-robin)
            evidence_index = i % len(evidences)
            evidence = evidences[evidence_index]
            
            if evidence.id not in violations_by_evidence:
                violations_by_evidence[evidence.id] = []
            violations_by_evidence[evidence.id].append(violation)
        
        # Salvar detecções e processar imagens
        all_detections = []
        processed_images = []
        
        for evidence in evidences:
            violations = violations_by_evidence.get(evidence.id, [])
            
            if violations:
                # Salvar detecções no banco
                detections = self.save_detection_results(
                    evidence, inference, violations
                )
                all_detections.extend(detections)
                
                # Processar imagem com bounding boxes
                if getattr(settings, "SAFETY_IMAGE_DRAW_BOUNDING_BOXES", True):
                    try:
                        processed_url = process_evidence_with_olimpia(
                            evidence, violations, save_processed_image=True
                        )
                        if processed_url:
                            processed_images.append(processed_url)
                            
                            # Atualizar detecções com URL da imagem processada
                            # (a primeira detecção recebe a imagem como referência)
                            if detections:
                                # Nota: A imagem processada é salva no filesystem,
                                # aqui apenas registramos que foi processada
                                pass
                    except Exception as e:
                        logger.warning(f"Erro processando imagem: {e}")
        
        # Criar findings
        findings = self.create_risk_findings_from_detections(
            assessment, all_detections
        )
        
        # Calcular compliance
        compliance = calculate_compliance_score(result.findings)
        
        logger.info(
            f"Processamento concluído para avaliação {assessment.id}: "
            f"{len(all_detections)} detecções, {len(findings)} findings, "
            f"score {compliance['score']}"
        )
        
        return {
            "status": "success",
            "detections_count": len(all_detections),
            "findings_count": len(findings),
            "processed_images": len(processed_images),
            "compliance_score": compliance["score"],
            "compliance_status": compliance["status"],
            "violations_by_severity": {
                "critical": compliance["critical"],
                "high": compliance["high"],
                "medium": compliance["medium"],
                "low": compliance["low"],
            },
        }


def get_olimpia_service() -> OlimpiaService:
    """Factory para obter instância do serviço Olímpia."""
    return OlimpiaService()
