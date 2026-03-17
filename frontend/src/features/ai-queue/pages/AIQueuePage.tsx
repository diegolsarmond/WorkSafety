import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Clock,
  ArrowLeft,
  Brain,
  Image as ImageIcon,
  AlertTriangle
} from 'lucide-react';
import { useAIQueue, AIQueueItem } from '../hooks/useAIQueue';
import { Button } from '@/ui/components/Button';

/**
 * Página de fila de processamento de IA
 * 
 * Exibe todas as avaliações em processamento de IA vindo do backend:
 * - Pendentes (synced, aguardando processamento)
 * - Em processamento (running)
 * - Completados (succeeded)
 * - Com erro (error_ai / failed)
 */
export function AIQueuePage() {
  const navigate = useNavigate();
  const { queue, counts, isLoading, error, refresh } = useAIQueue();

  // Agrupa itens por status
  const processingItems = queue.filter(item => item.ai_status === 'running');
  const pendingItems = queue.filter(item => item.ai_status === 'pending');
  const errorItems = queue.filter(item => item.status === 'error_ai' || item.ai_status === 'failed');
  const completedItems = queue.filter(item => item.ai_status === 'succeeded');

  const hasAnyItems = queue.length > 0;

  const handleBack = () => {
    navigate('/home');
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (item: AIQueueItem) => {
    switch (item.ai_status) {
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'succeeded':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'failed':
      default:
        return item.status === 'error_ai' 
          ? <AlertTriangle className="w-5 h-5 text-red-500" />
          : <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadgeClass = (item: AIQueueItem) => {
    switch (item.ai_status) {
      case 'running':
        return 'bg-blue-100 text-blue-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'succeeded':
        return 'bg-emerald-100 text-emerald-700';
      case 'failed':
      default:
        return item.status === 'error_ai'
          ? 'bg-red-100 text-red-700'
          : 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="flex items-center p-4">
          <button 
            onClick={handleBack}
            className="p-2.5 -ml-2 rounded-full hover:bg-gray-100 flex items-center justify-center min-w-[44px] min-h-[44px] mr-2"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Brain className="w-6 h-6 text-indigo-600" />
              <h1 className="text-xl font-bold text-gray-900">Fila de Processamento IA</h1>
            </div>
            <p className="text-sm text-gray-500">
              {counts.processing > 0 && `${counts.processing} processando`}
              {counts.pending > 0 && `, ${counts.pending} pendente${counts.pending > 1 ? 's' : ''}`}
              {counts.error > 0 && `, ${counts.error} erro${counts.error > 1 ? 's' : ''}`}
              {!hasAnyItems && 'Nenhum processamento ativo'}
            </p>
          </div>

          {/* Botão refresh */}
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-50"
            title="Atualizar"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Resumo de contadores */}
        {hasAnyItems && (
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-full text-sm">
              <Loader2 className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-blue-700 font-medium">{counts.processing}</span>
              <span className="text-blue-600">Processando</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 rounded-full text-sm">
              <Clock className="w-3.5 h-3.5 text-yellow-600" />
              <span className="text-yellow-700 font-medium">{counts.pending}</span>
              <span className="text-yellow-600">Pendentes</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-full text-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700 font-medium">{counts.completed}</span>
              <span className="text-emerald-600">Concluídos</span>
            </div>
            {counts.error > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 rounded-full text-sm">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                <span className="text-red-700 font-medium">{counts.error}</span>
                <span className="text-red-600">Erros</span>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Conteúdo */}
      <main className="p-4 pb-32">
        {isLoading && queue.length === 0 ? (
          // Estado de loading inicial
          <div className="min-h-[300px] flex items-center justify-center">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          // Estado de erro
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Erro ao carregar
            </h3>
            <p className="text-gray-500 max-w-xs mb-4">{error}</p>
            <Button onClick={refresh} variant="outline">
              Tentar novamente
            </Button>
          </div>
        ) : !hasAnyItems ? (
          // Estado vazio
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Brain className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Fila vazia
            </h3>
            <p className="text-gray-500 max-w-xs">
              Não há avaliações em processamento de IA no momento.
            </p>
          </div>
        ) : (
          // Lista de itens agrupados por status
          <div className="space-y-6">
            {/* Processando agora */}
            {processingItems.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Processando agora ({processingItems.length})
                </h2>
                <div className="space-y-3">
                  {processingItems.map(item => (
                    <AIQueueItemCard 
                      key={item.assessment_id} 
                      item={item}
                      getStatusIcon={getStatusIcon}
                      getStatusBadgeClass={getStatusBadgeClass}
                      formatTime={formatTime}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Pendentes */}
            {pendingItems.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Aguardando processamento ({pendingItems.length})
                </h2>
                <div className="space-y-3">
                  {pendingItems.map(item => (
                    <AIQueueItemCard 
                      key={item.assessment_id} 
                      item={item}
                      getStatusIcon={getStatusIcon}
                      getStatusBadgeClass={getStatusBadgeClass}
                      formatTime={formatTime}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Completados */}
            {completedItems.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Concluídos ({completedItems.length})
                </h2>
                <div className="space-y-3">
                  {completedItems.map(item => (
                    <AIQueueItemCard 
                      key={item.assessment_id} 
                      item={item}
                      getStatusIcon={getStatusIcon}
                      getStatusBadgeClass={getStatusBadgeClass}
                      formatTime={formatTime}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Erros */}
            {errorItems.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Com erro ({errorItems.length})
                </h2>
                <div className="space-y-3">
                  {errorItems.map(item => (
                    <AIQueueItemCard 
                      key={item.assessment_id} 
                      item={item}
                      getStatusIcon={getStatusIcon}
                      getStatusBadgeClass={getStatusBadgeClass}
                      formatTime={formatTime}
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

// Componente de card para cada item da fila
interface AIQueueItemCardProps {
  item: AIQueueItem;
  getStatusIcon: (item: AIQueueItem) => React.ReactNode;
  getStatusBadgeClass: (item: AIQueueItem) => string;
  formatTime: (dateString: string | null) => string;
}

function AIQueueItemCard({ item, getStatusIcon, getStatusBadgeClass, formatTime }: AIQueueItemCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
          {item.thumbnail_url ? (
            <img 
              src={item.thumbnail_url} 
              alt="" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-gray-300" />
            </div>
          )}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-gray-900 truncate">
              {item.title}
            </h3>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(item)}`}>
              {getStatusIcon(item)}
              <span>{item.ai_status_display}</span>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <ImageIcon className="w-4 h-4" />
              <span>{item.evidence_count} foto{item.evidence_count > 1 ? 's' : ''}</span>
            </div>
            <div>
              Criado em {formatTime(item.created_at)}
            </div>
          </div>

          {/* Informações adicionais baseadas no status */}
          {item.ai_status === 'running' && item.started_at && (
            <div className="mt-2 text-sm text-blue-600">
              Iniciado em {formatTime(item.started_at)}
            </div>
          )}
          
          {item.ai_status === 'succeeded' && item.confidence && (
            <div className="mt-2 text-sm text-emerald-600">
              Confiança: {item.confidence}
            </div>
          )}

          {item.error_message && (
            <div className="mt-2 text-sm text-red-600 line-clamp-2">
              Erro: {item.error_message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
