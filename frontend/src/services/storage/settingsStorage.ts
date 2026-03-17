/**
 * Armazenamento de configurações e preferências
 */

import { getItem, setItem, removeItem } from './core';
import { STORAGE_KEYS } from './types';
import type { UserPreferences, AppConfig } from './types';

// Valores padrão
const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  language: 'pt-BR',
  notifications: true,
  autoSync: true,
  syncOnWifiOnly: false,
  maxImageQuality: 'medium',
  offlineMode: false,
  updatedAt: new Date().toISOString(),
};

const DEFAULT_CONFIG: AppConfig = {
  version: '1.0.0',
  apiUrl: '',
  maxImageSize: 10 * 1024 * 1024, // 10MB por imagem
  maxOfflineStorage: 100 * 1024 * 1024, // 100MB total
  compressionQuality: 0.7,
  updatedAt: new Date().toISOString(),
};

/**
 * Obtém preferências do usuário
 */
export async function getUserPreferences(): Promise<UserPreferences> {
  const stored = await getItem<UserPreferences>(STORAGE_KEYS.SETTINGS.USER_PREFERENCES);
  return stored ? { ...DEFAULT_PREFERENCES, ...stored } : DEFAULT_PREFERENCES;
}

/**
 * Salva preferências do usuário
 */
export async function setUserPreferences(
  preferences: Partial<UserPreferences>
): Promise<UserPreferences> {
  const current = await getUserPreferences();
  const updated: UserPreferences = {
    ...current,
    ...preferences,
    updatedAt: new Date().toISOString(),
  };
  await setItem(STORAGE_KEYS.SETTINGS.USER_PREFERENCES, updated);
  return updated;
}

/**
 * Obtém configurações do app
 */
export async function getAppConfig(): Promise<AppConfig> {
  const stored = await getItem<AppConfig>(STORAGE_KEYS.SETTINGS.APP_CONFIG);
  return stored ? { ...DEFAULT_CONFIG, ...stored } : DEFAULT_CONFIG;
}

/**
 * Salva configurações do app
 */
export async function setAppConfig(config: Partial<AppConfig>): Promise<AppConfig> {
  const current = await getAppConfig();
  const updated: AppConfig = {
    ...current,
    ...config,
    updatedAt: new Date().toISOString(),
  };
  await setItem(STORAGE_KEYS.SETTINGS.APP_CONFIG, updated);
  return updated;
}

/**
 * Salva timestamp da última sincronização
 */
export async function setLastSync(timestamp?: string): Promise<void> {
  await setItem(STORAGE_KEYS.SETTINGS.LAST_SYNC, timestamp || new Date().toISOString());
}

/**
 * Obtém timestamp da última sincronização
 */
export async function getLastSync(): Promise<string | undefined> {
  return getItem<string>(STORAGE_KEYS.SETTINGS.LAST_SYNC);
}

/**
 * Salva token de autenticação
 */
export async function saveAuthToken(token: string): Promise<void> {
  await setItem(STORAGE_KEYS.SETTINGS.AUTH_TOKEN, token);
}

/**
 * Obtém token de autenticação
 */
export async function getAuthToken(): Promise<string | undefined> {
  return getItem<string>(STORAGE_KEYS.SETTINGS.AUTH_TOKEN);
}

/**
 * Remove token de autenticação
 */
export async function removeAuthToken(): Promise<void> {
  await removeItem(STORAGE_KEYS.SETTINGS.AUTH_TOKEN);
}

/**
 * Salva dados do usuário autenticado
 */
export async function saveAuthUser(user: unknown): Promise<void> {
  await setItem(STORAGE_KEYS.SETTINGS.AUTH_USER, user);
}

/**
 * Obtém dados do usuário autenticado
 */
export async function getAuthUser<T>(): Promise<T | undefined> {
  return getItem<T>(STORAGE_KEYS.SETTINGS.AUTH_USER);
}

/**
 * Remove dados do usuário (logout)
 */
export async function clearAuthData(): Promise<void> {
  await Promise.all([
    removeItem(STORAGE_KEYS.SETTINGS.AUTH_TOKEN),
    removeItem(STORAGE_KEYS.SETTINGS.AUTH_USER),
  ]);
}

/**
 * Reseta todas as configurações
 */
export async function resetAllSettings(): Promise<void> {
  await Promise.all([
    removeItem(STORAGE_KEYS.SETTINGS.USER_PREFERENCES),
    removeItem(STORAGE_KEYS.SETTINGS.APP_CONFIG),
    removeItem(STORAGE_KEYS.SETTINGS.LAST_SYNC),
  ]);
}
