"""
Interface para cliente de serviço de IA.

Esta interface permite mockar o cliente de IA para testes e
proporciona uma abstração sobre o serviço real de inferência.
"""
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from django.conf import settings

logger = logging.getLogger(__name__)


@dataclass
class BoundingBox:
    """Bounding box de uma detecção (coordenadas normalizadas 0-1)."""
    x1: float  # left
    y1: float  # top
    x2: float  # right
    y2: float  # bottom
    
    def to_list(self) -> List[float]:
        """Retorna como lista [x1, y1, x2, y2]."""
        return [self.x1, self.y1, self.x2, self.y2]
    
    @classmethod
    def from_list(cls, coords: List[float]) -> "BoundingBox":
        """Cria a partir de lista [x1, y1, x2, y2]."""
        if len(coords) >= 4:
            return cls(x1=coords[0], y1=coords[1], x2=coords[2], y2=coords[3])
        return cls(x1=0, y1=0, x2=1, y2=1)


@dataclass
class SafetyViolation:
    """Violação de segurança detectada."""
    rule_id: str  # ex: "rule_1_violation"
    rule_name: str  # nome legível da regra
    description: str  # descrição do risco
    confidence: float  # 0-1
    bounding_box: BoundingBox
    category: str = ""  # categoria do risco (EPI, altura, etc.)
    severity: str = "MEDIUM"  # LOW, MEDIUM, HIGH, CRITICAL
    recommendation: str = ""  # recomendação de mitigação


@dataclass
class AIInferenceResult:
    """Resultado da inferência da IA."""
    success: bool
    findings: List[Dict[str, Any]]
    confidence: str
    model_version: str
    error_message: str = ""
    raw_response: Optional[Dict] = None
    violations: List[SafetyViolation] = field(default_factory=list)
    processed_image_url: Optional[str] = None  # URL da imagem com bounding boxes


@dataclass
class AIInferenceRequest:
    """Requisição para inferência da IA."""
    assessment_id: int
    evidence_urls: List[str]
    title: str = ""
    description: str = ""
    evidence_files: List[Any] = field(default_factory=list)  # arquivos para upload multipart


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
        return AIInferenceResult(
            success=False,
            findings=[],
            confidence="",
            model_version="",
            error_message="Not implemented",
        )

    @abstractmethod
    def health_check(self) -> bool:
        """
        Verifica se o serviço de IA está disponível.
        
        Returns:
            True se o serviço está saudável, False caso contrário
        """
        return False


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
        """Simula análise de avaliação usando risk types do banco de dados."""
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

        # Gerar detecções no formato esperado pela Olímpia (rule_*_violation)
        raw_response = {}
        findings = []
        
        if request.evidence_urls:
            # Simular 2-4 regras ativadas por evidência
            num_rules = min(len(request.evidence_urls) + 1, 4)
            rules_to_detect = [f"rule_{i+1}_violation" for i in range(num_rules)]
            
            for rule_idx, rule_key in enumerate(rules_to_detect):
                detections = []
                # Simular 1-2 detecções por regra
                num_detections = 1 + (rule_idx % 2)
                
                for det_idx in range(num_detections):
                    # Variação de confiança
                    confidence = 0.70 + (rule_idx * 0.05 + det_idx * 0.1) % 0.25
                    
                    # Bounding box simulado (x, y, w, h)
                    bounding_box = [
                        10 + (rule_idx * 20) % 400,  # x
                        10 + (det_idx * 30) % 300,   # y
                        100 + (rule_idx * 15) % 200, # w
                        80 + (det_idx * 20) % 150,   # h
                    ]
                    
                    detection = {
                        "confidence": round(confidence, 2),
                        "bounding_box": bounding_box,
                        "reason": f"Safety violation detected in area {det_idx + 1}",
                    }
                    detections.append(detection)
                
                raw_response[rule_key] = detections
                
                # Criar findings para compatibilidade
                for detection in detections:
                    findings.append({
                        "description": detection.get("reason", f"Violation in {rule_key}"),
                        "severity": ["HIGH", "CRITICAL", "HIGH", "CRITICAL", "CRITICAL", "HIGH"][rule_idx % 6],
                        "location": f"Detection {det_idx + 1}",
                        "confidence": detection.get("confidence", 0.75),
                        "category": rule_key,
                    })

        # Calcular confiança geral
        confidence_levels = ["LOW", "MEDIUM", "HIGH"]
        confidence = confidence_levels[min(len(request.evidence_urls) if request.evidence_urls else 0, 2)]

        return AIInferenceResult(
            success=True,
            findings=findings,
            confidence=confidence,
            model_version="mock-v1.0",
            error_message="",
            raw_response=raw_response,
        )

    def _get_risk_types_from_db(self) -> list:
        """Busca risk types ativos do banco de dados."""
        try:
            # Importação lazy para evitar circular imports
            from configurations.models import RiskType  # type: ignore[import-not-found]
            
            risk_types = RiskType.objects.filter(active=True)
            if risk_types.exists():
                return [
                    {
                        "description": rt.description or rt.name,
                        "severity": "HIGH",  # Default - pode ser customizado no modelo futuramente
                    }
                    for rt in risk_types
                ]
        except Exception as e:
            logger.warning(f"Failed to fetch risk types from DB: {e}")
        
        # Fallback: risk types padrão se não houver no banco
        return []

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


class OlimpiaAIClient(AIClientInterface):
    """
    Cliente de integração com a API Olímpia (Dataprev) para análise de segurança por imagem.
    
    Endpoint: POST /v2/seguranca-por-imagem/infer
    Documentação: Integração real com API Olímpia para detecção de riscos ocupacionais.
    """

    # Mapeamento de regras para categorias e severidades
    RULE_MAPPING = {
        "rule_1_violation": {
            "name": "Uso de EPI - Vestimenta de Segurança",
            "category": "EPI",
            "severity": "HIGH",
            "description": "Verifica uso correto de Equipamentos de Proteção Individual",
        },
        "rule_2_violation": {
            "name": "Trabalho em Altura",
            "category": "QUEDA",
            "severity": "CRITICAL",
            "description": "Detecta trabalhadores acima de 3m sem proteção adequada",
        },
        "rule_3_violation": {
            "name": "Abertura de Valas e Escavações",
            "category": "ESCAVACAO",
            "severity": "HIGH",
            "description": "Identifica bordas de valas sem sinalização ou proteção",
        },
        "rule_4_violation": {
            "name": "Proximidade com Máquinas",
            "category": "MAQUINARIO",
            "severity": "CRITICAL",
            "description": "Detecta pedestres em área de operação de equipamentos",
        },
        "rule_5_violation": {
            "name": "Espaço Confinado",
            "category": "ESPACO_CONFINADO",
            "severity": "CRITICAL",
            "description": "Identifica entrada em espaços confinados sem autorização",
        },
        "rule_6_violation": {
            "name": "Proteção Elétrica",
            "category": "ELETRICO",
            "severity": "HIGH",
            "description": "Verifica exposição a riscos elétricos",
        },
    }

    # Recomendações por categoria
    RECOMMENDATIONS = {
        "EPI": "Fornecer e fiscalizar uso correto de EPI conforme NR-6. Treinar trabalhadores.",
        "QUEDA": "Implementar sistema de proteção coletiva ou individual conforme NR-35. Usar cinto de segurança.",
        "ESCAVACAO": "Sinalizar perímetro, instalar barreiras físicas e seguir NR-18 para escavações.",
        "MAQUINARIO": "Delimitar área de operação, usar sinalizador/spotter e manter distância de segurança.",
        "ESPACO_CONFINADO": "Exigir Permissão de Trabalho (PT) e monitoramento contínuo conforme NR-33.",
        "ELETRICO": "Verificar bloqueio/etiquetagem, usar EPI específico e manter distância mínima.",
    }

    def __init__(
        self,
        api_url: Optional[str] = None,
        api_token: Optional[str] = None,
        timeout: int = 60,
        language: str = "en_us",
    ):
        self.api_url = api_url or getattr(
            settings, "OLIMPIA_API_URL", 
            "https://api.olimpia.suia.dataprev.gov.br/v2/seguranca-por-imagem/infer"
        )
        self.api_token = api_token or getattr(settings, "OLIMPIA_API_TOKEN", "")
        self.timeout = timeout or getattr(settings, "OLIMPIA_API_TIMEOUT", 60)
        # Requisito de produto: payload da Olímpia deve sempre ser retornado em inglês.
        self.language = "en_us"
        self.min_confidence = getattr(settings, "OLIMPIA_MIN_CONFIDENCE", 0.70)

    def _get_headers(self) -> Dict[str, str]:
        """Retorna headers para requisição à API Olímpia."""
        return {
            "accept": "application/json",
            "Authorization": f"Bearer {self.api_token}",
        }

    def _build_url(self) -> str:
        """Constrói URL completa com parâmetros de query."""
        separator = "&" if "?" in self.api_url else "?"
        return f"{self.api_url}{separator}lang={self.language}"

    def _parse_violations(self, response_data: Dict[str, Any]) -> List[SafetyViolation]:
        """Converte resposta da API em lista de SafetyViolation."""
        violations = []
        
        for rule_key, detections in response_data.items():
            if not rule_key.endswith("_violation"):
                continue
            
            if not isinstance(detections, list):
                continue
            
            rule_info = self.RULE_MAPPING.get(rule_key, {
                "name": rule_key,
                "category": "GENERAL",
                "severity": "MEDIUM",
                "description": "Violação de segurança detectada",
            })
            
            for detection in detections:
                confidence = detection.get("confidence", 0.0)
                
                # Filtrar por confiança mínima
                if confidence < self.min_confidence:
                    logger.debug(f"Ignorando detecção com confiança baixa: {confidence}")
                    continue
                
                bbox = BoundingBox.from_list(detection.get("bounding_box", [0, 0, 1, 1]))
                
                violation = SafetyViolation(
                    rule_id=rule_key,
                    rule_name=rule_info["name"],
                    description=detection.get("reason", rule_info["description"]),
                    confidence=confidence,
                    bounding_box=bbox,
                    category=rule_info["category"],
                    severity=rule_info["severity"],
                    recommendation=self.RECOMMENDATIONS.get(rule_info["category"], ""),
                )
                violations.append(violation)
        
        # Ordenar por confiança (maior primeiro)
        violations.sort(key=lambda v: v.confidence, reverse=True)
        return violations

    def _violations_to_findings(self, violations: List[SafetyViolation]) -> List[Dict[str, Any]]:
        """Converte violações para formato de findings do sistema."""
        findings = []
        for v in violations:
            findings.append({
                "description": v.description,
                "severity": v.severity,
                "location": "",
                "category": v.category,
                "confidence": v.confidence,
                "bounding_box": v.bounding_box.to_list(),
                "rule_id": v.rule_id,
                "recommendation": v.recommendation,
            })
        return findings

    def analyze_image_file(self, image_path: str) -> AIInferenceResult:
        """
        Analisa uma imagem diretamente via API Olímpia.
        
        Args:
            image_path: Caminho para o arquivo de imagem
            
        Returns:
            AIInferenceResult com as violações detectadas
        """
        import requests
        
        url = self._build_url()
        headers = self._get_headers()
        
        try:
            with open(image_path, "rb") as image_file:
                files = {"file": (image_path.split("/")[-1], image_file, "image/jpeg")}
                
                logger.info(f"Enviando imagem para API Olímpia: {image_path}")
                response = requests.post(
                    url,
                    headers=headers,
                    files=files,
                    timeout=self.timeout,
                )
                
                response.raise_for_status()
                data = response.json()
                
                logger.info(f"Resposta da API Olímpia recebida: {len(data)} regras")
                
                violations = self._parse_violations(data)
                findings = self._violations_to_findings(violations)
                
                # Calcular confiança geral
                if violations:
                    avg_confidence = sum(v.confidence for v in violations) / len(violations)
                    if avg_confidence >= 0.85:
                        confidence_level = "HIGH"
                    elif avg_confidence >= 0.70:
                        confidence_level = "MEDIUM"
                    else:
                        confidence_level = "LOW"
                else:
                    confidence_level = "HIGH"  # Sem violações = boa confiança
                
                return AIInferenceResult(
                    success=True,
                    findings=findings,
                    confidence=confidence_level,
                    model_version="olimpia-v2",
                    error_message="",
                    raw_response=data,
                    violations=violations,
                )
                
        except requests.exceptions.Timeout:
            logger.error("Timeout na API Olímpia")
            return AIInferenceResult(
                success=False,
                findings=[],
                confidence="",
                model_version="olimpia-v2",
                error_message="Timeout ao conectar com API Olímpia",
            )
        except requests.exceptions.HTTPError as e:
            logger.error(f"Erro HTTP na API Olímpia: {e}")
            return AIInferenceResult(
                success=False,
                findings=[],
                confidence="",
                model_version="olimpia-v2",
                error_message=f"Erro API Olímpia: {response.status_code} - {response.text}",
            )
        except Exception as e:
            logger.exception(f"Erro inesperado na API Olímpia: {e}")
            return AIInferenceResult(
                success=False,
                findings=[],
                confidence="",
                model_version="olimpia-v2",
                error_message=f"Erro inesperado: {str(e)}",
            )

    def analyze_assessment(self, request: AIInferenceRequest) -> AIInferenceResult:
        """
        Analisa evidências de uma avaliação via API Olímpia.
        
        Processa cada evidência (imagem) individualmente e agrega resultados.
        
        Args:
            request: Dados da requisição de inferência
            
        Returns:
            AIInferenceResult com todos os achados agregados
        """
        import os
        from django.conf import settings
        from django.core.files.storage import default_storage
        
        all_violations = []
        all_findings = []
        all_raw_responses = []
        total_confidences = []
        errors = []
        
        logger.info(f"Analisando avaliação {request.assessment_id} com {len(request.evidence_urls)} evidências")
        
        for evidence_url in request.evidence_urls:
            try:
                # Converter URL para caminho de arquivo local
                if evidence_url.startswith("/media/"):
                    relative_path = evidence_url.replace("/media/", "")
                elif evidence_url.startswith(settings.MEDIA_URL):
                    relative_path = evidence_url.replace(settings.MEDIA_URL, "")
                else:
                    relative_path = evidence_url
                
                file_path = os.path.join(settings.MEDIA_ROOT, relative_path)
                
                if not os.path.exists(file_path):
                    logger.warning(f"Arquivo não encontrado: {file_path}")
                    errors.append(f"File not found: {file_path}")
                    continue
                
                # Analisar imagem
                result = self.analyze_image_file(file_path)
                
                if result.success:
                    all_violations.extend(result.violations)
                    all_findings.extend(result.findings)
                    all_raw_responses.append(result.raw_response)
                    
                    if result.violations:
                        avg_conf = sum(v.confidence for v in result.violations) / len(result.violations)
                        total_confidences.append(avg_conf)
                else:
                    logger.warning(f"Falha ao analisar {file_path}: {result.error_message}")
                    errors.append(result.error_message)
                    
            except Exception as e:
                logger.exception(f"Erro processando evidência {evidence_url}: {e}")
                errors.append(str(e))
                continue
        
        # If no image was successfully processed, propagate the error
        if not all_raw_responses and errors:
            return AIInferenceResult(
                success=False,
                findings=[],
                confidence="",
                model_version="olimpia-v2",
                error_message="; ".join(errors),
            )
        
        # Calcular confiança geral
        if total_confidences:
            overall_confidence = sum(total_confidences) / len(total_confidences)
            if overall_confidence >= 0.85:
                confidence_level = "HIGH"
            elif overall_confidence >= 0.70:
                confidence_level = "MEDIUM"
            else:
                confidence_level = "LOW"
        else:
            confidence_level = "HIGH"  # Sem violações
        
        logger.info(
            f"Análise concluída: {len(all_findings)} findings "
            f"de {len(all_findings)} total"
        )
        
        # Merge individual responses so rule_*_violation keys are at the
        # top level – this is what the serializer expects.
        merged_raw: Dict[str, Any] = {}
        for individual_response in all_raw_responses:
            if not isinstance(individual_response, dict):
                continue
            for key, detections in individual_response.items():
                if not key.endswith("_violation"):
                    continue
                if detections is None:
                    merged_raw.setdefault(key, None)
                elif isinstance(detections, list):
                    if not isinstance(merged_raw.get(key), list):
                        merged_raw[key] = []
                    merged_raw[key].extend(detections)

        return AIInferenceResult(
            success=True,
            findings=all_findings,
            confidence=confidence_level,
            model_version="olimpia-v2",
            error_message="",
            raw_response=merged_raw,
            violations=all_violations,
        )

    def health_check(self) -> bool:
        """Verifica saúde da API Olímpia com uma requisição simples."""
        import requests
        
        try:
            # Fazer requisição HEAD ou GET simples
            # Como a API Olímpia não tem endpoint de health específico,
            # verificamos apenas se a URL está acessível
            response = requests.get(
                self.api_url.replace("/infer", "/health"),
                headers=self._get_headers(),
                timeout=10,
                verify=True,
            )
            return response.status_code in [200, 404]  # 404 é OK se o endpoint não existir
        except requests.exceptions.RequestException:
            # Tentar verificar se o domínio resolve
            try:
                import socket
                hostname = self.api_url.split("//")[1].split("/")[0]
                socket.gethostbyname(hostname)
                return True  # DNS resolve, API pode estar disponível
            except Exception:
                return False


def get_ai_client() -> AIClientInterface:
    """
    Factory para obter cliente de IA configurado.
    
    Prioridade:
    1. Mock mode (para desenvolvimento/testes)
    2. Olimpia client (para produção com API Dataprev)
    3. MockAIClient (fallback)
    
    Returns:
        Instância de AIClientInterface configurada
    """
    # Modo mock - sempre usa mock
    if getattr(settings, 'AI_SERVICE_MOCK_MODE', False):
        logger.info("Using MockAIClient (mock mode enabled)")
        return MockAIClient()
    
    # Cliente Olímpia - integração real com API Dataprev
    olimpia_enabled = getattr(settings, 'OLIMPIA_API_ENABLED', False)
    olimpia_token = getattr(settings, 'OLIMPIA_API_TOKEN', '')
    
    if olimpia_enabled and olimpia_token:
        logger.info("Using OlimpiaAIClient (Dataprev API integration)")
        return OlimpiaAIClient(
            api_url=getattr(settings, 'OLIMPIA_API_URL', None),
            api_token=olimpia_token,
            timeout=getattr(settings, 'OLIMPIA_API_TIMEOUT', 60),
            language=getattr(settings, 'OLIMPIA_API_LANGUAGE', 'en_us'),
        )
    
    # Fallback para mock se nenhum cliente real estiver configurado
    logger.info("Using MockAIClient (no real AI client configured)")
    return MockAIClient()
