/**
 * React Hooks para o sistema de armazenamento
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getUserPreferences,
  setUserPreferences,
  getAppConfig,
  setAppConfig,
} from './settingsStorage';
import {
  storeImage,
  getImage,
  getImageMetadata,
  getImagePreviewUrl,
  listStoredImages,
  deleteImage,
  getImageStats,
} from './imageStorage';
import {
  saveOfflineInspection,
  getOfflineInspection,
  listOfflineInspections,
  updateOfflineInspection,
  deleteOfflineInspection,
  getOfflineInspectionStats,
  addToSyncQueue,
  listQueueItems,
  getQueueCount,
  clearCompletedItems,
} from './syncQueue';
import { getStorageStats, cleanupStorage, onStorageEvent } from './core';
import type {
  UserPreferences,
  AppConfig,
  StoredImageMetadata,
  OfflineInspection,
  SyncQueueItem,
  StorageStats,
} from './types';

// ============== PREFERENCES HOOK ==============

interface UsePreferencesReturn {
  preferences: UserPreferences | null;
  loading: boolean;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
}

export function usePreferences(): UsePreferencesReturn {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserPreferences().then(prefs => {
      setPreferences(prefs);
      setLoading(false);
    });
  }, []);

  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    const updated = await setUserPreferences(updates);
    setPreferences(updated);
  }, []);

  return { preferences, loading, updatePreferences };
}

// ============== APP CONFIG HOOK ==============

interface UseAppConfigReturn {
  config: AppConfig | null;
  loading: boolean;
  updateConfig: (updates: Partial<AppConfig>) => Promise<void>;
}

export function useAppConfig(): UseAppConfigReturn {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAppConfig().then(cfg => {
      setConfig(cfg);
      setLoading(false);
    });
  }, []);

  const updateConfig = useCallback(async (updates: Partial<AppConfig>) => {
    const updated = await setAppConfig(updates);
    setConfig(updated);
  }, []);

  return { config, loading, updateConfig };
}

// ============== IMAGES HOOK ==============

interface UseImagesReturn {
  images: StoredImageMetadata[];
  loading: boolean;
  refresh: () => Promise<void>;
  storeImage: (
    file: File | Blob,
    options?: Parameters<typeof storeImage>[1]
  ) => Promise<StoredImageMetadata>;
  deleteImage: (id: string) => Promise<void>;
  getPreviewUrl: (id: string) => Promise<string | null>;
  stats: {
    total: number;
    totalSize: number;
    synced: number;
    unsynced: number;
  } | null;
}

export function useImages(filter?: Parameters<typeof listStoredImages>[0]): UseImagesReturn {
  const [images, setImages] = useState<StoredImageMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UseImagesReturn['stats']>(null);
  const filterRef = useRef(filter);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [imgs, imageStats] = await Promise.all([
      listStoredImages(filterRef.current),
      getImageStats(),
    ]);
    setImages(imgs);
    setStats(imageStats);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleStoreImage = useCallback(
    async (file: File | Blob, options?: Parameters<typeof storeImage>[1]) => {
      const metadata = await storeImage(file, options);
      await refresh();
      return metadata;
    },
    [refresh]
  );

  const handleDeleteImage = useCallback(
    async (id: string) => {
      await deleteImage(id);
      await refresh();
    },
    [refresh]
  );

  const getPreviewUrl = useCallback(async (id: string) => {
    return getImagePreviewUrl(id);
  }, []);

  return {
    images,
    loading,
    refresh,
    storeImage: handleStoreImage,
    deleteImage: handleDeleteImage,
    getPreviewUrl,
    stats,
  };
}

// ============== OFFLINE INSPECTIONS HOOK ==============

interface UseOfflineInspectionsReturn {
  inspections: OfflineInspection[];
  loading: boolean;
  refresh: () => Promise<void>;
  saveInspection: (
    inspection: Omit<OfflineInspection, 'localId'>
  ) => Promise<OfflineInspection>;
  getInspection: (localId: string) => Promise<OfflineInspection | undefined>;
  updateInspection: (
    localId: string,
    updates: Parameters<typeof updateOfflineInspection>[1]
  ) => Promise<OfflineInspection | undefined>;
  deleteInspection: (localId: string) => Promise<void>;
  stats: {
    total: number;
    drafts: number;
    pending: number;
    syncing: number;
    synced: number;
    error: number;
  } | null;
}

export function useOfflineInspections(
  filter?: Parameters<typeof listOfflineInspections>[0]
): UseOfflineInspectionsReturn {
  const [inspections, setInspections] = useState<OfflineInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UseOfflineInspectionsReturn['stats']>(null);
  const filterRef = useRef(filter);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [items, itemStats] = await Promise.all([
      listOfflineInspections(filterRef.current),
      getOfflineInspectionStats(),
    ]);
    setInspections(items);
    setStats(itemStats);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveInspection = useCallback(
    async (inspection: Omit<OfflineInspection, 'localId'>) => {
      const saved = await saveOfflineInspection(inspection);
      await refresh();
      return saved;
    },
    [refresh]
  );

  const getInspection = useCallback(async (localId: string) => {
    return getOfflineInspection(localId);
  }, []);

  const updateInspection = useCallback(
    async (localId: string, updates: Parameters<typeof updateOfflineInspection>[1]) => {
      const updated = await updateOfflineInspection(localId, updates);
      await refresh();
      return updated;
    },
    [refresh]
  );

  const deleteInspection = useCallback(
    async (localId: string) => {
      await deleteOfflineInspection(localId);
      await refresh();
    },
    [refresh]
  );

  return {
    inspections,
    loading,
    refresh,
    saveInspection,
    getInspection,
    updateInspection,
    deleteInspection,
    stats,
  };
}

// ============== SYNC QUEUE HOOK ==============

interface UseSyncQueueReturn {
  items: SyncQueueItem[];
  loading: boolean;
  refresh: () => Promise<void>;
  addToQueue: (
    type: SyncQueueItem['type'],
    action: SyncQueueItem['action'],
    data: unknown,
    priority?: SyncQueueItem['metadata']['priority']
  ) => Promise<SyncQueueItem>;
  clearCompleted: () => Promise<number>;
  count: {
    total: number;
    pending: number;
    processing: number;
    failed: number;
    completed: number;
  } | null;
}

export function useSyncQueue(
  filter?: Parameters<typeof listQueueItems>[0]
): UseSyncQueueReturn {
  const [items, setItems] = useState<SyncQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState<UseSyncQueueReturn['count']>(null);
  const filterRef = useRef(filter);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [queueItems, queueCount] = await Promise.all([
      listQueueItems(filterRef.current),
      getQueueCount(),
    ]);
    setItems(queueItems);
    setCount(queueCount);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addToQueue = useCallback(
    async (
      type: SyncQueueItem['type'],
      action: SyncQueueItem['action'],
      data: unknown,
      priority?: SyncQueueItem['metadata']['priority']
    ) => {
      const item = await addToSyncQueue(type, action, data, priority);
      await refresh();
      return item;
    },
    [refresh]
  );

  const clearCompleted = useCallback(async () => {
    const cleared = await clearCompletedItems();
    await refresh();
    return cleared;
  }, [refresh]);

  return {
    items,
    loading,
    refresh,
    addToQueue,
    clearCompleted,
    count,
  };
}

// ============== STORAGE STATS HOOK ==============

interface UseStorageStatsReturn {
  stats: StorageStats | null;
  loading: boolean;
  refresh: () => Promise<void>;
  cleanup: (options?: Parameters<typeof cleanupStorage>[0]) => Promise<number>;
}

export function useStorageStats(): UseStorageStatsReturn {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const storageStats = await getStorageStats();
    setStats(storageStats);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Ouve eventos de storage
  useEffect(() => {
    return onStorageEvent(event => {
      if (event.type === 'quota_warning' || event.type === 'quota_exceeded') {
        refresh();
      }
    });
  }, [refresh]);

  const cleanup = useCallback(
    async (options?: Parameters<typeof cleanupStorage>[0]) => {
      const freed = await cleanupStorage(options);
      await refresh();
      return freed;
    },
    [refresh]
  );

  return { stats, loading, refresh, cleanup };
}
