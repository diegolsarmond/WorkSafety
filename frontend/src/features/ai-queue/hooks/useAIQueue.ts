import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/api/apiClient';

export interface AIQueueItem {
  assessment_id: number;
  title: string;
  status: string;
  status_display: string;
  ai_status: string;
  ai_status_display: string;
  confidence: string;
  error_message: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  evidence_count: number;
  thumbnail_url: string;
}

export interface AIQueueCounts {
  pending: number;
  processing: number;
  completed: number;
  error: number;
  total: number;
}

export interface UseAIQueueReturn {
  queue: AIQueueItem[];
  counts: AIQueueCounts;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook para gerenciar a fila de processamento de IA
 * 
 * Features:
 * - Lista jobs de processamento IA do backend
 * - Atualizações periódicas
 * - Contadores por status
 */
export function useAIQueue(): UseAIQueueReturn {
  const [queue, setQueue] = useState<AIQueueItem[]>([]);
  const [counts, setCounts] = useState<AIQueueCounts>({
    pending: 0,
    processing: 0,
    completed: 0,
    error: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    // Don't try to fetch when offline
    if (!navigator.onLine) {
      setIsLoading(false);
      setError('You are offline');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.get('assessments/ai-queue/');

      setQueue(response.data.queue || []);
      setCounts(response.data.counts || {
        pending: 0,
        processing: 0,
        completed: 0,
        error: 0,
        total: 0,
      });
    } catch (err) {
      // If went offline during request, don't show error
      if (!navigator.onLine) {
        setError('You are offline');
      } else {
        setError('Error loading AI processing queue');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Carrega inicialmente e configura polling
  useEffect(() => {
    fetchQueue();

    // Atualiza a cada 5 segundos para mostrar progresso
    const intervalId = setInterval(() => {
      fetchQueue();
    }, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchQueue]);

  return {
    queue,
    counts,
    isLoading,
    error,
    refresh: fetchQueue,
  };
}
