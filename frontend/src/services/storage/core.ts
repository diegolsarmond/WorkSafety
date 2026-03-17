/**
 * Core do sistema de armazenamento IndexedDB
 * Wrapper sobre idb-keyval com funcionalidades adicionais
 */

import { get, set, del, keys, clear, createStore } from 'idb-keyval';
import type { StorageStats, StorageEvent, StorageEventHandler } from './types';

// Store personalizado para o WorkSafety
const worksafetyStore = createStore('worksafety-db', 'keyval');

// Listeners de eventos
const eventListeners: StorageEventHandler[] = [];

/**
 * Adiciona um listener para eventos de storage
 */
export function onStorageEvent(handler: StorageEventHandler): () => void {
  eventListeners.push(handler);
  return () => {
    const index = eventListeners.indexOf(handler);
    if (index > -1) {
      eventListeners.splice(index, 1);
    }
  };
}

/**
 * Emite um evento para todos os listeners
 */
function emitEvent(event: StorageEvent): void {
  eventListeners.forEach(handler => {
    try {
      handler(event);
    } catch (error) {
      console.error('Erro em listener de storage:', error);
    }
  });
}

/**
 * Obtém um valor do storage
 */
export async function getItem<T>(key: string): Promise<T | undefined> {
  try {
    return await get<T>(key, worksafetyStore);
  } catch (error) {
    console.error(`Erro ao ler '${key}' do storage:`, error);
    emitEvent({
      type: 'error',
      message: `Falha ao ler dados: ${key}`,
      data: error,
    });
    return undefined;
  }
}

/**
 * Salva um valor no storage
 */
export async function setItem<T>(key: string, value: T): Promise<void> {
  try {
    await set(key, value, worksafetyStore);
    
    // Verifica quota após escrita
    checkQuota();
  } catch (error) {
    console.error(`Erro ao salvar '${key}' no storage:`, error);
    
    // Verifica se é erro de quota
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      emitEvent({
        type: 'quota_exceeded',
        message: 'Espaço de armazenamento excedido',
        data: { key },
      });
    } else {
      emitEvent({
        type: 'error',
        message: `Falha ao salvar dados: ${key}`,
        data: error,
      });
    }
    
    throw error;
  }
}

/**
 * Remove um valor do storage
 */
export async function removeItem(key: string): Promise<void> {
  try {
    await del(key, worksafetyStore);
  } catch (error) {
    console.error(`Erro ao remover '${key}' do storage:`, error);
    throw error;
  }
}

/**
 * Remove múltiplos valores do storage
 */
export async function removeItems(keysToRemove: string[]): Promise<void> {
  await Promise.all(keysToRemove.map(key => removeItem(key)));
}

/**
 * Lista todas as chaves do storage
 */
export async function getAllKeys(): Promise<string[]> {
  try {
    return await keys(worksafetyStore) as string[];
  } catch (error) {
    console.error('Erro ao listar chaves do storage:', error);
    return [];
  }
}

/**
 * Limpa todo o storage
 */
export async function clearAll(): Promise<void> {
  try {
    await clear(worksafetyStore);
    emitEvent({
      type: 'sync_needed',
      message: 'Storage limpo - sincronização necessária',
    });
  } catch (error) {
    console.error('Erro ao limpar storage:', error);
    throw error;
  }
}

/**
 * Obtém estatísticas de uso do storage
 */
export async function getStorageStats(): Promise<StorageStats> {
  try {
    const allKeys = await getAllKeys();
    let totalUsed = 0;
    const byCategory = {
      images: 0,
      inspections: 0,
      cache: 0,
      other: 0,
    };

    // Estimativa de tamanho baseada nas chaves
    for (const key of allKeys) {
      try {
        const value = await get(key, worksafetyStore);
        const size = estimateSize(value);
        totalUsed += size;

        // Categoriza
        if (key.includes('image')) {
          byCategory.images += size;
        } else if (key.includes('inspection')) {
          byCategory.inspections += size;
        } else if (key.includes('cache')) {
          byCategory.cache += size;
        } else {
          byCategory.other += size;
        }
      } catch {
        // Ignora erros individuais
      }
    }

    // Obtém quota disponível (se suportado)
    let available = 0;
    let total = 0;
    
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      available = estimate.usageDetails?.indexedDB || estimate.usage || 0;
      total = estimate.quota || 0;
    }

    return {
      used: totalUsed,
      available: total - totalUsed,
      total,
      byCategory,
    };
  } catch (error) {
    console.error('Erro ao calcular estatísticas:', error);
    return {
      used: 0,
      available: 0,
      total: 0,
      byCategory: { images: 0, inspections: 0, cache: 0, other: 0 },
    };
  }
}

/**
 * Estima o tamanho de um valor em bytes
 */
function estimateSize(value: unknown): number {
  if (value === null || value === undefined) return 0;
  
  try {
    const str = JSON.stringify(value);
    // Aproximação: 2 bytes por caractere (UTF-16)
    return str.length * 2;
  } catch {
    // Se não for serializável (ex: Blob), estima
    if (value instanceof Blob) {
      return value.size;
    }
    if (value instanceof ArrayBuffer) {
      return value.byteLength;
    }
    return 0;
  }
}

/**
 * Verifica se está próximo do limite de quota
 */
async function checkQuota(): Promise<void> {
  if (!('storage' in navigator)) return;

  try {
    const estimate = await navigator.storage.estimate();
    const used = estimate.usage || 0;
    const quota = estimate.quota || Infinity;
    const percentUsed = (used / quota) * 100;

    if (percentUsed > 90) {
      emitEvent({
        type: 'quota_exceeded',
        message: `Espaço quase cheio (${percentUsed.toFixed(1)}%)`,
        data: { used, quota, percentUsed },
      });
    } else if (percentUsed > 75) {
      emitEvent({
        type: 'quota_warning',
        message: `Espaço acima de 75% (${percentUsed.toFixed(1)}%)`,
        data: { used, quota, percentUsed },
      });
    }
  } catch (error) {
    console.debug('Não foi possível verificar quota:', error);
  }
}

/**
 * Verifica se há espaço suficiente
 */
export async function hasEnoughSpace(requiredBytes: number): Promise<boolean> {
  try {
    const stats = await getStorageStats();
    return stats.available >= requiredBytes;
  } catch {
    return true; // Assume que sim se não conseguir verificar
  }
}

/**
 * Limpa dados antigos/libera espaço
 */
export async function cleanupStorage(
  options: {
    keepInspections?: number;
    keepImages?: number;
    clearCache?: boolean;
  } = {}
): Promise<number> {
  const { keepInspections = 10, keepImages = 50, clearCache = true } = options;
  
  let freed = 0;
  const allKeys = await getAllKeys();

  // Limpa cache se solicitado
  if (clearCache) {
    const cacheKeys = allKeys.filter(k => k.includes('cache'));
    for (const key of cacheKeys) {
      const value = await getItem(key);
      if (value) {
        freed += estimateSize(value);
        await removeItem(key);
      }
    }
  }

  // Limpa imagens antigas (mantém as mais recentes)
  const imageKeys = allKeys.filter(k => k.startsWith('worksafety:image_blob:'));
  if (imageKeys.length > keepImages) {
    // Ordena por ID (assume que inclui timestamp)
    const sorted = imageKeys.sort().reverse();
    const toRemove = sorted.slice(keepImages);
    
    for (const key of toRemove) {
      const value = await getItem(key);
      if (value) {
        freed += estimateSize(value);
        await removeItem(key);
        // Remove também o metadata
        const imageId = key.replace('worksafety:image_blob:', '');
        await removeItem(`worksafety:images_metadata:${imageId}`);
      }
    }
  }

  emitEvent({
    type: 'sync_needed',
    message: `Limpeza realizada. ${(freed / 1024 / 1024).toFixed(2)} MB liberados.`,
    data: { freed },
  });

  return freed;
}
