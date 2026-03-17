/**
 * Sistema de Armazenamento Local para PWA
 * 
 * IndexedDB-based storage para:
 * - Imagens (com compressão)
 * - Configurações e preferências
 * - Cache de API
 * - Estatísticas de storage
 * 
 * NOTA: Para sincronização de inspeções, use o SyncStore existente (@/store/syncStore)
 */

// Core
export {
  getItem,
  setItem,
  removeItem,
  removeItems,
  getAllKeys,
  clearAll,
  getStorageStats,
  hasEnoughSpace,
  cleanupStorage,
  onStorageEvent,
} from './core';

// Settings
export {
  getUserPreferences,
  setUserPreferences,
  getAppConfig,
  setAppConfig,
  setLastSync,
  getLastSync,
  saveAuthToken,
  getAuthToken,
  removeAuthToken,
  saveAuthUser,
  getAuthUser,
  clearAuthData,
  resetAllSettings,
} from './settingsStorage';

// Images
export {
  storeImage,
  getImage,
  getImageThumbnail,
  getImageMetadata,
  getImagePreviewUrl,
  getThumbnailPreviewUrl,
  listStoredImages,
  markImageAsSynced,
  deleteImage,
  deleteImages,
  getImageStats,
  cleanupSyncedImages,
} from './imageStorage';

// React Hooks
export {
  usePreferences,
  useAppConfig,
  useImages,
  useStorageStats,
} from './hooks';

// Types
export {
  STORAGE_KEYS,
  type UserPreferences,
  type AppConfig,
  type StoredImageMetadata,
  type StorageStats,
  type StorageEvent,
  type StorageEventHandler,
} from './types';
