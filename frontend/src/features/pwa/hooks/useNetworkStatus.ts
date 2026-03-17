/**
 * Hook para monitorar o status da conexão de rede
 */

import { useState, useEffect } from 'react';

interface NetworkStatus {
  isOnline: boolean;
  isOffline: boolean;
  connectionType?: string;
  effectiveType?: string;
  saveData?: boolean;
}

export function useNetworkStatus(): NetworkStatus {
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

  // Obtém informações da conexão (se disponível)
  const connection = (navigator as { connection?: NetworkInformation }).connection;

  return {
    isOnline,
    isOffline: !isOnline,
    connectionType: connection?.type,
    effectiveType: (connection as { effectiveType?: string })?.effectiveType,
    saveData: (connection as { saveData?: boolean })?.saveData,
  };
}

// Type para NetworkInformation (ainda não padrão em todos os navegadores)
interface NetworkInformation {
  type: string;
  effectiveType: string;
  saveData: boolean;
}
