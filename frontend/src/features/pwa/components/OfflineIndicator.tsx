/**
 * Indicador visual discreto de status offline
 * Badge minimalista no canto superior direito
 */

import { WifiOff, Wifi, X } from 'lucide-react';
import { useNetworkStatus } from '../hooks';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Badge discreto de offline no canto superior direito
 */
export function OfflineIndicator() {
  const { isOffline } = useNetworkStatus();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const location = useLocation();

  // Pages that render their own offline indicator
  const suppressedPaths = ['/ai-queue', '/sync-queue'];
  const isSuppressed = suppressedPaths.some(p => location.pathname.startsWith(p));

  useEffect(() => {
    if (isOffline && !isDismissed) {
      setIsVisible(true);
    } else if (!isOffline) {
      setIsVisible(false);
      setIsDismissed(false); // Reset quando volta online
    }
  }, [isOffline, isDismissed]);

  if (!isVisible || !isOffline || isSuppressed) return null;

  return (
    <div className="hidden sm:block fixed top-4 right-4 z-50 animate-in fade-in duration-300">
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
        <WifiOff className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          Offline
        </span>
        <button 
          onClick={() => setIsDismissed(true)}
          className="ml-1 rounded-full p-0.5 text-slate-300 hover:bg-slate-100 hover:text-slate-400"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

/**
 * Badge de status da conexão para uso em componentes
 */
export function ConnectionBadge() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500">
      <WifiOff className="h-3 w-3 text-slate-400" />
      <span>Offline</span>
    </div>
  );
}

/**
 * Indicador minimalista apenas com ícone
 */
export function OfflineIcon() {
  const { isOffline } = useNetworkStatus();
  
  if (!isOffline) return null;
  
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm">
      <WifiOff className="h-3.5 w-3.5 text-slate-400" />
    </div>
  );
}
