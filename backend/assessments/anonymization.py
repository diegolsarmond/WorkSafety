"""
Serviço de anonimização de evidências para conformidade LGPD/GDPR.

Este módulo fornece funcionalidades para detectar e anonimizar dados pessoais
em imagens de evidências, incluindo:
- Detecção e anonimização de rostos
- Detecção e anonimização de placas de veículos (TODO)

A anonimização é aplicada antes do armazenamento permanente das evidências
garantindo que dados pessoais não sejam persistidos em sua forma identificável.
"""

import logging
import time
from io import BytesIO
from pathlib import Path
from typing import Optional
from dataclasses import dataclass

from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone

logger = logging.getLogger(__name__)


def _import_cv2():
    """Importa OpenCV com tratamento de erro."""
    try:
        import cv2
        import numpy as np
        return cv2, np
    except ImportError:
        logger.error("OpenCV (cv2) não está instalado. Instale com: pip install opencv-python")
        raise ImportError("OpenCV é necessário para anonimização de imagens")


@dataclass
class AnonymizationResult:
    """Resultado do processo de anonimização."""
    success: bool
    faces_detected: int = 0
    faces_anonymized: int = 0
    plates_detected: int = 0
    plates_anonymized: int = 0
    error_message: str = ""
    processing_duration_ms: int = 0


class AnonymizationService:
    """
    Serviço para anonimização de dados pessoais em imagens.
    
    Implementa detecção e anonimização de:
    - Rostos (via OpenCV Haar Cascade)
    - Placas de veículos (TODO - requer modelo customizado ou OCR)
    
    Configurações via settings:
    - ANONYMIZATION_ENABLED: Habilita/desabilita anonimização (default: True)
    - ANONYMIZATION_BLOCK_PLATES: Bloqueia upload se placas não forem anonimizadas (default: False)
    - ANONYMIZATION_METHOD: Método de anonimização ('blur', 'pixelate', 'blackout') (default: 'blur')
    - ANONYMIZATION_BLUR_KERNEL: Tamanho do kernel de blur (default: 51)
    """

    # Métodos de anonimização disponíveis
    METHOD_BLUR = "blur"
    METHOD_PIXELATE = "pixelate"
    METHOD_BLACKOUT = "blackout"

    def __init__(self):
        self.enabled = getattr(settings, "ANONYMIZATION_ENABLED", True)
        self.block_plates = getattr(settings, "ANONYMIZATION_BLOCK_PLATES", False)
        self.method = getattr(settings, "ANONYMIZATION_METHOD", self.METHOD_BLUR)
        self.blur_kernel = getattr(settings, "ANONYMIZATION_BLUR_KERNEL", 51)
        self._cv2 = None
        self._np = None
        self._face_cascade = None
        self._plate_cascade = None

    def _load_opencv(self):
        """Carrega OpenCV e classificadores sob demanda."""
        if self._cv2 is None:
            self._cv2, self._np = _import_cv2()
            self._load_classifiers()

    def _load_classifiers(self):
        """Carrega classificadores Haar Cascade para detecção."""
        cv2 = self._cv2
        
        # Classificador de rostos (incluído no OpenCV)
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        self._face_cascade = cv2.CascadeClassifier(cascade_path)
        
        if self._face_cascade.empty():
            logger.warning("Não foi possível carregar classificador de rostos")
        
        # TODO: Placas de veículos requerem modelo customizado ou treinamento
        # Por padrão, não carregamos classificador de placas (feature não implementada)
        self._plate_cascade = None

    def anonymize_evidence(self, evidence, user=None) -> AnonymizationResult:
        """
        Anonimiza uma evidência, aplicando processamento de imagem.
        
        Args:
            evidence: Instância de Evidence a ser anonimizada
            user: Usuário que solicitou a anonimização (para auditoria)
        
        Returns:
            AnonymizationResult com estatísticas do processamento
        """
        from .models import EvidenceAnonymizationLog

        start_time = time.time()
        
        if not self.enabled:
            logger.info(f"Anonimização desabilitada. Pulando evidência {evidence.pk}")
            return AnonymizationResult(
                success=True,
                error_message="Anonimização desabilitada via configuração"
            )

        if not evidence.file:
            return AnonymizationResult(
                success=False,
                error_message="Evidência não possui arquivo"
            )

        # Verificar se é imagem
        mime_type = evidence.mime_type or ""
        if not mime_type.startswith("image/"):
            logger.info(f"Arquivo não é imagem ({mime_type}). Pulando anonimização.")
            evidence.anonymization_status = "skipped"
            evidence.save(update_fields=["anonymization_status"])
            return AnonymizationResult(
                success=True,
                error_message=f"Tipo de arquivo não suportado: {mime_type}"
            )

        try:
            self._load_opencv()
            
            # Ler imagem do arquivo
            evidence.file.seek(0)
            image_data = evidence.file.read()
            
            # Guardar hash do original para auditoria
            import hashlib
            evidence.original_file_hash = hashlib.sha256(image_data).hexdigest()
            
            # Converter para array numpy
            nparr = self._np.frombuffer(image_data, self._np.uint8)
            image = self._cv2.imdecode(nparr, self._cv2.IMREAD_COLOR)
            
            if image is None:
                raise ValueError("Não foi possível decodificar a imagem")

            # Executar anonimização
            result = self._anonymize_image(image)
            
            # Salvar imagem anonimizada
            if result.success and (result.faces_anonymized > 0 or result.plates_anonymized > 0):
                # Codificar imagem processada
                success, encoded = self._cv2.imencode(
                    self._get_encoding_format(evidence.file.name),
                    image
                )
                if not success:
                    raise ValueError("Falha ao codificar imagem anonimizada")
                
                # Atualizar arquivo da evidência
                new_file = ContentFile(encoded.tobytes())
                new_file_name = evidence.file.name
                
                # Salvar novo arquivo
                evidence.file.save(new_file_name, new_file, save=False)
                
                # Atualizar metadados
                evidence.file.seek(0)
                new_content = evidence.file.read()
                evidence.file_hash = hashlib.sha256(new_content).hexdigest()
                evidence.file_size = len(new_content)
                
                # Marcar como anonimizada
                evidence.is_anonymized = True
                evidence.anonymized_at = timezone.now()
                evidence.anonymization_status = "completed"
                evidence.save()
                
                logger.info(
                    f"Evidência {evidence.pk} anonimizada: "
                    f"{result.faces_anonymized} rostos, "
                    f"{result.plates_anonymized} placas"
                )
            else:
                # Nenhum dado pessoal detectado
                evidence.anonymization_status = "completed"
                evidence.is_anonymized = True
                evidence.anonymized_at = timezone.now()
                evidence.save()
                
                logger.info(f"Evidência {evidence.pk}: nenhum dado pessoal detectado")

            # Calcular duração
            duration_ms = int((time.time() - start_time) * 1000)
            result.processing_duration_ms = duration_ms

            # Criar log de auditoria
            EvidenceAnonymizationLog.objects.create(
                evidence=evidence,
                operation=EvidenceAnonymizationLog.OPERATION_ANONYMIZE,
                status=EvidenceAnonymizationLog.STATUS_SUCCESS if result.success else EvidenceAnonymizationLog.STATUS_FAILED,
                faces_detected=result.faces_detected,
                faces_anonymized=result.faces_anonymized,
                plates_detected=result.plates_detected,
                plates_anonymized=result.plates_anonymized,
                error_message=result.error_message,
                processing_duration_ms=duration_ms,
                created_by=user,
            )

            return result

        except Exception as e:
            logger.exception(f"Erro ao anonimizar evidência {evidence.pk}: {e}")
            
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Marcar como falha
            evidence.anonymization_status = "failed"
            evidence.save(update_fields=["anonymization_status"])
            
            # Criar log de erro
            EvidenceAnonymizationLog.objects.create(
                evidence=evidence,
                operation=EvidenceAnonymizationLog.OPERATION_ANONYMIZE,
                status=EvidenceAnonymizationLog.STATUS_FAILED,
                error_message=str(e),
                processing_duration_ms=duration_ms,
                created_by=user,
            )
            
            return AnonymizationResult(
                success=False,
                error_message=str(e),
                processing_duration_ms=duration_ms
            )

    def _anonymize_image(self, image) -> AnonymizationResult:
        """
        Processa a imagem aplicando anonimização em rostos e placas.
        
        Args:
            image: Imagem OpenCV (numpy array)
        
        Returns:
            AnonymizationResult com estatísticas
        """
        result = AnonymizationResult(success=True)
        
        # Anonimizar rostos
        faces_result = self._anonymize_faces(image)
        result.faces_detected = faces_result["detected"]
        result.faces_anonymized = faces_result["anonymized"]
        
        # Anonimizar placas (TODO - atualmente retorna 0)
        plates_result = self._anonymize_plates(image)
        result.plates_detected = plates_result["detected"]
        result.plates_anonymized = plates_result["anonymized"]
        
        # Se placas foram detectadas mas não anonimizadas e bloqueio está ativo
        if (result.plates_detected > result.plates_anonymized and 
            self.block_plates):
            result.success = False
            result.error_message = (
                f"Detecção de placas não implementada. "
                f"{result.plates_detected} placas detectadas mas não anonimizadas. "
                f"Configure ANONYMIZATION_BLOCK_PLATES=False para permitir."
            )
        
        return result

    def _anonymize_faces(self, image) -> dict:
        """
        Detecta e anonimiza rostos na imagem.
        
        Args:
            image: Imagem OpenCV
        
        Returns:
            Dict com 'detected' e 'anonymized'
        """
        if self._face_cascade is None or self._face_cascade.empty():
            logger.warning("Classificador de rostos não disponível")
            return {"detected": 0, "anonymized": 0}
        
        # Converter para escala de cinza para detecção
        gray = self._cv2.cvtColor(image, self._cv2.COLOR_BGR2GRAY)
        
        # Detectar rostos
        faces = self._face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30)
        )
        
        detected = len(faces)
        anonymized = 0
        
        for (x, y, w, h) in faces:
            # Extrair região do rosto
            face_roi = image[y:y+h, x:x+w]
            
            # Aplicar método de anonimização
            if self.method == self.METHOD_BLUR:
                anonymized_roi = self._apply_blur(face_roi)
            elif self.method == self.METHOD_PIXELATE:
                anonymized_roi = self._apply_pixelate(face_roi)
            elif self.method == self.METHOD_BLACKOUT:
                anonymized_roi = self._apply_blackout(face_roi)
            else:
                anonymized_roi = self._apply_blur(face_roi)
            
            # Substituir região na imagem original
            image[y:y+h, x:x+w] = anonymized_roi
            anonymized += 1
        
        return {"detected": detected, "anonymized": anonymized}

    def _anonymize_plates(self, image) -> dict:
        """
        Detecta e anonimiza placas de veículos.
        
        TODO: Implementar detecção de placas.
        
        Opções para implementação futura:
        1. Treinar modelo Haar Cascade customizado para placas brasileiras
        2. Usar OCR (Tesseract/EasyOCR) + heurísticas de formato
        3. Usar modelo de deep learning (YOLO, SSD) treinado para placas
        4. API externa de reconhecimento de placas
        
        Por enquanto, esta função sempre retorna 0 detectados.
        
        Args:
            image: Imagem OpenCV
        
        Returns:
            Dict com 'detected' e 'anonymized'
        """
        # TODO: Implementar detecção de placas
        # Por enquanto, não detectamos nem anonimizamos placas
        # Isso é documentado e rastreável nos logs
        
        logger.debug("Detecção de placas não implementada - ignorando")
        return {"detected": 0, "anonymized": 0}

    def _apply_blur(self, roi):
        """Aplica desfoque gaussiano na região."""
        kernel = self.blur_kernel
        # Garantir kernel ímpar
        if kernel % 2 == 0:
            kernel += 1
        return self._cv2.GaussianBlur(roi, (kernel, kernel), 0)

    def _apply_pixelate(self, roi):
        """Aplica pixelização na região."""
        h, w = roi.shape[:2]
        # Reduzir para tamanho pequeno
        small = self._cv2.resize(roi, (16, 16), interpolation=self._cv2.INTER_LINEAR)
        # Expandir de volta
        return self._cv2.resize(small, (w, h), interpolation=self._cv2.INTER_NEAREST)

    def _apply_blackout(self, roi):
        """Aplica máscara preta na região."""
        return self._np.zeros_like(roi)

    def _get_encoding_format(self, filename: str) -> str:
        """Determina o formato de encoding baseado na extensão."""
        ext = Path(filename).suffix.lower()
        format_map = {
            ".jpg": ".jpg",
            ".jpeg": ".jpg",
            ".png": ".png",
            ".bmp": ".bmp",
            ".webp": ".webp",
        }
        return format_map.get(ext, ".jpg")


# Instância singleton do serviço
_anonymization_service = None


def get_anonymization_service() -> AnonymizationService:
    """Retorna instância singleton do serviço de anonimização."""
    global _anonymization_service
    if _anonymization_service is None:
        _anonymization_service = AnonymizationService()
    return _anonymization_service


def anonymize_evidence(evidence, user=None) -> AnonymizationResult:
    """
    Função utilitária para anonimizar uma evidência.
    
    Args:
        evidence: Instância de Evidence
        user: Usuário que solicitou (opcional)
    
    Returns:
        AnonymizationResult
    """
    service = get_anonymization_service()
    return service.anonymize_evidence(evidence, user)
