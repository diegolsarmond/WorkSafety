export type SyncJobStatus = 
  | 'PENDING'      // Aguardando para ser processado
  | 'SYNCING'      // Em sincronização
  | 'COMPLETED'    // Sincronizado com sucesso
  | 'FAILED'       // Falhou mas ainda tem retries
  | 'ERROR';       // Falhou definitivamente (max retries atingido)

export interface PhotoData {
  id: string;
  dataUrl: string;
  timestamp: string;
}

export interface AssessmentDraft {
  id?: string;                    // ID atribuído pelo backend após criação
  title: string;
  description: string;
  environment: string;
  category: string;
  status: 'draft' | 'pending' | 'completed';
}

export interface SyncJob {
  id: string;                     // ID único local (UUID)
  assessmentDraft: AssessmentDraft;
  photos: PhotoData[];
  status: SyncJobStatus;
  retryCount: number;             // Número de tentativas realizadas (0-3)
  maxRetries: number;             // Máximo de retries (padrão: 3)
  nextRetryAt: number | null;     // Timestamp em ms para próxima tentativa
  lastError: string | null;       // Último erro ocorrido
  createdAt: number;              // Timestamp de criação
  updatedAt: number;              // Timestamp da última atualização
  completedAt: number | null;     // Timestamp de conclusão
  assessmentId?: string;          // ID do assessment criado no backend
}

export interface SyncQueueState {
  jobs: SyncJob[];
  isProcessing: boolean;
  lastSyncAttempt: number | null;
}

// Constantes de configuração
export const SYNC_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY_MS: 2000,           // 2 segundos
  MAX_DELAY_MS: 60000,           // 1 minuto
  BACKOFF_MULTIPLIER: 2,         // Fator de multiplicação exponencial
  JITTER_MAX_MS: 1000,           // Jitter máximo em ms
  SYNC_INTERVAL_MS: 30000,       // Intervalo de verificação: 30s
  VISIBILITY_SYNC_DELAY_MS: 1000, // Delay ao voltar para a página: 1s
} as const;
