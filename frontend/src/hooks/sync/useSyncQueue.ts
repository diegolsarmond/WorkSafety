import { useState, useEffect, useCallback, useRef } from 'react';
import { SyncJob, SyncJobStatus } from '@/types/sync';
import { SyncStorage } from '@/services/sync/syncStorage';
import { syncWorker } from '@/services/sync/syncWorker';

interface UseSyncQueueReturn {
  jobs: SyncJob[];
  pendingCount: number;
  failedCount: number;
  errorCount: number;
  isProcessing: boolean;
  isLoading: boolean;
  retryJob: (jobId: string) => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook para gerenciar a fila de sincronização na UI
 * 
 * Features:
 * - Lista jobs pendentes/falhos/erro
 * - Atualizações em tempo real
 * - Ações de retry e cancel
 */
export function useSyncQueue(): UseSyncQueueReturn {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  // Carrega jobs iniciais
  const loadJobs = useCallback(async () => {
    if (!mountedRef.current) return;
    
    try {
      const [pendingJobs, errorJobs] = await Promise.all([
        SyncStorage.getPendingJobs(),
        SyncStorage.getErrorJobs(),
      ]);
      
      if (mountedRef.current) {
        setJobs([...pendingJobs, ...errorJobs]);
      }
    } catch (error) {
      console.error('[useSyncQueue] Error loading jobs:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Inicializa e configura listeners
  useEffect(() => {
    mountedRef.current = true;
    
    // Carrega jobs iniciais
    loadJobs();

    // Registra callbacks no worker para atualizações em tempo real
    syncWorker.on({
      onJobStarted: () => {
        if (mountedRef.current) {
          setIsProcessing(true);
          loadJobs();
        }
      },
      onJobCompleted: () => {
        if (mountedRef.current) {
          loadJobs();
        }
      },
      onJobFailed: () => {
        if (mountedRef.current) {
          loadJobs();
        }
      },
      onJobError: () => {
        if (mountedRef.current) {
          loadJobs();
        }
      },
      onSyncStarted: () => {
        if (mountedRef.current) {
          setIsProcessing(true);
        }
      },
      onSyncCompleted: () => {
        if (mountedRef.current) {
          setIsProcessing(false);
          loadJobs();
        }
      },
    });

    // Atualiza periodicamente para mostrar countdown de retry
    const intervalId = setInterval(() => {
      if (mountedRef.current) {
        loadJobs();
      }
    }, 5000);

    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
      syncWorker.off();
    };
  }, [loadJobs]);

  // Retry manual de um job
  const retryJob = useCallback(async (jobId: string) => {
    try {
      await syncWorker.retryJobNow(jobId);
      await loadJobs();
    } catch (error) {
      console.error('[useSyncQueue] Error retrying job:', error);
      throw error;
    }
  }, [loadJobs]);

  // Cancela um job
  const cancelJob = useCallback(async (jobId: string) => {
    try {
      await syncWorker.cancelJob(jobId);
      await loadJobs();
    } catch (error) {
      console.error('[useSyncQueue] Error canceling job:', error);
      throw error;
    }
  }, [loadJobs]);

  // Contagens
  const pendingCount = jobs.filter(j => j.status === 'PENDING').length;
  const failedCount = jobs.filter(j => j.status === 'FAILED').length;
  const errorCount = jobs.filter(j => j.status === 'ERROR').length;

  return {
    jobs,
    pendingCount,
    failedCount,
    errorCount,
    isProcessing,
    isLoading,
    retryJob,
    cancelJob,
    refresh: loadJobs,
  };
}
