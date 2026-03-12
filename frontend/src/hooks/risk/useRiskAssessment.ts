/**
 * Hook para gerenciamento do estado da tela de riscos
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  RiskAssessmentDetail,
  RiskItem,
  RiskFilters,
  RiskSortOption,
  RiskScreenState,
} from '@/types/risk';
import {
  getAssessmentById,
  humanValidateAssessment,
  RiskServiceError,
  countRisksBySeverity,
} from '@/services/risk/riskService';

interface UseRiskAssessmentOptions {
  autoFetch?: boolean;
  refreshInterval?: number;
}

interface UseRiskAssessmentReturn {
  // Estado da tela
  screenState: RiskScreenState;
  
  // Dados
  assessment: RiskAssessmentDetail | null;
  filteredRisks: RiskItem[];
  riskCounts: Record<string, number>;
  
  // Filtros e ordenação
  filters: RiskFilters;
  sortOption: RiskSortOption;
  setFilters: (filters: RiskFilters) => void;
  setSortOption: (option: RiskSortOption) => void;
  
  // Ações
  fetchAssessment: () => Promise<void>;
  refresh: () => Promise<void>;
  validateAssessment: (reason?: string) => Promise<void>;
  
  // Estados de ação
  isValidating: boolean;
  validationError: string | null;
}

/**
 * Hook para gerenciar o estado da avaliação de riscos
 * @param assessmentId - ID da avaliação
 * @param options - Opções de configuração
 */
export function useRiskAssessment(
  assessmentId: string | number | null,
  options: UseRiskAssessmentOptions = {}
): UseRiskAssessmentReturn {
  const { autoFetch = true, refreshInterval } = options;
  
  // Estado principal
  const [screenState, setScreenState] = useState<RiskScreenState>({
    type: 'loading',
    message: 'Loading assessment...',
  });
  
  // Filtros e ordenação
  const [filters, setFilters] = useState<RiskFilters>({});
  const [sortOption, setSortOption] = useState<RiskSortOption>('severity_desc');
  
  // Estado de ações
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Fetch da avaliação
  const fetchAssessment = useCallback(async () => {
    if (!assessmentId) {
      setScreenState({
        type: 'error',
        message: 'No assessment ID provided',
        canRetry: false,
      });
      return;
    }
    
    setScreenState({
      type: 'loading',
      message: 'Loading assessment...',
    });
    
    try {
      const data = await getAssessmentById(assessmentId);
      
      if (data.risks.length === 0) {
        setScreenState({
          type: 'empty',
          message: 'No risks detected for this assessment',
        });
      } else {
        setScreenState({
          type: 'data',
          assessment: data,
        });
      }
    } catch (error) {
      if (error instanceof RiskServiceError) {
        setScreenState({
          type: 'error',
          message: error.message,
          canRetry: error.code !== 'NOT_FOUND' && error.code !== 'FORBIDDEN',
        });
      } else {
        setScreenState({
          type: 'error',
          message: 'An unexpected error occurred',
          canRetry: true,
        });
      }
    }
  }, [assessmentId]);
  
  // Refresh (reutiliza fetch)
  const refresh = useCallback(async () => {
    await fetchAssessment();
  }, [fetchAssessment]);
  
  // Validar avaliação
  const validateAssessment = useCallback(async (reason?: string) => {
    if (!assessmentId) return;
    
    setIsValidating(true);
    setValidationError(null);
    
    try {
      await humanValidateAssessment(assessmentId, reason);
      // Atualiza os dados após validação
      await fetchAssessment();
    } catch (error) {
      if (error instanceof RiskServiceError) {
        setValidationError(error.message);
      } else {
        setValidationError('Failed to validate assessment');
      }
    } finally {
      setIsValidating(false);
    }
  }, [assessmentId, fetchAssessment]);
  
  // Fetch inicial
  useEffect(() => {
    if (autoFetch && assessmentId) {
      fetchAssessment();
    }
  }, [autoFetch, assessmentId, fetchAssessment]);
  
  // Refresh automático em intervalos (para atualizações da IA)
  useEffect(() => {
    if (!refreshInterval || !assessmentId) return;
    
    const interval = setInterval(() => {
      // Só faz refresh se estiver em estado de dados (não durante loading/error)
      if (screenState.type === 'data') {
        refresh();
      }
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [refreshInterval, assessmentId, refresh, screenState.type]);
  
  // Computar dados derivados
  const assessment = useMemo(() => {
    return screenState.type === 'data' ? screenState.assessment : null;
  }, [screenState]);
  
  const riskCounts = useMemo(() => {
    return assessment ? countRisksBySeverity(assessment) : {};
  }, [assessment]);
  
  const filteredRisks = useMemo(() => {
    if (!assessment) return [];
    
    let risks = [...assessment.risks];
    
    // Aplicar filtros
    if (filters.severity && filters.severity.length > 0) {
      risks = risks.filter((r) => filters.severity?.includes(r.severity));
    }
    
    if (filters.status && filters.status.length > 0) {
      risks = risks.filter((r) => filters.status?.includes(r.risk_status as 'pending' | 'ai_detected' | 'validated' | 'rejected'));
    }
    
    if (filters.search) {
      const search = filters.search.toLowerCase();
      risks = risks.filter(
        (r) =>
          r.description.toLowerCase().includes(search) ||
          r.location.toLowerCase().includes(search)
      );
    }
    
    // Aplicar ordenação
    risks.sort((a, b) => {
      switch (sortOption) {
        case 'severity_desc':
          const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
          return severityOrder[a.severity] - severityOrder[b.severity];
        case 'severity_asc':
          const severityOrderAsc = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
          return severityOrderAsc[a.severity] - severityOrderAsc[b.severity];
        case 'date_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'date_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default:
          return 0;
      }
    });
    
    return risks;
  }, [assessment, filters, sortOption]);
  
  return {
    screenState,
    assessment,
    filteredRisks,
    riskCounts,
    filters,
    sortOption,
    setFilters,
    setSortOption,
    fetchAssessment,
    refresh,
    validateAssessment,
    isValidating,
    validationError,
  };
}
