import { useState, useEffect, useCallback } from 'react';
import { syncWorker } from '@/services/sync/syncWorker';
import { SyncStorage } from '@/services/sync/syncStorage';

interface SyncStatus {
  hasPendingJobs: boolean;
  pendingCount: number;
  failedCount: number;
  isOnline: boolean;
  isProcessing: boolean;
}

/**
 * Hook leve para verificar status de sincronização
 * Útil para mostrar indicadores na UI (badges, toasts, etc)
 */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>({
    hasPendingJobs: false,
    pendingCount: 0,
    failedCount: 0,
    isOnline: navigator.onLine,
    isProcessing: false,
  });

  const updateStatus = useCallback(async () => {
    const pendingJobs = await SyncStorage.getPendingJobs();
    const workerStatus = syncWorker.getStatus();

    setStatus({
      hasPendingJobs: pendingJobs.length > 0,
      pendingCount: pendingJobs.filter(j => j.status === 'PENDING').length,
      failedCount: pendingJobs.filter(j => j.status === 'FAILED').length,
      isOnline: navigator.onLine,
      isProcessing: workerStatus.isProcessing,
    });
  }, []);

  useEffect(() => {
    // Atualiza inicialmente
    updateStatus();

    // Listener para jobs completados
    const handleJobCompleted = () => updateStatus();
    const handleJobFailed = () => updateStatus();

    syncWorker.on({
      onJobCompleted: handleJobCompleted,
      onJobFailed: handleJobFailed,
    });

    // Listener para online/offline
    const handleOnline = () => setStatus(s => ({ ...s, isOnline: true }));
    const handleOffline = () => setStatus(s => ({ ...s, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Atualiza periodicamente
    const intervalId = setInterval(updateStatus, 10000);

    return () => {
      syncWorker.off();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, [updateStatus]);

  return status;
}
