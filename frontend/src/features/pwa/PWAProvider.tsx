/**
 * Provider que gerencia o estado global do PWA
 * - Status de conexão
 * - Sincronização
 * - Notificações
 */

import { ReactNode, useEffect, useState } from 'react';
import { useOnlineStatus, useSyncManager } from '@/services/sync';
import { useStorageStats } from '@/services/storage';
import { OfflineIndicator } from './components/OfflineIndicator';
import { InstallPrompt } from './components/InstallPrompt';

interface PWAProviderProps {
  children: ReactNode;
}

export function PWAProvider({ children }: PWAProviderProps) {
  const { isOnline } = useOnlineStatus();
  const { isSyncing, pendingCount, forceSync } = useSyncManager();
  const { stats } = useStorageStats();
  const [showSyncNotification, setShowSyncNotification] = useState(false);

  // Notifica quando volta online e tem pendentes
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      setShowSyncNotification(true);
      // Tenta sincronizar automaticamente
      forceSync();
      
      // Esconde notificação após 5 segundos
      const timer = setTimeout(() => {
        setShowSyncNotification(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingCount, forceSync]);

  return (
    <>
      {children}
      
      {/* Indicador de offline */}
      <OfflineIndicator />
      
      {/* Banner de instalação */}
      <InstallPrompt />
      
      {/* Notificação de sync */}
      {showSyncNotification && (
        <div className="fixed right-4 top-4 z-50 animate-in slide-in-from-right">
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-3 text-emerald-400 backdrop-blur-sm">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            <span className="text-sm font-medium">
              {isSyncing 
                ? `Syncing ${pendingCount} item(s)...` 
                : `${pendingCount} item(s) pending sync`}
            </span>
          </div>
        </div>
      )}
      
      {/* Alerta de espaço baixo */}
      {stats && stats.available < 50 * 1024 * 1024 && ( // menos de 50MB
        <div className="fixed bottom-20 left-4 right-4 z-40 mx-auto max-w-md animate-in slide-in-from-bottom">
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/20 px-4 py-3 text-yellow-400 backdrop-blur-sm">
            <p className="text-sm">
              ⚠️ Low storage space. 
              {(stats.available / 1024 / 1024).toFixed(0)} MB available.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
