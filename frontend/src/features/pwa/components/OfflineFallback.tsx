/**
 * Página de fallback quando o usuário está offline
 * e tenta acessar uma funcionalidade que não está disponível
 */

import { WifiOff, RefreshCw, Home, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOnlineStatus } from '@/services/sync/hooks';

interface OfflineFallbackProps {
  title?: string;
  message?: string;
  showHomeButton?: boolean;
  showBackButton?: boolean;
  onRetry?: () => void;
}

export function OfflineFallback({
  title = 'Você está offline',
  message = 'Esta funcionalidade requer conexão com a internet. Verifique sua conexão e tente novamente.',
  showHomeButton = true,
  showBackButton = true,
  onRetry,
}: OfflineFallbackProps) {
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[#1E3A5F]/50">
        <WifiOff className="h-12 w-12 text-[#0B7A90]" />
      </div>

      <h1 className="mb-3 text-2xl font-bold text-white">{title}</h1>
      <p className="mb-8 max-w-md text-[#94A3B8]">{message}</p>

      <div className="flex flex-wrap gap-3">
        {showBackButton && (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 rounded-xl border border-[#1E3A5F] bg-transparent px-6 py-3 font-medium text-[#94A3B8] transition-colors hover:bg-[#1E3A5F]/30"
          >
            <ArrowLeft className="h-5 w-5" />
            Voltar
          </button>
        )}

        <button
          onClick={handleRetry}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0B7A90] to-[#0891B2] px-6 py-3 font-semibold text-white shadow-lg shadow-[#0B7A90]/25 transition-all hover:from-[#0891B2] hover:to-[#0B7A90]"
        >
          <RefreshCw className="h-5 w-5" />
          {isOnline ? 'Tentar novamente' : 'Aguardando conexão...'}
        </button>

        {showHomeButton && (
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-2 rounded-xl border border-[#1E3A5F] bg-transparent px-6 py-3 font-medium text-[#94A3B8] transition-colors hover:bg-[#1E3A5F]/30"
          >
            <Home className="h-5 w-5" />
            Início
          </button>
        )}
      </div>

      {isOnline && (
        <p className="mt-6 text-sm text-emerald-400">
          ✓ Conexão restaurada! Você pode tentar novamente.
        </p>
      )}
    </div>
  );
}
