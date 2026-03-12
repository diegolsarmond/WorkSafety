"""
Interface para cliente de serviço de IA.

Esta interface permite mockar o cliente de IA para testes e
proporciona uma abstração sobre o serviço real de inferência.
"""
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from django.conf import settings

logger = logging.getLogger(__name__)


@dataclass
class AIInferenceResult:
    """Resultado da inferência da IA."""
    success: bool
    findings: List[Dict[str, Any]]
    confidence: str
    model_version: str
    error_message: str = ""
    raw_response: Optional[Dict] = None


@dataclass
class AIInferenceRequest:
    """Requisição para inferência da IA."""
    assessment_id: int
    evidence_urls: List[str]
    title: str = ""
    description: str = ""


class AIClientInterface(ABC):
    """Interface abstrata para clientes de IA."""

    @abstractmethod
    def analyze_assessment(self, request: AIInferenceRequest) -> AIInferenceResult:
        """
        Analisa uma avaliação e retorna os riscos identificados.
        
        Args:
            request: Dados da requisição de inferência
            
        Returns:
            AIInferenceResult com os resultados da análise
        """
        pass

    @abstractmethod
    def health_check(self) -> bool:
        """
        Verifica se o serviço de IA está disponível.
        
        Returns:
            True se o serviço está saudável, False caso contrário
        """
        pass


class MockAIClient(AIClientInterface):
    """
    Cliente mock de IA para testes e desenvolvimento.
    
    Simula respostas da IA baseadas no conteúdo da requisição.
    """

    def __init__(self, fail_rate: float = 0.0, simulate_delay: float = 0.0):
        """
        Args:
            fail_rate: Probabilidade de falha (0.0 a 1.0)
            simulate_delay: Tempo de delay simulado em segundos
        """
        self.fail_rate = fail_rate
        self.simulate_delay = simulate_delay
        self._call_count = 0

    def analyze_assessment(self, request: AIInferenceRequest) -> AIInferenceResult:
        """Simula análise de avaliação."""
        import random
        import time

        self._call_count += 1

        if self.simulate_delay > 0:
            time.sleep(self.simulate_delay)

        # Simular falha baseada na taxa configurada
        if random.random() < self.fail_rate:
            return AIInferenceResult(
                success=False,
                findings=[],
                confidence="",
                model_version="mock-v1.0",
                error_message="Simulated AI service failure",
                raw_response=None,
            )

        # Simular detecção de riscos baseada no número de evidências
        findings = []
        if request.evidence_urls:
            # Simular 1-3 riscos por evidência
            for i, url in enumerate(request.evidence_urls):
                risk_types = [
                    {
                        "description": "EPI não utilizado corretamente - capacete ausente",
                        "severity": "HIGH",
                        "location": f"Área de trabalho {i+1}",
                    },
                    {
                        "description": "Equipamento elétrico sem aterramento visível",
                        "severity": "CRITICAL",
                        "location": f"Posto {i+1}",
                    },
                    {
                        "description": "Sinalização de segurança desatualizada",
                        "severity": "MEDIUM",
                        "location": f"Corredor {i+1}",
                    },
                    {
                        "description": "Extintor de incêndio em local de difícil acesso",
                        "severity": "LOW",
                        "location": f"Setor {i+1}",
                    },
                ]
                # Selecionar risco baseado no índice
                risk = risk_types[i % len(risk_types)]
                findings.append(risk)

        # Calcular confiança baseada na quantidade de evidências
        confidence_levels = ["LOW", "MEDIUM", "HIGH"]
        confidence = confidence_levels[min(len(request.evidence_urls), 3) - 1] if request.evidence_urls else "LOW"

        return AIInferenceResult(
            success=True,
            findings=findings,
            confidence=confidence,
            model_version="mock-v1.0",
            error_message="",
            raw_response={
                "processed_images": len(request.evidence_urls),
                "analysis_duration_ms": 1500,
                "model_confidence": confidence,
            },
        )

    def health_check(self) -> bool:
        """Sempre retorna saudável no mock."""
        return True

    def get_call_count(self) -> int:
        """Retorna número de chamadas (para testes)."""
        return self._call_count


class AIClient(AIClientInterface):
    """
    Cliente real de IA para produção.
    
    Implementa integração com serviço externo de IA.
    (Placeholder - implementar quando o serviço real estiver definido)
    """

    def __init__(self, base_url: Optional[str] = None, api_key: Optional[str] = None):
        self.base_url = base_url or settings.AI_SERVICE_BASE_URL
        self.api_key = api_key or settings.AI_SERVICE_API_KEY
        self.timeout = settings.AI_SERVICE_TIMEOUT

    def analyze_assessment(self, request: AIInferenceRequest) -> AIInferenceResult:
        """
        Chama serviço externo de IA para análise.
        
        TODO: Implementar integração real com serviço de IA
        """
        # Placeholder - implementar quando o contrato do serviço estiver definido
        raise NotImplementedError(
            "AIClient real ainda não implementado. "
            "Use MockAIClient ou configure AI_SERVICE_MOCK_MODE=true"
        )

    def health_check(self) -> bool:
        """Verifica saúde do serviço de IA."""
        # TODO: Implementar health check real
        return False


def get_ai_client() -> AIClientInterface:
    """
    Factory para obter cliente de IA configurado.
    
    Returns:
        Instância de AIClientInterface configurada
    """
    if getattr(settings, 'AI_SERVICE_MOCK_MODE', False):
        logger.info("Using MockAIClient (mock mode enabled)")
        return MockAIClient()
    
    # TODO: Quando o serviço real estiver disponível, retornar AIClient()
    logger.info("Using MockAIClient (real client not yet implemented)")
    return MockAIClient()
