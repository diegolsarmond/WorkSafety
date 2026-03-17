/**
 * React Hooks para SyncManager
 */

import { useState, useEffect, useCallback } from 'react';
import { syncManager } from './SyncManager';
import type { SyncQueueItem, OfflineInspection } from '../storage/types';

interface UseSyncManagerReturn {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSync?: string;
  error?: string;
  forceSync: () => Promise<void>;
  queueInspection: (inspection: OfflineInspection) => Promise<void>;
}

export function useSyncManager(): UseSyncManagerReturn {
  const [state, setState] = useState({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
    lastSync: undefined as string | undefined,
    error: undefined as string | undefined,
  });

  useEffect(() => {
    const unsubscribe = syncManager.subscribe(newState => {
      setState({
        isOnline: newState.connection === 'online',
        isSyncing: newState.status === 'syncing',
        pendingCount: newState.pendingCount,
        lastSync: newState.lastSync,
        error: newState.error,
      });
    });

    return unsubscribe;
  }, []);

  const forceSync = useCallback(async () => {
    await syncManager.forceSync();
  }, []);

  const queueInspection = useCallback(async (inspection: OfflineInspection) => {
    await syncManager.queueInspection(inspection);
  }, []);

  return {
    ...state,
    forceSync,
    queueInspection,
  };
}

/**
 * Hook para monitorar mudanças na conexão
 */
export function useOnlineStatus(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}
