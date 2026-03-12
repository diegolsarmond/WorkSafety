import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { SyncJob, AssessmentDraft, PhotoData, SYNC_CONFIG } from '@/types/sync';
import { SyncStorage } from '@/services/sync/syncStorage';
import { syncWorker } from '@/services/sync/syncWorker';
import { generateId, calculateNextRetryAt } from '@/utils/syncUtils';

// Custom storage para persistência
const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

interface SyncState {
  isInitialized: boolean;
  isWorkerRunning: boolean;
}

interface SyncActions {
  initialize: () => Promise<void>;
  addJob: (assessmentDraft: AssessmentDraft, photos: PhotoData[]) => Promise<string>;
  startWorker: () => void;
  stopWorker: () => void;
}

/**
 * Store de sincronização
 * 
 * Responsável por:
 * - Inicializar o sistema de sync (migração de dados legados)
 * - Adicionar novos jobs
 * - Controlar o worker
 */
export const useSyncStore = create<SyncState & SyncActions>()(
  persist(
    (set, get) => ({
      // Estado
      isInitialized: false,
      isWorkerRunning: false,

      // Ações
      initialize: async () => {
        if (get().isInitialized) return;

        console.log('[SyncStore] Initializing...');

        try {
          // Migra dados legados se existirem
          await SyncStorage.migrateLegacyData();

          // Limpa jobs antigos
          await SyncStorage.cleanupOldJobs();

          // Inicia o worker automaticamente
          syncWorker.start();

          set({ 
            isInitialized: true, 
            isWorkerRunning: true 
          });

          console.log('[SyncStore] Initialized successfully');
        } catch (error) {
          console.error('[SyncStore] Initialization error:', error);
        }
      },

      addJob: async (assessmentDraft: AssessmentDraft, photos: PhotoData[]) => {
        const job: SyncJob = {
          id: generateId(),
          assessmentDraft,
          photos,
          status: 'PENDING',
          retryCount: 0,
          maxRetries: SYNC_CONFIG.MAX_RETRIES,
          nextRetryAt: null,
          lastError: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          completedAt: null,
        };

        await SyncStorage.addJob(job);
        console.log(`[SyncStore] Added job ${job.id} with ${photos.length} photos`);

        // Dispara verificação imediata
        syncWorker.checkAndProcess();

        return job.id;
      },

      startWorker: () => {
        syncWorker.start();
        set({ isWorkerRunning: true });
      },

      stopWorker: () => {
        syncWorker.stop();
        set({ isWorkerRunning: false });
      },
    }),
    {
      name: 'sync-store',
      storage: createJSONStorage(() => idbStorage),
      // Só persiste flags de estado, não os jobs (eles estão no SyncStorage)
      partialize: (state) => ({ 
        isInitialized: state.isInitialized,
      }),
    }
  )
);
