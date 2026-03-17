/**
 * Hook para fazer requisições HTTP com suporte a offline
 * Quando offline, retorna dados do cache se disponíveis
 */

import { useCallback, useState } from 'react';
import { useOnlineStatus } from '@/services/sync/hooks';
import { getCachedData, cacheData } from '@/services/cache';

interface UseOfflineFetchOptions {
  cacheKey?: string;
  useCache?: boolean;
  cacheDuration?: number; // em minutos, padrão 60
}

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  fromCache: boolean;
}

export function useOfflineFetch<T>(options: UseOfflineFetchOptions = {}) {
  const { cacheKey, useCache = true, cacheDuration = 60 } = options;
  const { isOnline } = useOnlineStatus();
  
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: false,
    error: null,
    fromCache: false,
  });

  const fetch = useCallback(async (
    url: string,
    fetchOptions?: RequestInit
  ): Promise<T | null> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Se online, tenta buscar da rede
      if (isOnline) {
        try {
          const response = await window.fetch(url, {
            ...fetchOptions,
            headers: {
              'Content-Type': 'application/json',
              ...fetchOptions?.headers,
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          
          // Salva no cache se tiver cacheKey
          if (useCache && cacheKey) {
            await cacheData(cacheKey, data);
          }

          setState({
            data,
            loading: false,
            error: null,
            fromCache: false,
          });

          return data;
        } catch (networkError) {
          // Se falhou na rede, tenta cache
          if (useCache && cacheKey) {
            const cached = await getCachedData<T>(cacheKey);
            if (cached) {
              setState({
                data: cached,
                loading: false,
                error: null,
                fromCache: true,
              });
              return cached;
            }
          }
          throw networkError;
        }
      }

      // Se offline, tenta buscar do cache
      if (useCache && cacheKey) {
        const cached = await getCachedData<T>(cacheKey);
        if (cached) {
          setState({
            data: cached,
            loading: false,
            error: null,
            fromCache: true,
          });
          return cached;
        }
      }

      throw new Error('Você está offline e não há dados em cache');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState(prev => ({
        ...prev,
        loading: false,
        error: err,
        fromCache: false,
      }));
      return null;
    }
  }, [isOnline, cacheKey, useCache]);

  const clearCache = useCallback(async () => {
    if (cacheKey) {
      await cacheData(cacheKey, null);
    }
  }, [cacheKey]);

  return {
    ...state,
    fetch,
    clearCache,
    isOnline,
  };
}
