/**
 * Tipos para a funcionalidade de detecção de riscos
 */

/** Referência a uma evidência (foto) */
export interface EvidenceRef {
  id: string;
  thumbnail_url: string;
  captured_at: string | null;
}

/** Recomendação de segurança para um risco */
export interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

/** Item de risco detectado */
export interface RiskItem {
  id: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  location: string;
  evidence: EvidenceRef | null;
  recommendations: Recommendation[];
  ai_confidence: string;
  risk_status: 'pending' | 'ai_detected' | 'validated' | 'rejected' | 'error';
  created_at: string;
  updated_at: string;
}

/** Decisão de validação humana */
export interface ValidationDecision {
  id: string;
  decision: 'pending' | 'approved' | 'rejected';
  comment: string;
  validator: string | null;
  created_at: string;
}

/** Resultado de inferência da IA */
export interface AIInference {
  id: string;
  raw_result: Record<string, unknown>;
  confidence: string;
  decisions: ValidationDecision[];
  created_at: string;
}

/** Evidência completa (foto) */
export interface Evidence {
  id: string;
  file: string;
  url: string;
  file_hash: string;
  file_size: number;
  mime_type: string;
  captured_at: string | null;
  created_at: string;
}

/** Transição válida de status */
export interface ValidTransition {
  value: string;
  label: string;
}

/** Status do ciclo de vida da avaliação */
export type AssessmentStatus =
  | 'draft'
  | 'captured'
  | 'synced'
  | 'ai_reviewed'
  | 'human_validated'
  | 'finalized'
  | 'error';

/** Resposta detalhada da avaliação com riscos */
export interface RiskAssessmentDetail {
  id: string;
  title: string;
  description: string;
  status: AssessmentStatus;
  status_display: string;
  created_by: string | null;
  created_by_email: string;
  risks: RiskItem[];
  evidences: Evidence[];
  inferences: AIInference[];
  compliance_score: number;
  valid_transitions: ValidTransition[];
  captured_at: string | null;
  synced_at: string | null;
  ai_reviewed_at: string | null;
  human_validated_at: string | null;
  finalized_at: string | null;
  status_changed_at: string | null;
  status_change_reason: string;
  created_at: string;
  updated_at: string;
}

/** Resumo da avaliação para listagem */
export interface RiskAssessmentSummary {
  id: string;
  title: string;
  description: string;
  status: AssessmentStatus;
  created_by_email: string;
  risk_count: number;
  captured_at: string | null;
  ai_reviewed_at: string | null;
  human_validated_at: string | null;
  created_at: string;
}

/** Estado do loading na tela de riscos */
export interface RiskLoadingState {
  type: 'loading';
  message: string;
}

/** Estado de erro na tela de riscos */
export interface RiskErrorState {
  type: 'error';
  message: string;
  canRetry: boolean;
}

/** Estado vazio na tela de riscos */
export interface RiskEmptyState {
  type: 'empty';
  message: string;
}

/** Estado com dados na tela de riscos */
export interface RiskDataState {
  type: 'data';
  assessment: RiskAssessmentDetail;
}

/** Estados possíveis da tela de riscos */
export type RiskScreenState = 
  | RiskLoadingState 
  | RiskErrorState 
  | RiskEmptyState 
  | RiskDataState;

/** Filtros para lista de riscos */
export interface RiskFilters {
  severity?: ('CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW')[];
  status?: ('pending' | 'ai_detected' | 'validated' | 'rejected')[];
  search?: string;
}

/** Opções de ordenação */
export type RiskSortOption = 
  | 'severity_desc' 
  | 'severity_asc' 
  | 'date_desc' 
  | 'date_asc';

/** Configuração de exibição */
export interface RiskDisplayConfig {
  showEvidenceThumbnails: boolean;
  showRecommendations: boolean;
  groupBySeverity: boolean;
}
