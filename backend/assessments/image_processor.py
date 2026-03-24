"""
Processamento de imagens para análise de segurança.

Inclui funcionalidades para:
- Desenhar bounding boxes em imagens
- Gerar overlays visuais com detecções
- Calcular scores de compliance
- Gerar relatórios visuais
"""
import logging
import os
import io
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from PIL import Image, ImageDraw, ImageFont
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

logger = logging.getLogger(__name__)


@dataclass
class DetectionBox:
    """Caixa de detecção com metadados para visualização."""
    x1: float  # normalizado 0-1
    y1: float  # normalizado 0-1
    x2: float  # normalizado 0-1
    y2: float  # normalizado 0-1
    label: str
    confidence: float
    color: Tuple[int, int, int] = (255, 0, 0)  # RGB
    
    def to_pixels(self, width: int, height: int) -> Tuple[int, int, int, int]:
        """Converte coordenadas normalizadas para pixels."""
        return (
            int(self.x1 * width),
            int(self.y1 * height),
            int(self.x2 * width),
            int(self.y2 * height),
        )


class SafetyImageProcessor:
    """Processador de imagens para visualização de detecções de segurança."""
    
    # Cores por categoria de risco (RGB)
    CATEGORY_COLORS = {
        "EPI": (255, 165, 0),        # Laranja
        "QUEDA": (255, 0, 0),        # Vermelho
        "ESCAVACAO": (139, 69, 19),  # Marrom
        "MAQUINARIO": (128, 0, 128), # Roxo
        "ESPACO_CONFINADO": (0, 0, 139),  # Azul escuro
        "ELETRICO": (255, 255, 0),   # Amarelo
        "GENERAL": (128, 128, 128),  # Cinza
    }
    
    # Cores por severidade
    SEVERITY_COLORS = {
        "CRITICAL": (220, 20, 60),   # Crimson
        "HIGH": (255, 0, 0),         # Vermelho
        "MEDIUM": (255, 165, 0),     # Laranja
        "LOW": (255, 255, 0),        # Amarelo
    }
    
    def __init__(self, line_width: int = 3, font_size: int = 14):
        self.line_width = line_width
        self.font_size = font_size
        self._font = None
        
    def _get_font(self) -> ImageFont.FreeTypeFont:
        """Obtém fonte para desenho de texto."""
        if self._font is None:
            # Tentar carregar fonte do sistema
            font_paths = [
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
                "/System/Library/Fonts/Helvetica.ttc",  # macOS
                "C:/Windows/Fonts/arial.ttf",  # Windows
            ]
            
            for path in font_paths:
                if os.path.exists(path):
                    try:
                        self._font = ImageFont.truetype(path, self.font_size)
                        break
                    except Exception:
                        continue
            
            if self._font is None:
                # Fallback para fonte padrão
                self._font = ImageFont.load_default()
                
        return self._font
    
    def _get_color_for_finding(self, finding: Dict[str, Any]) -> Tuple[int, int, int]:
        """Determina a cor baseada na categoria ou severidade do finding."""
        category = finding.get("category", "GENERAL")
        severity = finding.get("severity", "MEDIUM")
        
        # Priorizar severidade para cores mais críticas
        if severity in self.SEVERITY_COLORS:
            return self.SEVERITY_COLORS[severity]
        
        return self.CATEGORY_COLORS.get(category, self.CATEGORY_COLORS["GENERAL"])
    
    def draw_bounding_boxes(
        self,
        image_path: str,
        findings: List[Dict[str, Any]],
        output_path: Optional[str] = None,
    ) -> str:
        """
        Desenha bounding boxes em uma imagem baseada nos findings.
        
        Args:
            image_path: Caminho da imagem original
            findings: Lista de findings com bounding_box
            output_path: Caminho para salvar (opcional, gera automático se não informado)
            
        Returns:
            Caminho da imagem processada
        """
        try:
            # Abrir imagem
            with Image.open(image_path) as img:
                # Converter para RGB se necessário
                if img.mode != "RGB":
                    img = img.convert("RGB")
                
                draw = ImageDraw.Draw(img)
                width, height = img.size
                font = self._get_font()
                
                # Desenhar cada bounding box
                for i, finding in enumerate(findings):
                    bbox = finding.get("bounding_box")
                    if not bbox or len(bbox) != 4:
                        continue

                    try:
                        x1_raw, y1_raw, x2_raw, y2_raw = [float(coord) for coord in bbox]
                    except (TypeError, ValueError):
                        continue

                    # Aceita bbox normalizado (0-1) e também bbox em pixel.
                    if max(x1_raw, y1_raw, x2_raw, y2_raw) <= 1.0:
                        x1 = int(x1_raw * width)
                        y1 = int(y1_raw * height)
                        x2 = int(x2_raw * width)
                        y2 = int(y2_raw * height)
                    else:
                        x1 = int(x1_raw)
                        y1 = int(y1_raw)
                        x2 = int(x2_raw)
                        y2 = int(y2_raw)
                    
                    # Garantir coordenadas válidas
                    x1, x2 = min(x1, x2), max(x1, x2)
                    y1, y2 = min(y1, y2), max(y1, y2)
                    x1 = max(0, min(width, x1))
                    x2 = max(0, min(width, x2))
                    y1 = max(0, min(height, y1))
                    y2 = max(0, min(height, y2))
                    
                    # Obter cor
                    color = self._get_color_for_finding(finding)
                    
                    # Desenhar retângulo
                    draw.rectangle([x1, y1, x2, y2], outline=color, width=self.line_width)
                    
                    # Preparar label
                    description = finding.get("description", "Risco detectado")
                    confidence = finding.get("confidence", 0.0)
                    label = f"{i+1}. {description[:30]}{'...' if len(description) > 30 else ''} ({confidence:.0%})"
                    
                    # Calcular tamanho do texto
                    bbox_text = draw.textbbox((0, 0), label, font=font)
                    text_width = bbox_text[2] - bbox_text[0]
                    text_height = bbox_text[3] - bbox_text[1]
                    
                    # Desenhar fundo do texto
                    text_y = y1 - text_height - 4 if y1 > text_height + 4 else y2 + 4
                    draw.rectangle(
                        [x1, text_y, x1 + text_width + 4, text_y + text_height + 4],
                        fill=color,
                    )
                    
                    # Desenhar texto
                    draw.text((x1 + 2, text_y), label, fill=(255, 255, 255), font=font)
                
                # Legenda no topo
                if findings:
                    legend_text = f"Detecções: {len(findings)} | WorkSafety + Olímpia"
                    bbox_legend = draw.textbbox((0, 0), legend_text, font=font)
                    legend_width = bbox_legend[2] - bbox_legend[0]
                    legend_height = bbox_legend[3] - bbox_legend[1]
                    
                    draw.rectangle(
                        [10, 10, 10 + legend_width + 10, 10 + legend_height + 6],
                        fill=(0, 0, 0, 180),
                    )
                    draw.text((15, 13), legend_text, fill=(255, 255, 255), font=font)
                
                # Salvar imagem
                if output_path is None:
                    # Gerar nome automático
                    base, ext = os.path.splitext(image_path)
                    output_path = f"{base}_analyzed{ext}"
                
                # Criar diretório se não existir
                os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
                
                img.save(output_path, quality=95)
                logger.info(f"Imagem processada salva em: {output_path}")
                
                return output_path
                
        except Exception as e:
            logger.exception(f"Erro ao processar imagem {image_path}: {e}")
            raise
    
    def create_compliance_report_image(
        self,
        findings: List[Dict[str, Any]],
        output_path: str,
        width: int = 1200,
        height: int = 800,
    ) -> str:
        """
        Cria uma imagem de relatório de compliance.
        
        Args:
            findings: Lista de findings
            output_path: Caminho para salvar
            width: Largura da imagem
            height: Altura da imagem
            
        Returns:
            Caminho da imagem gerada
        """
        # Criar imagem base
        img = Image.new("RGB", (width, height), color=(245, 245, 245))
        draw = ImageDraw.Draw(img)
        font = self._get_font()
        font_large = ImageFont.truetype(font.path, 24) if hasattr(font, 'path') else font
        
        # Título
        title = "Relatório de Compliance - Análise de Segurança"
        draw.text((width // 2 - 300, 30), title, fill=(0, 0, 0), font=font_large)
        
        # Resumo
        y_offset = 100
        total = len(findings)
        critical = sum(1 for f in findings if f.get("severity") == "CRITICAL")
        high = sum(1 for f in findings if f.get("severity") == "HIGH")
        medium = sum(1 for f in findings if f.get("severity") == "MEDIUM")
        low = sum(1 for f in findings if f.get("severity") == "LOW")
        
        summary = [
            f"Total de violações detectadas: {total}",
            f"Críticas: {critical} | Altas: {high} | Médias: {medium} | Baixas: {low}",
            "",
            "Detalhes:",
        ]
        
        for line in summary:
            draw.text((50, y_offset), line, fill=(0, 0, 0), font=font)
            y_offset += 30
        
        # Listar findings
        for i, finding in enumerate(findings[:20]):  # Limitar a 20
            severity = finding.get("severity", "MEDIUM")
            color = self.SEVERITY_COLORS.get(severity, (128, 128, 128))
            
            # Indicador de cor
            draw.rectangle([50, y_offset, 70, y_offset + 20], fill=color)
            
            # Texto
            text = f"{i+1}. [{severity}] {finding.get('description', 'N/A')[:80]}"
            draw.text((80, y_offset), text, fill=(0, 0, 0), font=font)
            y_offset += 35
        
        if len(findings) > 20:
            draw.text((80, y_offset), f"... e mais {len(findings) - 20} violações", fill=(100, 100, 100), font=font)
        
        # Salvar
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        img.save(output_path)
        
        return output_path


def calculate_compliance_score(findings: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calcula score de compliance baseado nos findings.
    
    Args:
        findings: Lista de findings detectados
        
    Returns:
        Dict com score e métricas
    """
    if not findings:
        return {
            "score": 100,
            "status": "EXCELLENT",
            "total_violations": 0,
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
        }
    
    # Pesos por severidade
    weights = {
        "CRITICAL": 25,
        "HIGH": 10,
        "MEDIUM": 5,
        "LOW": 2,
    }
    
    # Contar por severidade
    counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for finding in findings:
        severity = finding.get("severity", "MEDIUM")
        counts[severity] = counts.get(severity, 0) + 1
    
    # Calcular penalidade
    penalty = sum(counts[sev] * weight for sev, weight in weights.items())
    
    # Score base (100) menos penalidade
    score = max(0, 100 - penalty)
    
    # Status baseado no score
    if score >= 90:
        status = "EXCELLENT"
    elif score >= 75:
        status = "GOOD"
    elif score >= 60:
        status = "FAIR"
    elif score >= 40:
        status = "POOR"
    else:
        status = "CRITICAL"
    
    return {
        "score": score,
        "status": status,
        "total_violations": len(findings),
        "critical": counts["CRITICAL"],
        "high": counts["HIGH"],
        "medium": counts["MEDIUM"],
        "low": counts["LOW"],
    }


def process_evidence_with_olimpia(
    evidence,
    violations: List[Any],
    save_processed_image: bool = True,
) -> Optional[str]:
    """
    Processa uma evidência desenhando bounding boxes das violações.
    
    Args:
        evidence: Instância de Evidence
        violations: Lista de SafetyViolation do OlimpiaAIClient
        save_processed_image: Se True, salva imagem processada
        
    Returns:
        URL da imagem processada ou None
    """
    if not save_processed_image or not violations:
        return None
    
    try:
        processor = SafetyImageProcessor()
        
        # Converter violations para findings format
        findings = []
        for v in violations:
            findings.append({
                "description": v.description,
                "severity": v.severity,
                "confidence": v.confidence,
                "category": v.category,
                "bounding_box": v.bounding_box.to_list(),
            })
        
        # Caminho da imagem original
        original_path = evidence.file.path
        
        # Gerar caminho de saída
        base, ext = os.path.splitext(original_path)
        output_path = f"{base}_analyzed{ext}"
        
        # Processar
        processor.draw_bounding_boxes(original_path, findings, output_path)
        
        # Retornar URL relativa
        relative_path = output_path.replace(settings.MEDIA_ROOT, "").lstrip("/\\")
        return f"{settings.MEDIA_URL}{relative_path}"
        
    except Exception as e:
        logger.exception(f"Erro ao processar evidência {evidence.id}: {e}")
        return None
