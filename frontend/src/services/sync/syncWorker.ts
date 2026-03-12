import { apiClient } from '@/services/api/apiClient';
import { SyncStorage } from './syncStorage';
import { 
  SyncJob, 
  SYNC_CONFIG, 
  SyncJobStatus,
  PhotoData 
} from '@/types/sync';
import { 
  calculateNextRetryAt, 
  dataURLtoFile,
  isOnline,
  isPageVisible 
} from '@/utils/syncUtils';

// Callbacks para notificar UI
interface SyncCallbacks {
  onJobStarted?: (jobId: string) => void;
  onJobCompleted?: (jobId: string) => void;
  onJobFailed?: (jobId: string, error: string) => void;
  onJobError?: (jobId: string, error: string) => void; // Max retries atingido
  onSyncStarted?: () => void;
  onSyncCompleted?: () => void;
}

/**
 * SyncWorker - Responsável por processar jobs de sincronização
 * 
 * Funciona como um serviço em background que:
 * - Monitora conectividade e visibilidade da página
 * - Processa jobs em fila com backoff exponencial
 * - Gerencia estado de cada job
 */
class SyncWorker {
  private callbacks: SyncCallbacks = {};
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;
  private abortController: AbortController | null = null;

  /**
   * Registra callbacks para notificações
   */
  on(callbacks: SyncCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Remove callbacks
   */
  off(): void {
    this.callbacks = {};
  }

  /**
   * Inicia o worker com verificação periódica
   */
  start(): void {
    if (this.intervalId) return; // Já está rodando

    console.log('[SyncWorker] Starting...');
    
    // Verifica imediatamente
    this.checkAndProcess();
    
    // Configura verificação periódica
    this.intervalId = setInterval(() => {
      this.checkAndProcess();
    }, SYNC_CONFIG.SYNC_INTERVAL_MS);

    // Listener para quando ficar online
    window.addEventListener('online', this.handleOnline);
    
    // Listener para quando a página ficar visível
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Para o worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    window.removeEventListener('online', this.handleOnline);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    // Cancela processamento atual
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    console.log('[SyncWorker] Stopped');
  }

  /**
   * Handler para evento online
   */
  private handleOnline = (): void => {
    console.log('[SyncWorker] Online event detected');
    // Pequeno delay para garantir que a conexão está estável
    setTimeout(() => this.checkAndProcess(), 1000);
  };

  /**
   * Handler para mudança de visibilidade
   */
  private handleVisibilityChange = (): void => {
    if (isPageVisible()) {
      console.log('[SyncWorker] Page became visible');
      // Delay maior ao voltar para a página para evitar processamento
      // durante transições rápidas
      setTimeout(() => this.checkAndProcess(), SYNC_CONFIG.VISIBILITY_SYNC_DELAY_MS);
    }
  };

  /**
   * Verifica e processa jobs pendentes
   */
  async checkAndProcess(): Promise<void> {
    // Não processa se já está processando ou não está online
    if (this.isProcessing) {
      console.log('[SyncWorker] Already processing, skipping...');
      return;
    }

    if (!isOnline()) {
      console.log('[SyncWorker] Offline, skipping...');
      return;
    }

    const readyJobs = await SyncStorage.getReadyJobs();
    
    if (readyJobs.length === 0) {
      return;
    }

    console.log(`[SyncWorker] Found ${readyJobs.length} jobs to process`);
    
    this.isProcessing = true;
    this.abortController = new AbortController();
    this.callbacks.onSyncStarted?.();

    try {
      for (const job of readyJobs) {
        // Verifica se foi abortado
        if (this.abortController?.signal.aborted) {
          console.log('[SyncWorker] Processing aborted');
          break;
        }

        // Verifica se ainda está online
        if (!isOnline()) {
          console.log('[SyncWorker] Went offline during processing');
          break;
        }

        await this.processJob(job);
      }
    } finally {
      this.isProcessing = false;
      this.abortController = null;
      this.callbacks.onSyncCompleted?.();
    }
  }

  /**
   * Processa um job individual
   */
  private async processJob(job: SyncJob): Promise<void> {
    console.log(`[SyncWorker] Processing job ${job.id} (attempt ${job.retryCount + 1})`);

    // Atualiza status para SYNCING
    await SyncStorage.updateJob(job.id, { 
      status: 'SYNCING',
      updatedAt: Date.now(),
    });
    this.callbacks.onJobStarted?.(job.id);

    try {
      // Passo 1: Criar assessment (se ainda não criado)
      let assessmentId = job.assessmentId;
      
      if (!assessmentId) {
        const createResponse = await apiClient.post('/assessments/', {
          title: job.assessmentDraft.title,
          description: job.assessmentDraft.description,
          status: 'draft'
        }, {
          signal: this.abortController?.signal,
        });
        
        assessmentId = createResponse.data.id;
        
        // Salva o ID para não criar duplicado em retry
        await SyncStorage.updateJob(job.id, { 
          assessmentId,
          updatedAt: Date.now(),
        });
      }

      // Passo 2: Upload das fotos
      if (job.photos.length > 0) {
        const formData = new FormData();
        
        job.photos.forEach((photo) => {
          const file = dataURLtoFile(photo.dataUrl, `evidence_${photo.id}.jpg`);
          formData.append('images', file);
          formData.append('timestamps', photo.timestamp);
        });

        await apiClient.post(`/assessments/${assessmentId}/evidences/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          signal: this.abortController?.signal,
          timeout: 60000, // 60s timeout para upload
        });
      }

      // Sucesso! Marca como completado
      await this.markJobCompleted(job.id);

    } catch (error) {
      await this.handleJobError(job, error);
    }
  }

  /**
   * Marca job como completado
   */
  private async markJobCompleted(jobId: string): Promise<void> {
    await SyncStorage.updateJob(jobId, {
      status: 'COMPLETED',
      completedAt: Date.now(),
      lastError: null,
    });
    
    console.log(`[SyncWorker] Job ${jobId} completed successfully`);
    this.callbacks.onJobCompleted?.(jobId);
  }

  /**
   * Trata erro no processamento de um job
   */
  private async handleJobError(job: SyncJob, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const newRetryCount = job.retryCount + 1;
    const maxRetriesReached = newRetryCount >= SYNC_CONFIG.MAX_RETRIES;

    console.error(`[SyncWorker] Job ${job.id} failed (attempt ${newRetryCount}):`, errorMessage);

    if (maxRetriesReached) {
      // Máximo de retries atingido - marca como erro permanente
      await SyncStorage.updateJob(job.id, {
        status: 'ERROR',
        retryCount: newRetryCount,
        lastError: errorMessage,
        updatedAt: Date.now(),
      });
      
      this.callbacks.onJobError?.(job.id, errorMessage);
    } else {
      // Ainda pode tentar novamente - calcula próximo retry com backoff
      const nextRetryAt = calculateNextRetryAt(newRetryCount);
      
      await SyncStorage.updateJob(job.id, {
        status: 'FAILED',
        retryCount: newRetryCount,
        nextRetryAt,
        lastError: errorMessage,
        updatedAt: Date.now(),
      });
      
      this.callbacks.onJobFailed?.(job.id, errorMessage);
    }
  }

  /**
   * Força retry imediato de um job específico
   */
  async retryJobNow(jobId: string): Promise<void> {
    const jobs = await SyncStorage.getAllJobs();
    const job = jobs.find(j => j.id === jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status === 'COMPLETED') {
      throw new Error('Job already completed');
    }

    // Reseta o status para permitir retry imediato
    await SyncStorage.updateJob(jobId, {
      status: 'PENDING',
      nextRetryAt: null,
      updatedAt: Date.now(),
    });

    // Dispara processamento
    await this.checkAndProcess();
  }

  /**
   * Cancela um job (remove da fila)
   */
  async cancelJob(jobId: string): Promise<void> {
    await SyncStorage.removeJob(jobId);
  }

  /**
   * Retorna status atual
   */
  getStatus(): { isProcessing: boolean; isRunning: boolean } {
    return {
      isProcessing: this.isProcessing,
      isRunning: this.intervalId !== null,
    };
  }
}

// Exporta singleton
export const syncWorker = new SyncWorker();
