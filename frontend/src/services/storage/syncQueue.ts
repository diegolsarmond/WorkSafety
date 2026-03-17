/**
 * Fila de sincronização para operações offline
 * Gerencia items que precisam ser sincronizados quando online
 */

import { getItem, setItem, removeItem, getAllKeys } from './core';
import { STORAGE_KEYS } from './types';
import type { SyncQueueItem, OfflineInspection } from './types';

// Gera ID único
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Chave completa para item da fila
function getQueueItemKey(id: string): string {
  return `${STORAGE_KEYS.INSPECTIONS.SYNC_QUEUE}:${id}`;
}

/**
 * Adiciona item à fila de sincronização
 */
export async function addToSyncQueue(
  type: SyncQueueItem['type'],
  action: SyncQueueItem['action'],
  data: unknown,
  priority: SyncQueueItem['metadata']['priority'] = 'normal'
): Promise<SyncQueueItem> {
  const item: SyncQueueItem = {
    id: generateId(),
    type,
    action,
    data,
    metadata: {
      createdAt: new Date().toISOString(),
      attempts: 0,
      priority,
    },
    status: 'pending',
  };

  await setItem(getQueueItemKey(item.id), item);
  return item;
}

/**
 * Obtém item da fila
 */
export async function getQueueItem(id: string): Promise<SyncQueueItem | undefined> {
  return getItem<SyncQueueItem>(getQueueItemKey(id));
}

/**
 * Lista todos os items da fila
 */
export async function listQueueItems(
  filter?: {
    status?: SyncQueueItem['status'];
    type?: SyncQueueItem['type'];
  }
): Promise<SyncQueueItem[]> {
  const allKeys = await getAllKeys();
  const queueKeys = allKeys.filter(key => 
    key.startsWith(`${STORAGE_KEYS.INSPECTIONS.SYNC_QUEUE}:`)
  );

  const items: SyncQueueItem[] = [];

  for (const key of queueKeys) {
    const item = await getItem<SyncQueueItem>(key);
    if (!item) continue;

    if (filter?.status && item.status !== filter.status) continue;
    if (filter?.type && item.type !== filter.type) continue;

    items.push(item);
  }

  // Ordena por prioridade e data
  const priorityOrder = { high: 0, normal: 1, low: 2 };
  return items.sort((a, b) => {
    const priorityDiff = priorityOrder[a.metadata.priority] - priorityOrder[b.metadata.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.metadata.createdAt).getTime() - new Date(b.metadata.createdAt).getTime();
  });
}

/**
 * Atualiza status de um item
 */
export async function updateQueueItem(
  id: string,
  updates: Partial<Pick<SyncQueueItem, 'status' | 'data'>> & { error?: string }
): Promise<SyncQueueItem | undefined> {
  const item = await getQueueItem(id);
  if (!item) return undefined;

  if (updates.status) {
    item.status = updates.status;
    
    if (updates.status === 'processing') {
      item.metadata.attempts += 1;
      item.metadata.lastAttempt = new Date().toISOString();
    }
  }

  if (updates.data) {
    item.data = updates.data;
  }

  if (updates.error) {
    item.metadata.error = updates.error;
  }

  await setItem(getQueueItemKey(id), item);
  return item;
}

/**
 * Remove item da fila
 */
export async function removeFromQueue(id: string): Promise<void> {
  await removeItem(getQueueItemKey(id));
}

/**
 * Limpa items completados da fila
 */
export async function clearCompletedItems(): Promise<number> {
  const items = await listQueueItems({ status: 'completed' });
  await Promise.all(items.map(item => removeFromQueue(item.id)));
  return items.length;
}

/**
 * Obtém próximo item para processar
 */
export async function getNextPendingItem(): Promise<SyncQueueItem | undefined> {
  const pending = await listQueueItems({ status: 'pending' });
  return pending[0];
}

/**
 * Conta items na fila
 */
export async function getQueueCount(): Promise<{
  total: number;
  pending: number;
  processing: number;
  failed: number;
  completed: number;
}> {
  const all = await listQueueItems();
  
  return {
    total: all.length,
    pending: all.filter(i => i.status === 'pending').length,
    processing: all.filter(i => i.status === 'processing').length,
    failed: all.filter(i => i.status === 'failed').length,
    completed: all.filter(i => i.status === 'completed').length,
  };
}

// ============== INSPECTIONS OFFLINE ==============

/**
 * Gera ID local para inspeção offline
 */
export function generateLocalInspectionId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Salva inspeção offline
 */
export async function saveOfflineInspection(
  inspection: Omit<OfflineInspection, 'localId'>
): Promise<OfflineInspection> {
  const localId = inspection.id.startsWith('local_') 
    ? inspection.id 
    : generateLocalInspectionId();

  const fullInspection: OfflineInspection = {
    ...inspection,
    localId,
    data: {
      ...inspection.data,
      updatedAt: new Date().toISOString(),
    },
  };

  await setItem(`${STORAGE_KEYS.INSPECTIONS.DRAFTS}:${localId}`, fullInspection);
  return fullInspection;
}

/**
 * Obtém inspeção offline
 */
export async function getOfflineInspection(localId: string): Promise<OfflineInspection | undefined> {
  return getItem<OfflineInspection>(`${STORAGE_KEYS.INSPECTIONS.DRAFTS}:${localId}`);
}

/**
 * Lista inspeções offline
 */
export async function listOfflineInspections(
  filter?: { status?: OfflineInspection['status'] }
): Promise<OfflineInspection[]> {
  const allKeys = await getAllKeys();
  const draftKeys = allKeys.filter(key => 
    key.startsWith(`${STORAGE_KEYS.INSPECTIONS.DRAFTS}:`)
  );

  const inspections: OfflineInspection[] = [];

  for (const key of draftKeys) {
    const inspection = await getItem<OfflineInspection>(key);
    if (!inspection) continue;
    if (filter?.status && inspection.status !== filter.status) continue;
    inspections.push(inspection);
  }

  return inspections.sort((a, b) => 
    new Date(b.data.updatedAt).getTime() - new Date(a.data.updatedAt).getTime()
  );
}

/**
 * Atualiza inspeção offline
 */
export async function updateOfflineInspection(
  localId: string,
  updates: Partial<OfflineInspection['data']> & Partial<Pick<OfflineInspection, 'status' | 'syncAttempts' | 'lastError'>>
): Promise<OfflineInspection | undefined> {
  const inspection = await getOfflineInspection(localId);
  if (!inspection) return undefined;

  const updated: OfflineInspection = {
    ...inspection,
    status: updates.status ?? inspection.status,
    syncAttempts: updates.syncAttempts ?? inspection.syncAttempts,
    lastError: updates.lastError ?? inspection.lastError,
    data: {
      ...inspection.data,
      ...updates,
      updatedAt: new Date().toISOString(),
    },
  };

  await setItem(`${STORAGE_KEYS.INSPECTIONS.DRAFTS}:${localId}`, updated);
  return updated;
}

/**
 * Remove inspeção offline
 */
export async function deleteOfflineInspection(localId: string): Promise<void> {
  await removeItem(`${STORAGE_KEYS.INSPECTIONS.DRAFTS}:${localId}`);
}

/**
 * Marca inspeção como sincronizada
 */
export async function markInspectionAsSynced(localId: string, serverId: string): Promise<void> {
  const inspection = await getOfflineInspection(localId);
  if (inspection) {
    inspection.status = 'synced';
    inspection.id = serverId;
    await setItem(`${STORAGE_KEYS.INSPECTIONS.DRAFTS}:${localId}`, inspection);
  }
}

/**
 * Obtém estatísticas de inspeções offline
 */
export async function getOfflineInspectionStats(): Promise<{
  total: number;
  drafts: number;
  pending: number;
  syncing: number;
  synced: number;
  error: number;
}> {
  const all = await listOfflineInspections();
  
  return {
    total: all.length,
    drafts: all.filter(i => i.status === 'draft').length,
    pending: all.filter(i => i.status === 'pending').length,
    syncing: all.filter(i => i.status === 'syncing').length,
    synced: all.filter(i => i.status === 'synced').length,
    error: all.filter(i => i.status === 'error').length,
  };
}
