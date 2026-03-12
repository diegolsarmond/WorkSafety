import React from 'react';
import { 
  RefreshCw, 
  WifiOff, 
  CheckCircle2, 
  Inbox,
  ArrowLeft
} from 'lucide-react';
import { useSyncQueue } from '@/hooks/sync/useSyncQueue';
import { SyncJobItem } from './SyncJobItem';
import { Button } from '@/ui/components/Button';
import { isOnline } from '@/utils/syncUtils';

interface SyncQueueDashboardProps {
  onClose?: () => void;
  showBackButton?: boolean;
}

/**
 * Dashboard de fila de sincronização
 * 
 * Mostra todos os jobs pendentes/falhos/erro com opções de gerenciamento
 */
export function SyncQueueDashboard({ onClose, showBackButton = false }: SyncQueueDashboardProps) {
  const { 
    jobs, 
    pendingCount, 
    failedCount, 
    errorCount, 
    isProcessing, 
    isLoading,
    retryJob, 
    cancelJob,
    refresh 
  } = useSyncQueue();

  const online = isOnline();

  // Agrupa jobs por status
  const syncingJobs = jobs.filter(j => j.status === 'SYNCING');
  const pendingJobsList = jobs.filter(j => j.status === 'PENDING');
  const failedJobsList = jobs.filter(j => j.status === 'FAILED');
  const errorJobsList = jobs.filter(j => j.status === 'ERROR');

  const hasAnyJobs = jobs.length > 0;

  const handleRetryAll = async () => {
    const failedAndError = jobs.filter(j => j.status === 'FAILED' || j.status === 'ERROR');
    for (const job of failedAndError) {
      await retryJob(job.id);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[300px] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="flex items-center p-4">
          {showBackButton && (
            <button 
              onClick={onClose}
              className="p-2.5 -ml-2 rounded-full hover:bg-gray-100 flex items-center justify-center min-w-[44px] min-h-[44px] mr-2"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
          )}
          
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Fila de Sincronização</h1>
            <p className="text-sm text-gray-500">
              {pendingCount > 0 && `${pendingCount} pendente${pendingCount > 1 ? 's' : ''}`}
              {failedCount > 0 && `, ${failedCount} falha${failedCount > 1 ? 's' : ''}`}
              {errorCount > 0 && `, ${errorCount} erro${errorCount > 1 ? 's' : ''}`}
              {!hasAnyJobs && 'Tudo sincronizado'}
            </p>
          </div>

          {/* Botão refresh */}
          <button
            onClick={refresh}
            disabled={isProcessing}
            className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-50"
            title="Atualizar"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${isProcessing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Barra de status da conexão */}
        {!online && (
          <div className="bg-gray-100 border-b border-gray-200 px-4 py-2 flex items-center gap-2 text-sm text-gray-600">
            <WifiOff className="w-4 h-4" />
            <span>Você está offline. A sincronização continuará automaticamente quando a conexão voltar.</span>
          </div>
        )}
      </header>

      {/* Conteúdo */}
      <main className="p-4 pb-32">
        {!hasAnyJobs ? (
          // Estado vazio
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Tudo sincronizado!
            </h3>
            <p className="text-gray-500 max-w-xs">
              Todas as suas inspeções foram enviadas com sucesso.
            </p>
          </div>
        ) : (
          // Lista de jobs
          <div className="space-y-6">
            {/* Sincronizando agora */}
            {syncingJobs.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Sincronizando agora
                </h2>
                <div className="space-y-3">
                  {syncingJobs.map(job => (
                    <SyncJobItem
                      key={job.id}
                      job={job}
                      onRetry={retryJob}
                      onCancel={cancelJob}
                      isProcessing={isProcessing}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Pendentes */}
            {pendingJobsList.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Aguardando ({pendingJobsList.length})
                </h2>
                <div className="space-y-3">
                  {pendingJobsList.map(job => (
                    <SyncJobItem
                      key={job.id}
                      job={job}
                      onRetry={retryJob}
                      onCancel={cancelJob}
                      isProcessing={isProcessing}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Falhos (com retry) */}
            {failedJobsList.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                    Tentativas falhas ({failedJobsList.length})
                  </h2>
                  {online && (
                    <Button
                      onClick={handleRetryAll}
                      variant="outline"
                      size="sm"
                      className="text-orange-600 border-orange-200 hover:bg-orange-50"
                    >
                      Tentar todas
                    </Button>
                  )}
                </div>
                <div className="space-y-3">
                  {failedJobsList.map(job => (
                    <SyncJobItem
                      key={job.id}
                      job={job}
                      onRetry={retryJob}
                      onCancel={cancelJob}
                      isProcessing={isProcessing}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Erros permanentes */}
            {errorJobsList.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Erros permanentes ({errorJobsList.length})
                </h2>
                <div className="space-y-3">
                  {errorJobsList.map(job => (
                    <SyncJobItem
                      key={job.id}
                      job={job}
                      onRetry={retryJob}
                      onCancel={cancelJob}
                      isProcessing={isProcessing}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
