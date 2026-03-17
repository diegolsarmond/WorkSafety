/**
 * Indicador visual de status offline
 */

import { WifiOff, Wifi } from 'lucide-react';
import { useNetworkStatus } from '../hooks';

export function OfflineIndicator() {
  const { isOffline, isOnline } = useNetworkStatus();

  // Mostra indicador quando ficar offline
  if (isOffline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#DC2626]/90 px-4 py-2 text-center text-sm font-medium text-white backdrop-blur-sm animate-in slide-in-from-top">
        <div className="flex items-center justify-center gap-2">
          <WifiOff className="h-4 w-4" />
          <span>Você está offline. Algumas funcionalidades podem estar limitadas.</span>
        </div>
      </div>
    );
  }

  // Mostra brevemente quando voltar online
  return null;
}

/**
 * Badge de status da conexão para uso em componentes
 */
export function ConnectionBadge() {
  const { isOnline } = useNetworkStatus();

  return (
    <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
      isOnline 
        ? 'bg-emerald-500/20 text-emerald-400' 
        : 'bg-red-500/20 text-red-400'
    }`}>
      {isOnline ? (
        <>
          <Wifi className="h-3 w-3" />
          <span>Online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          <span>Offline</span>
        </>
      )}
    </div>
  );
}
