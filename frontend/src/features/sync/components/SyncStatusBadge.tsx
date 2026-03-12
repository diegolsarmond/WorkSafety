import React from 'react';
import { Loader2, CloudOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useSyncStatus } from '@/hooks/sync/useSyncStatus';

interface SyncStatusBadgeProps {
  onClick?: () => void;
  className?: string;
}

/**
 * Badge de status da sincronização
 * Mostra indicador visual do estado atual da fila
 */
export function SyncStatusBadge({ onClick, className = '' }: SyncStatusBadgeProps) {
  const { hasPendingJobs, pendingCount, failedCount, isOnline, isProcessing } = useSyncStatus();

  // Não mostra nada se não há jobs pendentes
  if (!hasPendingJobs && !failedCount) {
    return null;
  }

  // Configuração baseada no estado
  let icon = <CheckCircle2 className="w-4 h-4" />;
  let bgColor = 'bg-emerald-100';
  let textColor = 'text-emerald-700';
  let borderColor = 'border-emerald-200';
  let label = 'Sincronizado';

  if (!isOnline) {
    icon = <CloudOff className="w-4 h-4" />;
    bgColor = 'bg-gray-100';
    textColor = 'text-gray-600';
    borderColor = 'border-gray-200';
    label = 'Offline';
  } else if (isProcessing) {
    icon = <Loader2 className="w-4 h-4 animate-spin" />;
    bgColor = 'bg-blue-100';
    textColor = 'text-blue-700';
    borderColor = 'border-blue-200';
    label = 'Sincronizando...';
  } else if (failedCount > 0) {
    icon = <AlertCircle className="w-4 h-4" />;
    bgColor = 'bg-red-100';
    textColor = 'text-red-700';
    borderColor = 'border-red-200';
    label = `${failedCount} falha${failedCount > 1 ? 's' : ''}`;
  } else if (pendingCount > 0) {
    icon = <Loader2 className="w-4 h-4" />;
    bgColor = 'bg-amber-100';
    textColor = 'text-amber-700';
    borderColor = 'border-amber-200';
    label = `${pendingCount} pendente${pendingCount > 1 ? 's' : ''}`;
  }

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
        border ${bgColor} ${textColor} ${borderColor}
        transition-all hover:opacity-80 active:scale-95
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
        ${className}
      `}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
