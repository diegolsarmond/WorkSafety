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

// Mapper to translate ai_status to English display label
const getStatusLabel = (item: AIQueueItem) => {
  switch (item.ai_status) {
    case 'running': return 'Processing';
    case 'pending': return 'Pending';
    case 'succeeded': return 'Completed';
    case 'failed': return 'Failed';
    default: return item.ai_status_display?.toLowerCase().includes('erro') ? 'Error' : (item.ai_status_display || item.ai_status);
  }
};

/**
 * AI Processing Queue Page
 * 
 * Displays all assessments in AI processing from the backend:
 * - Pending (synced, waiting for processing)
 * - Processing (running)
 * - Completed (succeeded)
 * - Error (error_ai / failed)
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
              <h1 className="text-xl font-bold text-gray-900">AI Processing Queue</h1>
            </div>
            <p className="text-sm text-gray-500">
              {counts.processing > 0 && `${counts.processing} processing`}
              {counts.pending > 0 && `, ${counts.pending} pending`}
              {counts.error > 0 && `, ${counts.error} error${counts.error > 1 ? 's' : ''}`}
              {!hasAnyItems && 'No active processing'}
            </p>
          </div>

          {/* Refresh button */}
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Counter summary */}
        {hasAnyItems && (
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-full text-sm">
              <Loader2 className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-blue-700 font-medium">{counts.processing}</span>
              <span className="text-blue-600">Processing</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 rounded-full text-sm">
              <Clock className="w-3.5 h-3.5 text-yellow-600" />
              <span className="text-yellow-700 font-medium">{counts.pending}</span>
              <span className="text-yellow-600">Pending</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-full text-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700 font-medium">{counts.completed}</span>
              <span className="text-emerald-600">Completed</span>
            </div>
            {counts.error > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 rounded-full text-sm">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                <span className="text-red-700 font-medium">{counts.error}</span>
                <span className="text-red-600">Errors</span>
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
              Error loading
            </h3>
            <p className="text-gray-500 max-w-xs mb-4">{error}</p>
            <Button onClick={refresh} variant="outline">
              Try again
            </Button>
          </div>
        ) : !hasAnyItems ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Brain className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Empty Queue
            </h3>
            <p className="text-gray-500 max-w-xs">
              There are no assessments in AI processing at the moment.
            </p>
          </div>
        ) : (
          // Lista de itens agrupados por status
          <div className="space-y-6">
            {/* Processing now */}
            {processingItems.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Processing now ({processingItems.length})
                </h2>
                <div className="space-y-3">
                  {processingItems.map(item => (
                    <AIQueueItemCard 
                      key={item.assessment_id} 
                      item={item}
                      getStatusIcon={getStatusIcon}
                      getStatusBadgeClass={getStatusBadgeClass}
                      formatTime={formatTime}
                      getStatusLabel={getStatusLabel}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Pending */}
            {pendingItems.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Waiting for processing ({pendingItems.length})
                </h2>
                <div className="space-y-3">
                  {pendingItems.map(item => (
                    <AIQueueItemCard 
                      key={item.assessment_id} 
                      item={item}
                      getStatusIcon={getStatusIcon}
                      getStatusBadgeClass={getStatusBadgeClass}
                      formatTime={formatTime}
                      getStatusLabel={getStatusLabel}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Completed */}
            {completedItems.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Completed ({completedItems.length})
                </h2>
                <div className="space-y-3">
                  {completedItems.map(item => (
                    <AIQueueItemCard 
                      key={item.assessment_id} 
                      item={item}
                      getStatusIcon={getStatusIcon}
                      getStatusBadgeClass={getStatusBadgeClass}
                      formatTime={formatTime}
                      getStatusLabel={getStatusLabel}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Errors */}
            {errorItems.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                  With error ({errorItems.length})
                </h2>
                <div className="space-y-3">
                  {errorItems.map(item => (
                    <AIQueueItemCard 
                      key={item.assessment_id} 
                      item={item}
                      getStatusIcon={getStatusIcon}
                      getStatusBadgeClass={getStatusBadgeClass}
                      formatTime={formatTime}
                      getStatusLabel={getStatusLabel}
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

// Component card for each item in the queue
interface AIQueueItemCardProps {
  key?: number | string;
  item: AIQueueItem;
  getStatusIcon: (item: AIQueueItem) => React.ReactNode;
  getStatusBadgeClass: (item: AIQueueItem) => string;
  formatTime: (dateString: string | null) => string;
  getStatusLabel: (item: AIQueueItem) => string;
}

function AIQueueItemCard({ item, getStatusIcon, getStatusBadgeClass, formatTime, getStatusLabel }: AIQueueItemCardProps) {
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

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-gray-900 truncate">
              {item.title}
            </h3>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(item)}`}>
              {getStatusIcon(item)}
              <span>{getStatusLabel(item)}</span>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <ImageIcon className="w-4 h-4" />
              <span>{item.evidence_count} photo{item.evidence_count > 1 ? 's' : ''}</span>
            </div>
            <div>
              Created at {formatTime(item.created_at)}
            </div>
          </div>

          {/* Additional info based on status */}
          {item.ai_status === 'running' && item.started_at && (
            <div className="mt-2 text-sm text-blue-600">
              Started at {formatTime(item.started_at)}
            </div>
          )}
          
          {item.ai_status === 'succeeded' && item.confidence && (
            <div className="mt-2 text-sm text-emerald-600">
              Confidence: {item.confidence}
            </div>
          )}

          {item.error_message && (
            <div className="mt-2 text-sm text-red-600 line-clamp-2">
              Error: {item.error_message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
