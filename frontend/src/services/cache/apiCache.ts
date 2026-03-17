/**
 * Cache de API para funcionamento offline
 * Armazena dados essenciais (empresas, usuários, etc) no IndexedDB
 */

import { setItem, getItem } from '../storage/core';
import { STORAGE_KEYS } from '../storage/types';

// Cache de empresas
export async function cacheCompanies(companies: unknown[]): Promise<void> {
  await setItem(STORAGE_KEYS.API_CACHE.COMPANIES, {
    data: companies,
    cachedAt: new Date().toISOString(),
  });
}

export async function getCachedCompanies<T>(): Promise<T[] | null> {
  const cached = await getItem<{ data: T[]; cachedAt: string }>(
    STORAGE_KEYS.API_CACHE.COMPANIES
  );
  return cached?.data || null;
}

// Cache de usuários
export async function cacheUsers(users: unknown[]): Promise<void> {
  await setItem(STORAGE_KEYS.API_CACHE.USERS, {
    data: users,
    cachedAt: new Date().toISOString(),
  });
}

export async function getCachedUsers<T>(): Promise<T[] | null> {
  const cached = await getItem<{ data: T[]; cachedAt: string }>(
    STORAGE_KEYS.API_CACHE.USERS
  );
  return cached?.data || null;
}

// Cache de tipos de risco
export async function cacheRiskTypes(riskTypes: unknown[]): Promise<void> {
  await setItem(STORAGE_KEYS.API_CACHE.RISK_TYPES, {
    data: riskTypes,
    cachedAt: new Date().toISOString(),
  });
}

export async function getCachedRiskTypes<T>(): Promise<T[] | null> {
  const cached = await getItem<{ data: T[]; cachedAt: string }>(
    STORAGE_KEYS.API_CACHE.RISK_TYPES
  );
  return cached?.data || null;
}

// Cache genérico
export async function cacheData<T>(key: string, data: T): Promise<void> {
  await setItem(`worksafety:cache:${key}`, {
    data,
    cachedAt: new Date().toISOString(),
  });
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  const cached = await getItem<{ data: T; cachedAt: string }>(
    `worksafety:cache:${key}`
  );
  return cached?.data || null;
}

// Limpa todo o cache
export async function clearApiCache(): Promise<void> {
  const keys = [
    STORAGE_KEYS.API_CACHE.COMPANIES,
    STORAGE_KEYS.API_CACHE.USERS,
    STORAGE_KEYS.API_CACHE.RISK_TYPES,
  ];
  
  await Promise.all(
    keys.map(key => setItem(key, null))
  );
}
