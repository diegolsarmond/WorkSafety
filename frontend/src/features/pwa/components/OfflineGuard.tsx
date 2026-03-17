/**
 * Componente que protege rotas que precisam de internet
 * Mostra tela de fallback quando offline
 */

import { ReactNode } from 'react';
import { useOnlineStatus } from '@/services/sync/hooks';
import { OfflineFallback } from './OfflineFallback';

interface OfflineGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  requireOnline?: boolean;
}

export function OfflineGuard({
  children,
  fallback,
  requireOnline = false,
}: OfflineGuardProps) {
  const { isOnline } = useOnlineStatus();

  // Se não requer online, sempre mostra children
  if (!requireOnline) {
    return <>{children}</>;
  }

  // Se requer online e está offline
  if (requireOnline && !isOnline) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <div className="min-h-screen bg-[#0F1729]">
        <OfflineFallback 
          title="Funcionalidade indisponível offline"
          message="Esta funcionalidade requer conexão com a internet para funcionar. Conecte-se e tente novamente."
        />
      </div>
    );
  }

  return <>{children}</>;
}
