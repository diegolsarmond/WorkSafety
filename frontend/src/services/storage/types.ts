/**
 * Tipos para o sistema de armazenamento local (PWA)
 */

// Chaves de storage organizadas por domínio
export const STORAGE_KEYS = {
  // Configurações e preferências do usuário
  SETTINGS: {
    USER_PREFERENCES: 'worksafety:user_preferences',
    APP_CONFIG: 'worksafety:app_config',
    LAST_SYNC: 'worksafety:last_sync',
    AUTH_TOKEN: 'worksafety:auth_token',
    AUTH_USER: 'worksafety:auth_user',
  },
  
  // Dados de inspeções
  INSPECTIONS: {
    PENDING: 'worksafety:inspections_pending',
    DRAFTS: 'worksafety:inspections_drafts',
    SYNC_QUEUE: 'worksafety:inspections_sync_queue',
  },
  
  // Imagens e mídia
  IMAGES: {
    METADATA: 'worksafety:images_metadata',
    BLOB_PREFIX: 'worksafety:image_blob:',
    THUMBNAIL_PREFIX: 'worksafety:image_thumb:',
  },
  
  // Cache de API
  API_CACHE: {
    USERS: 'worksafety:cache_users',
    COMPANIES: 'worksafety:cache_companies',
    RISK_TYPES: 'worksafety:cache_risk_types',
  },
} as const;

// Tipo para preferências do usuário
export interface UserPreferences {
  theme: 'dark' | 'light' | 'system';
  language: string;
  notifications: boolean;
  autoSync: boolean;
  syncOnWifiOnly: boolean;
  maxImageQuality: 'high' | 'medium' | 'low';
  offlineMode: boolean;
  updatedAt: string;
}

// Tipo para configurações do app
export interface AppConfig {
  version: string;
  apiUrl: string;
  maxImageSize: number; // em bytes
  maxOfflineStorage: number; // em bytes
  compressionQuality: number; // 0-1
  updatedAt: string;
}

// Metadados de imagem armazenada
export interface StoredImageMetadata {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  inspectionId?: string;
  createdAt: string;
  synced: boolean;
  compressed: boolean;
  tags?: string[];
}

// Item na fila de sincronização
export interface SyncQueueItem {
  id: string;
  type: 'inspection' | 'image' | 'report' | 'settings';
  action: 'create' | 'update' | 'delete';
  data: unknown;
  metadata: {
    createdAt: string;
    attempts: number;
    lastAttempt?: string;
    error?: string;
    priority: 'high' | 'normal' | 'low';
  };
  status: 'pending' | 'processing' | 'failed' | 'completed';
}

// Dados de inspeção offline
export interface OfflineInspection {
  id: string;
  localId: string;
  companyId: string;
  companyName?: string;
  areaId?: string;
  areaName?: string;
  status: 'draft' | 'pending' | 'syncing' | 'synced' | 'error';
  data: {
    title: string;
    description?: string;
    risks: RiskItem[];
    images: string[]; // IDs das imagens
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
  };
  syncAttempts: number;
  lastError?: string;
}

export interface RiskItem {
  id: string;
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location?: string;
  recommendation?: string;
}

// Estatísticas de storage
export interface StorageStats {
  used: number;
  available: number;
  total: number;
  byCategory: {
    images: number;
    inspections: number;
    cache: number;
    other: number;
  };
}

// Eventos de storage
export interface StorageEvent {
  type: 'quota_warning' | 'quota_exceeded' | 'sync_needed' | 'error';
  message: string;
  data?: unknown;
}

export type StorageEventHandler = (event: StorageEvent) => void;
