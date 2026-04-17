import React from 'react';
import { 
  Loader2, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  RefreshCw, 
  Trash2,
  Image,
  WifiOff
} from 'lucide-react';
import { SyncJob } from '@/types/sync';
import { formatDate, formatTimeToRetry, isOnline } from '@/utils/syncUtils';
import { Button } from '@/ui/components/Button';

interface SyncJobItemProps {
  key?: string;
  job: SyncJob;
  onRetry: (jobId: string) => void;
  onCancel: (jobId: string) => void;
  isProcessing?: boolean;
}

/**
 * Item individual de job na lista de sincronização
 */
export function SyncJobItem({ job, onRetry, onCancel, isProcessing }: SyncJobItemProps) {
  const online = isOnline();

  const getStatusConfig = () => {
    switch (job.status) {
      case 'SYNCING':
        return {
          icon: <Loader2 className="w-5 h-5 animate-spin text-blue-500" />,
          label: 'Syncing...',
          color: 'text-blue-700',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
        };
      case 'PENDING':
        return {
          icon: <Clock className="w-5 h-5 text-amber-500" />,
          label: 'Waiting...',
          color: 'text-amber-700',
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
        };
      case 'FAILED':
        return {
          icon: <AlertCircle className="w-5 h-5 text-orange-500" />,
          label: `Falhou (${job.retryCount}/${job.maxRetries})`,
          color: 'text-orange-700',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
        };
      case 'ERROR':
        return {
          icon: <AlertCircle className="w-5 h-5 text-red-500" />,
          label: 'Permanent error',
          color: 'text-red-700',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
        };
      case 'COMPLETED':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
          label: 'Completed',
          color: 'text-emerald-700',
          bgColor: 'bg-emerald-50',
          borderColor: 'border-emerald-200',
        };
      default:
        return {
          icon: <Clock className="w-5 h-5 text-gray-500" />,
          label: 'Unknown',
          color: 'text-gray-700',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
        };
    }
  };

  const config = getStatusConfig();

  const handleRetry = () => {
    onRetry(job.id);
  };

  const handleCancel = () => {
    if (confirm('Are you sure you want to remove this inspection?')) {
      onCancel(job.id);
    }
  };

  // Determina se pode fazer retry manual
  const canRetry = (job.status === 'FAILED' || job.status === 'ERROR') && online && !isProcessing;
  
  // Mostra countdown para próximo retry
  const showCountdown = job.status === 'FAILED' && job.nextRetryAt && !isProcessing && online;

  return (
    <div 
      className={`
        p-4 rounded-xl border ${config.borderColor} ${config.bgColor}
        transition-all
      `}
    >
      <div className="flex items-start gap-3">
        {/* Ícone de status */}
        <div className="mt-0.5 flex-shrink-0">
          {config.icon}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          {/* Título e status */}
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={`font-semibold ${config.color} truncate`}>
              {job.assessmentDraft.title}
            </h4>
            <span className={`
              text-xs px-2 py-0.5 rounded-full font-medium
              ${config.bgColor} ${config.color} border ${config.borderColor}
            `}>
              {config.label}
            </span>
          </div>

          {/* Detalhes */}
          <div className="mt-1 text-sm text-gray-600 space-y-1">
            <p className="flex items-center gap-2">
              <Image className="w-4 h-4" />
              {job.photos.length} foto{job.photos.length !== 1 ? 's' : ''}
            </p>
            <p>Created at {formatDate(job.createdAt)}</p>
            
            {showCountdown && (
              <p className="text-orange-600 font-medium">
                {formatTimeToRetry(job.nextRetryAt!)}
              </p>
            )}

            {!online && (job.status === 'PENDING' || job.status === 'FAILED') && (
              <p className="flex items-center gap-1 text-gray-500">
                <WifiOff className="w-3.5 h-3.5" />
                Waiting for connection...
              </p>
            )}

            {job.lastError && job.status !== 'COMPLETED' && (
              <p className="text-red-600 text-xs truncate" title={job.lastError}>
                Erro: {job.lastError}
              </p>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-col gap-2">
          {canRetry && (
            <Button
              onClick={handleRetry}
              variant="outline"
              size="sm"
              className="p-2 h-auto text-orange-600 border-orange-200 hover:bg-orange-100"
              title="Tentar novamente"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
          
          {job.status !== 'SYNCING' && (
            <Button
              onClick={handleCancel}
              variant="outline"
              size="sm"
              className="p-2 h-auto text-gray-500 border-gray-200 hover:bg-gray-100"
              title="Remover"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
