import { get, set, del, keys } from 'idb-keyval';
import { SyncJob, SYNC_CONFIG } from '@/types/sync';
import { generateId } from '@/utils/syncUtils';

const SYNC_JOBS_KEY = 'sync-jobs-queue';
const LEGACY_INSPECTION_KEY = 'inspection-storage';

/**
 * Serviço de persistência para jobs de sincronização.
 * Utiliza IndexedDB via idb-keyval para durabilidade.
 */
export class SyncStorage {
  /**
   * Recupera todos os jobs do storage
   */
  static async getAllJobs(): Promise<SyncJob[]> {
    try {
      const jobs = await get<SyncJob[]>(SYNC_JOBS_KEY);
      return jobs || [];
    } catch (error) {
      console.error('[SyncStorage] Error getting jobs:', error);
      return [];
    }
  }

  /**
   * Salva todos os jobs no storage
   */
  static async saveAllJobs(jobs: SyncJob[]): Promise<void> {
    try {
      await set(SYNC_JOBS_KEY, jobs);
    } catch (error) {
      console.error('[SyncStorage] Error saving jobs:', error);
      throw error;
    }
  }

  /**
   * Adiciona um novo job
   */
  static async addJob(job: SyncJob): Promise<void> {
    const jobs = await this.getAllJobs();
    jobs.push(job);
    await this.saveAllJobs(jobs);
  }

  /**
   * Atualiza um job existente
   */
  static async updateJob(jobId: string, updates: Partial<SyncJob>): Promise<void> {
    const jobs = await this.getAllJobs();
    const index = jobs.findIndex(j => j.id === jobId);
    
    if (index === -1) {
      throw new Error(`Job ${jobId} not found`);
    }

    jobs[index] = {
      ...jobs[index],
      ...updates,
      updatedAt: Date.now(),
    };

    await this.saveAllJobs(jobs);
  }

  /**
   * Remove um job específico
   */
  static async removeJob(jobId: string): Promise<void> {
    const jobs = await this.getAllJobs();
    const filtered = jobs.filter(j => j.id !== jobId);
    await this.saveAllJobs(filtered);
  }

  /**
   * Recupera jobs prontos para processamento
   * (status PENDING ou FAILED com nextRetryAt <= now)
   */
  static async getReadyJobs(): Promise<SyncJob[]> {
    const jobs = await this.getAllJobs();
    const now = Date.now();

    return jobs.filter(job => {
      // Job novo ou falhou mas ainda pode tentar
      if (job.status === 'PENDING') return true;
      if (job.status === 'FAILED' && job.retryCount < SYNC_CONFIG.MAX_RETRIES) {
        return job.nextRetryAt !== null && job.nextRetryAt <= now;
      }
      return false;
    }).sort((a, b) => a.createdAt - b.createdAt); // FIFO
  }

  /**
   * Recupera jobs pendentes (para UI)
   * Inclui jobs COMPLETED recentes para que a UI possa ver a transição
   */
  static async getPendingJobs(): Promise<SyncJob[]> {
    const jobs = await this.getAllJobs();
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return jobs.filter(job => 
      job.status === 'PENDING' || 
      job.status === 'SYNCING' || 
      job.status === 'FAILED' ||
      (job.status === 'COMPLETED' && job.completedAt && job.completedAt > fiveMinutesAgo)
    ).sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Recupera jobs com erro permanente
   */
  static async getErrorJobs(): Promise<SyncJob[]> {
    const jobs = await this.getAllJobs();
    return jobs.filter(job => job.status === 'ERROR');
  }

  /**
   * Limpa jobs antigos completados (mais de 7 dias)
   */
  static async cleanupOldJobs(): Promise<void> {
    const jobs = await this.getAllJobs();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    
    const activeJobs = jobs.filter(job => {
      if (job.status === 'COMPLETED' && job.completedAt && job.completedAt < sevenDaysAgo) {
        return false;
      }
      return true;
    });

    if (activeJobs.length !== jobs.length) {
      await this.saveAllJobs(activeJobs);
    }
  }

  /**
   * Migra dados legados do analysis-storage para a nova fila
   * Chamado uma vez na inicialização
   */
  static async migrateLegacyData(): Promise<void> {
    try {
      const legacyData = await get<{
        state?: {
          environment?: string;
          category?: string;
          photos?: Array<{ id: string; dataUrl: string; timestamp: string }>;
          status?: string;
        }
      }>(LEGACY_INSPECTION_KEY);

      if (!legacyData?.state) return;

      const { environment, category, photos, status } = legacyData.state;
      
      // Só migra se tiver fotos e status indicando que precisa sincronizar
      if (photos && photos.length > 0 && 
          (status === 'CAPTURED' || status === 'ERROR' || status === 'SYNCING')) {
        
        const newJob: SyncJob = {
          id: generateId(),
          assessmentDraft: {
            title: `Analysis - ${environment || 'Unknown'} - ${category || 'General'}`,
            description: `Automated analysis for ${environment || 'unknown'} concerning ${category || 'General'}.`,
            environment: environment || 'other',
            category: category || 'General Safety',
            status: 'draft',
          },
          photos: photos,
          status: status === 'ERROR' ? 'FAILED' : 'PENDING',
          retryCount: 0,
          maxRetries: SYNC_CONFIG.MAX_RETRIES,
          nextRetryAt: null,
          lastError: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          completedAt: null,
        };

        await this.addJob(newJob);
        
        // Limpa o storage legado para evitar migração duplicada
        await del(LEGACY_INSPECTION_KEY);
        
        console.log('[SyncStorage] Migrated legacy analysis data to sync queue');
      }
    } catch (error) {
      console.error('[SyncStorage] Error migrating legacy data:', error);
    }
  }

  /**
   * Limpa todos os jobs (para testes)
   */
  static async clearAll(): Promise<void> {
    await del(SYNC_JOBS_KEY);
  }
}
