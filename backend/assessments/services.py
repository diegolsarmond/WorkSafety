"""
Camada de serviço para gerenciamento do ciclo de vida de RiskAssessment.
Implementa state machine para validação de transições de status.
"""
from typing import Optional
from django.utils import timezone
from django.db import transaction

from .models import RiskAssessment


class InvalidTransitionError(Exception):
    """Exceção lançada quando uma transição de status é inválida."""
    pass


class AssessmentLifecycleService:
    """
    Serviço para gerenciar o ciclo de vida de RiskAssessment.
    
    Ciclo de vida:
    DRAFT -> CAPTURED -> SYNCED -> AI_REVIEWED -> HUMAN_VALIDATED -> FINALIZED
    
    Estados de erro podem ser alcançados de qualquer estado (em caso de falha).
    """

    # Mapeamento de transições válidas: {from_state: [to_states]}
    VALID_TRANSITIONS = {
        RiskAssessment.STATUS_DRAFT: [
            RiskAssessment.STATUS_CAPTURED,
            RiskAssessment.STATUS_ERROR,
        ],
        RiskAssessment.STATUS_CAPTURED: [
            RiskAssessment.STATUS_SYNCED,
            RiskAssessment.STATUS_ERROR,
        ],
        RiskAssessment.STATUS_SYNCED: [
            RiskAssessment.STATUS_AI_REVIEWED,
            RiskAssessment.STATUS_ERROR,
        ],
        RiskAssessment.STATUS_AI_REVIEWED: [
            RiskAssessment.STATUS_HUMAN_VALIDATED,
            RiskAssessment.STATUS_ERROR,
        ],
        RiskAssessment.STATUS_HUMAN_VALIDATED: [
            RiskAssessment.STATUS_FINALIZED,
            RiskAssessment.STATUS_ERROR,
        ],
        RiskAssessment.STATUS_FINALIZED: [
            RiskAssessment.STATUS_ERROR,
        ],
        RiskAssessment.STATUS_ERROR: [
            RiskAssessment.STATUS_DRAFT,  # Permite retry
        ],
    }

    # Timestamp field correspondente a cada status
    STATUS_TIMESTAMP_FIELDS = {
        RiskAssessment.STATUS_CAPTURED: "captured_at",
        RiskAssessment.STATUS_SYNCED: "synced_at",
        RiskAssessment.STATUS_AI_REVIEWED: "ai_reviewed_at",
        RiskAssessment.STATUS_HUMAN_VALIDATED: "human_validated_at",
        RiskAssessment.STATUS_FINALIZED: "finalized_at",
    }

    @classmethod
    def get_valid_transitions(cls, current_status: str) -> list:
        """Retorna lista de transições válidas a partir de um status."""
        return cls.VALID_TRANSITIONS.get(current_status, [])

    @classmethod
    def can_transition(cls, from_state: str, to_state: str) -> bool:
        """Verifica se uma transição é válida."""
        if from_state == to_state:
            return True  # Permite "transição" para o mesmo estado (idempotência)
        valid_targets = cls.VALID_TRANSITIONS.get(from_state, [])
        return to_state in valid_targets

    @classmethod
    def validate_transition(cls, assessment: RiskAssessment, to_state: str) -> None:
        """
        Valida se uma transição é permitida.
        
        Raises:
            InvalidTransitionError: Se a transição não for válida.
        """
        from_state = assessment.status
        
        if from_state == to_state:
            return  # Idempotência - não precisa validar
            
        if not cls.can_transition(from_state, to_state):
            valid_transitions = cls.get_valid_transitions(from_state)
            valid_labels = [dict(RiskAssessment.STATUS_CHOICES).get(s, s) for s in valid_transitions]
            from_label = dict(RiskAssessment.STATUS_CHOICES).get(from_state, from_state)
            to_label = dict(RiskAssessment.STATUS_CHOICES).get(to_state, to_state)
            
            raise InvalidTransitionError(
                f"Transição inválida de '{from_label}' para '{to_label}'. "
                f"Transições válidas: {', '.join(valid_labels) if valid_labels else 'Nenhuma'}"
            )

    @classmethod
    @transaction.atomic
    def transition(
        cls,
        assessment: RiskAssessment,
        to_state: str,
        actor,
        reason: Optional[str] = None,
    ) -> RiskAssessment:
        """
        Executa uma transição de status.
        
        Args:
            assessment: Instância de RiskAssessment
            to_state: Estado de destino
            actor: Usuário que está executando a transição
            reason: Motivo opcional da transição
            
        Returns:
            RiskAssessment atualizado
            
        Raises:
            InvalidTransitionError: Se a transição não for válida
        """
        # Validar transição
        cls.validate_transition(assessment, to_state)
        
        # Se já está no estado desejado, apenas retorna (idempotência)
        if assessment.status == to_state:
            return assessment
        
        now = timezone.now()
        
        # Atualizar status
        assessment.status = to_state
        assessment.status_changed_at = now
        assessment.status_changed_by = actor
        if reason:
            assessment.status_change_reason = reason
        
        # Atualizar timestamp específico do estado se houver
        timestamp_field = cls.STATUS_TIMESTAMP_FIELDS.get(to_state)
        if timestamp_field:
            setattr(assessment, timestamp_field, now)
        
        assessment.save()
        return assessment

    @classmethod
    @transaction.atomic
    def capture(cls, assessment: RiskAssessment, actor, reason: Optional[str] = None) -> RiskAssessment:
        """Transiciona para CAPTURED."""
        return cls.transition(assessment, RiskAssessment.STATUS_CAPTURED, actor, reason)

    @classmethod
    @transaction.atomic
    def sync(cls, assessment: RiskAssessment, actor, reason: Optional[str] = None) -> RiskAssessment:
        """Transiciona para SYNCED."""
        return cls.transition(assessment, RiskAssessment.STATUS_SYNCED, actor, reason)

    @classmethod
    @transaction.atomic
    def mark_ai_reviewed(cls, assessment: RiskAssessment, actor, reason: Optional[str] = None) -> RiskAssessment:
        """Transiciona para AI_REVIEWED."""
        return cls.transition(assessment, RiskAssessment.STATUS_AI_REVIEWED, actor, reason)

    @classmethod
    @transaction.atomic
    def human_validate(cls, assessment: RiskAssessment, actor, reason: Optional[str] = None) -> RiskAssessment:
        """Transiciona para HUMAN_VALIDATED."""
        return cls.transition(assessment, RiskAssessment.STATUS_HUMAN_VALIDATED, actor, reason)

    @classmethod
    @transaction.atomic
    def finalize(cls, assessment: RiskAssessment, actor, reason: Optional[str] = None) -> RiskAssessment:
        """Transiciona para FINALIZED."""
        return cls.transition(assessment, RiskAssessment.STATUS_FINALIZED, actor, reason)

    @classmethod
    @transaction.atomic
    def mark_error(cls, assessment: RiskAssessment, actor, reason: Optional[str] = None) -> RiskAssessment:
        """Transiciona para ERROR (estado de erro)."""
        return cls.transition(assessment, RiskAssessment.STATUS_ERROR, actor, reason)

    @classmethod
    def get_status_history(cls, assessment: RiskAssessment) -> dict:
        """Retorna histórico de marcos do ciclo de vida."""
        return {
            "current_status": assessment.status,
            "current_status_display": assessment.get_status_display(),
            "milestones": {
                "created": assessment.created_at,
                "captured": assessment.captured_at,
                "synced": assessment.synced_at,
                "ai_reviewed": assessment.ai_reviewed_at,
                "human_validated": assessment.human_validated_at,
                "finalized": assessment.finalized_at,
            },
            "last_status_change": {
                "at": assessment.status_changed_at,
                "by": str(assessment.status_changed_by) if assessment.status_changed_by else None,
                "reason": assessment.status_change_reason,
            },
        }
