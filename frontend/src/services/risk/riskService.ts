/**
 * Serviço para gerenciamento de riscos e avaliações
 */

import { apiClient } from '@/services/api/apiClient';
import type {
  RiskAssessmentDetail,
  RiskAssessmentSummary,
  AssessmentStatus,
} from '@/types/risk';

const API_PREFIX = 'assessments';

/** Resultado de status de IA */
export interface AIStatusResult {
  status: string;
  message?: string;
  confidence?: string;
  error_message?: string;
}

/** Erro específico do serviço de riscos */
export class RiskServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'RiskServiceError';
  }
}

/**
 * Busca detalhes completos de uma avaliação incluindo riscos e evidências
 * @param assessmentId - ID da avaliação
 * @returns Detalhes da avaliação
 */
export async function getAssessmentById(
  assessmentId: string | number
): Promise<RiskAssessmentDetail> {
  try {
    const response = await apiClient.get<RiskAssessmentDetail>(
      `${API_PREFIX}/${assessmentId}/`
    );
    return response.data;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number; data?: { error?: string } } };
      const statusCode = axiosError.response?.status;
      const message = axiosError.response?.data?.error || 'Failed to fetch assessment';
      
      if (statusCode === 404) {
        throw new RiskServiceError('Assessment not found', 'NOT_FOUND', 404);
      }
      if (statusCode === 403) {
        throw new RiskServiceError('Access denied', 'FORBIDDEN', 403);
      }
      throw new RiskServiceError(message, 'FETCH_ERROR', statusCode);
    }
    throw new RiskServiceError('Network error', 'NETWORK_ERROR');
  }
}

/**
 * Lista todas as avaliações do usuário
 * @returns Lista de avaliações resumidas
 */
export async function listAssessments(): Promise<RiskAssessmentSummary[]> {
  try {
    const response = await apiClient.get<RiskAssessmentSummary[]>(API_PREFIX);
    return response.data;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number; data?: { error?: string } } };
      const message = axiosError.response?.data?.error || 'Failed to list assessments';
      throw new RiskServiceError(message, 'LIST_ERROR', axiosError.response?.status);
    }
    throw new RiskServiceError('Network error', 'NETWORK_ERROR');
  }
}

/**
 * Transiciona o status da avaliação para CAPTURED
 * @param assessmentId - ID da avaliação
 * @param reason - Motivo opcional da transição
 */
export async function captureAssessment(
  assessmentId: string | number,
  reason?: string
): Promise<{ status: AssessmentStatus; previous_status: string; message: string }> {
  try {
    const response = await apiClient.post(`${API_PREFIX}/${assessmentId}/capture/`, {
      reason,
    });
    return response.data;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number; data?: { error?: string } } };
      const message = axiosError.response?.data?.error || 'Failed to capture assessment';
      throw new RiskServiceError(message, 'TRANSITION_ERROR', axiosError.response?.status);
    }
    throw new RiskServiceError('Network error', 'NETWORK_ERROR');
  }
}

/**
 * Transiciona o status da avaliação para SYNCED
 * @param assessmentId - ID da avaliação
 * @param reason - Motivo opcional da transição
 */
export async function syncAssessment(
  assessmentId: string | number,
  reason?: string
): Promise<{ status: AssessmentStatus; previous_status: string; message: string }> {
  try {
    const response = await apiClient.post(`${API_PREFIX}/${assessmentId}/sync/`, {
      reason,
    });
    return response.data;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number; data?: { error?: string } } };
      const message = axiosError.response?.data?.error || 'Failed to sync assessment';
      throw new RiskServiceError(message, 'TRANSITION_ERROR', axiosError.response?.status);
    }
    throw new RiskServiceError('Network error', 'NETWORK_ERROR');
  }
}

/**
 * Marca a avaliação como revisada por IA (AI_REVIEWED)
 * @param assessmentId - ID da avaliação
 * @param reason - Motivo opcional da transição
 */
export async function markAIReviewed(
  assessmentId: string | number,
  reason?: string
): Promise<{ status: AssessmentStatus; previous_status: string; message: string }> {
  try {
    const response = await apiClient.post(
      `${API_PREFIX}/${assessmentId}/mark-ai-reviewed/`,
      { reason }
    );
    return response.data;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number; data?: { error?: string } } };
      const message = axiosError.response?.data?.error || 'Failed to mark as AI reviewed';
      throw new RiskServiceError(message, 'TRANSITION_ERROR', axiosError.response?.status);
    }
    throw new RiskServiceError('Network error', 'NETWORK_ERROR');
  }
}

/**
 * Valida a avaliação por humano (HUMAN_VALIDATED)
 * @param assessmentId - ID da avaliação
 * @param reason - Motivo opcional da transição
 */
export async function humanValidateAssessment(
  assessmentId: string | number,
  reason?: string
): Promise<{ status: AssessmentStatus; previous_status: string; message: string }> {
  try {
    const response = await apiClient.post(
      `${API_PREFIX}/${assessmentId}/human-validated/`,
      { reason }
    );
    return response.data;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number; data?: { error?: string } } };
      const message = axiosError.response?.data?.error || 'Failed to validate assessment';
      throw new RiskServiceError(message, 'TRANSITION_ERROR', axiosError.response?.status);
    }
    throw new RiskServiceError('Network error', 'NETWORK_ERROR');
  }
}

/**
 * Reprocessa a avaliação com IA
 * @param assessmentId - ID da avaliação
 * @param reason - Motivo opcional do reprocessamento
 */
export async function reprocessAssessment(
  assessmentId: string | number,
  reason?: string
): Promise<{ status: AssessmentStatus; previous_status: string; message: string }> {
  try {
    const response = await apiClient.post(`${API_PREFIX}/${assessmentId}/reprocess-ai/`, {
      reason,
    });
    return response.data;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number; data?: { error?: string } } };

      // Compatibilidade com backends antigos que ainda expõem /reprocess/
      if (axiosError.response?.status === 404) {
        try {
          const legacyResponse = await apiClient.post(`${API_PREFIX}/${assessmentId}/reprocess/`, {
            reason,
          });
          return legacyResponse.data;
        } catch {
          // Continua para o tratamento de erro padrão abaixo
        }
      }
    }

    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number; data?: { error?: string } } };
      const message = axiosError.response?.data?.error || 'Failed to reprocess assessment';
      throw new RiskServiceError(message, 'TRANSITION_ERROR', axiosError.response?.status);
    }
    throw new RiskServiceError('Network error', 'NETWORK_ERROR');
  }
}

/**
 * Força novo processamento de IA da avaliação
 * @param assessmentId - ID da avaliação
 * @param reason - Motivo opcional do processamento
 */
export async function processAIAssessment(
  assessmentId: string | number,
  reason?: string
): Promise<{ message: string; task_id: string; status: string }> {
  try {
    const response = await apiClient.post(`${API_PREFIX}/${assessmentId}/process-ai/`, {
      reason,
    });
    return response.data;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number; data?: { error?: string } } };
      const message = axiosError.response?.data?.error || 'Failed to process AI assessment';
      throw new RiskServiceError(message, 'TRANSITION_ERROR', axiosError.response?.status);
    }
    throw new RiskServiceError('Network error', 'NETWORK_ERROR');
  }
}

/**
 * Consulta status do processamento de IA
 * @param assessmentId - ID da avaliação
 */
export async function getAIStatus(
  assessmentId: string | number
): Promise<AIStatusResult> {
  try {
    const response = await apiClient.get(`${API_PREFIX}/${assessmentId}/ai-status/`);
    return response.data;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number; data?: { error?: string } } };
      const message = axiosError.response?.data?.error || 'Failed to get AI status';
      throw new RiskServiceError(message, 'AI_STATUS_ERROR', axiosError.response?.status);
    }
    throw new RiskServiceError('Network error', 'NETWORK_ERROR');
  }
}

/**
 * Finaliza a avaliação (FINALIZED)
 * @param assessmentId - ID da avaliação
 * @param reason - Motivo opcional da transição
 */
export async function finalizeAssessment(
  assessmentId: string | number,
  reason?: string
): Promise<{ status: AssessmentStatus; previous_status: string; message: string }> {
  try {
    const response = await apiClient.post(`${API_PREFIX}/${assessmentId}/finalize/`, {
      reason,
    });
    return response.data;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number; data?: { error?: string } } };
      const message = axiosError.response?.data?.error || 'Failed to finalize assessment';
      throw new RiskServiceError(message, 'TRANSITION_ERROR', axiosError.response?.status);
    }
    throw new RiskServiceError('Network error', 'NETWORK_ERROR');
  }
}

/**
 * Busca histórico de status da avaliação
 * @param assessmentId - ID da avaliação
 */
export async function getAssessmentStatusHistory(
  assessmentId: string | number
): Promise<Record<string, unknown>> {
  try {
    const response = await apiClient.get(`${API_PREFIX}/${assessmentId}/status-history/`);
    return response.data;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number; data?: { error?: string } } };
      const message = axiosError.response?.data?.error || 'Failed to fetch status history';
      throw new RiskServiceError(message, 'HISTORY_ERROR', axiosError.response?.status);
    }
    throw new RiskServiceError('Network error', 'NETWORK_ERROR');
  }
}

/**
 * Busca transições válidas do status atual
 * @param assessmentId - ID da avaliação
 */
export async function getValidTransitions(
  assessmentId: string | number
): Promise<{ current_status: { value: string; label: string }; valid_transitions: { value: string; label: string }[] }> {
  try {
    const response = await apiClient.get(`${API_PREFIX}/${assessmentId}/valid-transitions/`);
    return response.data;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number; data?: { error?: string } } };
      const message = axiosError.response?.data?.error || 'Failed to fetch valid transitions';
      throw new RiskServiceError(message, 'TRANSITIONS_ERROR', axiosError.response?.status);
    }
    throw new RiskServiceError('Network error', 'NETWORK_ERROR');
  }
}

export interface RiskDecisionPayload {
  risk_id: string;
  decision: 'approved' | 'rejected' | 'pending';
  mitigations: string[];
  custom_action: string;
}

/**
 * Submete a revisão humana com decisões por risco e mitigações.
 * Salva no banco e transiciona o assessment para human_validated.
 */
export async function submitReview(
  assessmentId: string | number,
  decisions: RiskDecisionPayload[],
): Promise<{ status: string; previous_status: string; transitioned: boolean; decisions_saved: number }> {
  try {
    const response = await apiClient.post(`${API_PREFIX}/${assessmentId}/review/`, { decisions });
    return response.data;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number; data?: { error?: string } } };
      const message = axiosError.response?.data?.error || 'Failed to submit review';
      throw new RiskServiceError(message, 'REVIEW_ERROR', axiosError.response?.status);
    }
    throw new RiskServiceError('Network error', 'NETWORK_ERROR');
  }
}

/** Hook helper para verificar se o status permite validação */
export function canValidate(status: AssessmentStatus): boolean {
  return status === 'ai_reviewed';
}

/** Hook helper para verificar se a avaliação tem riscos detectados */
export function hasDetectedRisks(assessment: RiskAssessmentDetail): boolean {
  return assessment.risks.length > 0;
}

/** Hook helper para contar riscos por severidade */
export function countRisksBySeverity(
  assessment: RiskAssessmentDetail
): Record<string, number> {
  return assessment.risks.reduce((acc, risk) => {
    acc[risk.severity] = (acc[risk.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}
