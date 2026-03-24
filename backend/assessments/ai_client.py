"""
Interface para cliente de serviço de IA.

Esta interface permite mockar o cliente de IA para testes e
proporciona uma abstração sobre o serviço real de inferência.
"""
import logging
import threading
import time
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
            try:
                x1, y1, x2, y2 = [float(c) for c in coords[:4]]
            except (TypeError, ValueError):
                return cls(x1=0, y1=0, x2=1, y2=1)

            # Clamp de segurança para coordenadas normalizadas.
            x1 = max(0.0, min(1.0, x1))
            y1 = max(0.0, min(1.0, y1))
            x2 = max(0.0, min(1.0, x2))
            y2 = max(0.0, min(1.0, y2))
            return cls(x1=x1, y1=y1, x2=x2, y2=y2)
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
        # Cada regra é aleatoriamente detectada (como ocorre na API real)
        raw_response = {}
        findings = []
        
        if request.evidence_urls:
            # Iterar sobre todas as possíveis regras (1-8)
            available_rules = [f"rule_{i}_violation" for i in range(1, 9)]
            
            for rule_idx, rule_key in enumerate(available_rules):
                # Aleatoriamente decidir se essa regra foi detectada (60% de chance padrão)
                detection_probability = 0.6
                if random.random() > detection_probability:
                    # Regra não foi detectada, adicionar como null (como API faz)
                    raw_response[rule_key] = None
                    continue
                
                detections = []
                # Se detectada, simular 1-2 detecções por regra
                num_detections = random.randint(1, 2)
                
                for det_idx in range(num_detections):
                    # Confiança aleatória entre 0.72 e 0.98
                    confidence = round(random.uniform(0.72, 0.98), 2)
                    
                    # Bounding box em pixels (como a API real agora retorna)
                    # Imagem tipicamente ~1000x1000, então valores entre 0-1000
                    bounding_box = [
                        random.randint(0, 800),    # x1
                        random.randint(0, 800),    # y1
                        random.randint(200, 1000), # x2
                        random.randint(200, 1000), # y2
                    ]
                    
                    # Descriptions por regra
                    rule_descriptions = {
                        "rule_1_violation": "Trabalhador não está usando EPI adequado",
                        "rule_2_violation": "Presença de trabalhador em altura sem proteção",
                        "rule_3_violation": "Piso com detritos e risco de tropeço",
                        "rule_4_violation": "Proximidade com máquinas em operação",
                        "rule_5_violation": "Possível entrada em espaço confinado",
                        "rule_6_violation": "Risco de exposição elétrica detectado",
                        "rule_7_violation": "Violação de segurança detectada pela regra 7",
                        "rule_8_violation": "Violação de segurança detectada pela regra 8",
                    }
                    
                    detection = {
                        "confidence": confidence,
                        "bounding_box": bounding_box,
                        "reason": rule_descriptions.get(rule_key, f"Safety violation in {rule_key}"),
                    }
                    detections.append(detection)
                
                raw_response[rule_key] = detections

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
        "rule_7_violation": {
            "name": "Regra 7 - Risco Ocupacional",
            "category": "GENERAL",
            "severity": "MEDIUM",
            "description": "Violação de segurança detectada pela regra 7",
        },
        "rule_8_violation": {
            "name": "Regra 8 - Risco Ocupacional",
            "category": "GENERAL",
            "severity": "MEDIUM",
            "description": "Violação de segurança detectada pela regra 8",
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
        "GENERAL": "Avaliar o risco identificado, aplicar controles de engenharia e reforçar procedimentos de segurança.",
    }

    # Thread-safe OAuth2 token cache (shared across all instances)
    _token_lock = threading.Lock()
    _cached_token: Optional[str] = None
    _token_expires_at: float = 0.0

    def __init__(
        self,
        api_url: Optional[str] = None,
        api_token: Optional[str] = None,
        timeout: int = 60,
        language: str = "pt_br",
        token_url: Optional[str] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
    ):
        self.api_url = api_url or getattr(
            settings, "OLIMPIA_API_URL", 
            "https://api.olimpia.suia.dataprev.gov.br/v2/seguranca-por-imagem/infer"
        )
        self.timeout = timeout or getattr(settings, "OLIMPIA_API_TIMEOUT", 60)
        # Requisito de produto: payload da Olímpia deve sempre ser retornado em inglês.
        self.language = "pt_br"
        self.min_confidence = getattr(settings, "OLIMPIA_MIN_CONFIDENCE", 0.70)

        # OAuth2 Client Credentials (preferred)
        self.token_url = token_url or getattr(settings, "OLIMPIA_TOKEN_URL", "")
        self.client_id = client_id or getattr(settings, "OLIMPIA_CLIENT_ID", "")
        self.client_secret = client_secret or getattr(settings, "OLIMPIA_CLIENT_SECRET", "")
        # Legacy: static token fallback
        self._static_token = api_token or getattr(settings, "OLIMPIA_API_TOKEN", "")

    @property
    def _use_oauth2(self) -> bool:
        return bool(self.token_url and self.client_id and self.client_secret)

    def _fetch_oauth2_token(self) -> str:
        """Obtém novo access_token via OAuth2 Client Credentials."""
        import requests

        logger.info("Requesting new OAuth2 token from Olímpia Keycloak")
        resp = requests.post(
            self.token_url,
            data={
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15,
        )
        resp.raise_for_status()
        body = resp.json()
        access_token = body["access_token"]
        expires_in = int(body.get("expires_in", 300))
        # Renew 60s before expiry to avoid edge-case failures
        OlimpiaAIClient._cached_token = access_token
        OlimpiaAIClient._token_expires_at = time.monotonic() + expires_in - 60
        logger.info(f"OAuth2 token obtained, expires in {expires_in}s")
        return access_token

    def _get_token(self) -> str:
        """Retorna um Bearer token válido (OAuth2 com cache ou static fallback)."""
        if not self._use_oauth2:
            return self._static_token

        with OlimpiaAIClient._token_lock:
            if (
                OlimpiaAIClient._cached_token
                and time.monotonic() < OlimpiaAIClient._token_expires_at
            ):
                return OlimpiaAIClient._cached_token
            return self._fetch_oauth2_token()

    def _get_headers(self) -> Dict[str, str]:
        """Retorna headers para requisição à API Olímpia."""
        return {
            "accept": "application/json",
            "Authorization": f"Bearer {self._get_token()}",
        }

    def _build_url(self) -> str:
        """Constrói URL completa com parâmetros de query."""
        separator = "&" if "?" in self.api_url else "?"
        return f"{self.api_url}{separator}lang={self.language}"

    @staticmethod
    def _normalize_bounding_box(
        bbox: Any,
        image_width: Optional[int] = None,
        image_height: Optional[int] = None,
    ) -> BoundingBox:
        """
        Normaliza bounding box para coordenadas 0-1.

        A Olímpia pode retornar tanto coordenadas normalizadas quanto pixels.
        """
        if not isinstance(bbox, list) or len(bbox) < 4:
            return BoundingBox(x1=0, y1=0, x2=1, y2=1)

        try:
            x1, y1, x2, y2 = [float(c) for c in bbox[:4]]
        except (TypeError, ValueError):
            return BoundingBox(x1=0, y1=0, x2=1, y2=1)

        # Se qualquer coordenada > 1, assumir que veio em pixels.
        is_pixel_bbox = max(x1, y1, x2, y2) > 1.0
        if is_pixel_bbox:
            if not image_width or not image_height:
                logger.warning("Bounding box em pixels sem dimensoes da imagem; usando bbox padrao")
                return BoundingBox(x1=0, y1=0, x2=1, y2=1)

            x1 /= float(image_width)
            x2 /= float(image_width)
            y1 /= float(image_height)
            y2 /= float(image_height)

        # Ordenar e limitar para evitar valores fora de faixa no banco.
        x1, x2 = min(x1, x2), max(x1, x2)
        y1, y2 = min(y1, y2), max(y1, y2)

        x1 = max(0.0, min(1.0, x1))
        y1 = max(0.0, min(1.0, y1))
        x2 = max(0.0, min(1.0, x2))
        y2 = max(0.0, min(1.0, y2))

        return BoundingBox(x1=x1, y1=y1, x2=x2, y2=y2)

    def _parse_violations(
        self,
        response_data: Dict[str, Any],
        image_width: Optional[int] = None,
        image_height: Optional[int] = None,
    ) -> List[SafetyViolation]:
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
                
                bbox = self._normalize_bounding_box(
                    detection.get("bounding_box", [0, 0, 1, 1]),
                    image_width=image_width,
                    image_height=image_height,
                )
                
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
        from PIL import Image
        
        url = self._build_url()
        
        # Retry once on 401 in case cached token just expired
        for attempt in range(2):
            headers = self._get_headers()
            try:
                image_width = None
                image_height = None
                try:
                    with Image.open(image_path) as img_info:
                        image_width, image_height = img_info.size
                except Exception as image_error:
                    logger.warning(f"Falha ao ler dimensoes da imagem {image_path}: {image_error}")

                with open(image_path, "rb") as image_file:
                    files = {"file": (image_path.split("/")[-1], image_file, "image/jpeg")}
                    
                    logger.info(f"Enviando imagem para API Olímpia: {image_path}")
                    response = requests.post(
                        url,
                        headers=headers,
                        files=files,
                        timeout=self.timeout,
                    )
                    
                    if response.status_code == 401 and attempt == 0 and self._use_oauth2:
                        logger.warning("Got 401 from Olímpia, refreshing OAuth2 token and retrying")
                        with OlimpiaAIClient._token_lock:
                            OlimpiaAIClient._token_expires_at = 0.0
                        continue
                    
                    response.raise_for_status()
                    data = response.json()
                
                    logger.info(f"Resposta da API Olímpia recebida: {len(data)} regras")
                    
                    violations = self._parse_violations(
                        data,
                        image_width=image_width,
                        image_height=image_height,
                    )
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
    client_id = getattr(settings, 'OLIMPIA_CLIENT_ID', '')
    client_secret = getattr(settings, 'OLIMPIA_CLIENT_SECRET', '')
    token_url = getattr(settings, 'OLIMPIA_TOKEN_URL', '')
    static_token = getattr(settings, 'OLIMPIA_API_TOKEN', '')

    has_oauth2 = bool(client_id and client_secret and token_url)
    has_static = bool(static_token)

    if olimpia_enabled and (has_oauth2 or has_static):
        auth_mode = "OAuth2 Client Credentials" if has_oauth2 else "static token"
        logger.info(f"Using OlimpiaAIClient ({auth_mode})")
        return OlimpiaAIClient(
            api_url=getattr(settings, 'OLIMPIA_API_URL', None),
            api_token=static_token if not has_oauth2 else None,
            timeout=getattr(settings, 'OLIMPIA_API_TIMEOUT', 60),
            language=getattr(settings, 'OLIMPIA_API_LANGUAGE', 'en_us'),
            token_url=token_url if has_oauth2 else None,
            client_id=client_id if has_oauth2 else None,
            client_secret=client_secret if has_oauth2 else None,
        )
    
    # Fallback para mock se nenhum cliente real estiver configurado
    logger.info("Using MockAIClient (no real AI client configured)")
    return MockAIClient()
