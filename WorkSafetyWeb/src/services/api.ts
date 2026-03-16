/**
 * API Client para integração com o backend Django
 * Base URL: http://localhost:3001
 */

import { SecureStorage } from './storage/secureStorage';
export { SecureStorage };

// Use URL relativa para passar pelo proxy do server.ts
// ou configure VITE_API_URL para apontar diretamente para o Django
const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';

// Tipos de dados da API
export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'inspector';
  isActive: boolean;
  is_active: boolean;
  is_staff: boolean;
  date_joined?: string;
}

export interface CreateUserData {
  email: string;
  password: string;
  is_staff?: boolean;
  is_active?: boolean;
}

export interface UpdateUserData {
  is_active?: boolean;
  is_staff?: boolean;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

// Classe de erro da API
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Função para obter o token de acesso (usa SecureStorage - compatível com app principal)
export function getAccessToken(): string | null {
  return SecureStorage.getItem('auth_token');
}

// Função para obter o refresh token (usa SecureStorage - compatível com app principal)
export function getRefreshToken(): string | null {
  return SecureStorage.getItem('refresh_token');
}

// Função para salvar tokens (usa SecureStorage - compatível com app principal)
export function setTokens(access: string, refresh: string, keepSignedIn: boolean = false): void {
  SecureStorage.setItem('auth_token', access, keepSignedIn);
  SecureStorage.setItem('refresh_token', refresh, keepSignedIn);
}

// Função para limpar tokens (logout)
export function clearTokens(): void {
  SecureStorage.clear();
}

// Função para verificar se está autenticado
export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

// Função para obter o usuário atual
export function getCurrentUser(): User | null {
  const userStr = SecureStorage.getItem('user');
  if (userStr) {
    try {
      return JSON.parse(userStr) as User;
    } catch {
      return null;
    }
  }
  return null;
}

// Função para salvar o usuário atual
export function setCurrentUser(user: User, keepSignedIn: boolean = false): void {
  SecureStorage.setItem('user', JSON.stringify(user), keepSignedIn);
}

// Função helper para fazer fetch com token de autenticação
export async function fetchWithToken(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAccessToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });
}

// Função de fetch com retry para refresh token
async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAccessToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  // Se o token expirou (401), tenta refresh
  if (response.status === 401 && getRefreshToken()) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      return fetch(`${API_BASE_URL}${url}`, {
        ...options,
        headers,
      });
    }
  }

  return response;
}

// Função para refresh do token
async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });

    if (response.ok) {
      const data = await response.json();
      const keepSignedIn = localStorage.getItem('auth_token') !== null;
      SecureStorage.setItem('auth_token', data.access, keepSignedIn);
      return data.access;
    }
  } catch {
    // Falha silenciosa
  }
  
  clearTokens();
  return null;
}

// Serviço de Autenticação
export const authService = {
  async login(data: LoginData): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(
        error.detail || 'Erro ao fazer login',
        response.status,
        error
      );
    }

    const result = await response.json();
    const keepSignedIn = true; // Login do admin sempre mantém sessão
    setTokens(result.access, result.refresh, keepSignedIn);
    setCurrentUser(result.user, keepSignedIn);
    return result;
  },

  async logout(): Promise<void> {
    const refresh = getRefreshToken();
    if (refresh) {
      try {
        await fetch(`${API_BASE_URL}/api/auth/logout/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh }),
        });
      } catch {
        // Ignora erro no logout
      }
    }
    clearTokens();
  },

  async me(): Promise<User> {
    const response = await fetchWithAuth('/api/auth/me/');
    
    if (!response.ok) {
      throw new ApiError('Erro ao obter dados do usuário', response.status);
    }

    const user = await response.json();
    setCurrentUser(user);
    return user;
  },
};

// Serviço de Usuários
export const userService = {
  async list(): Promise<User[]> {
    const response = await fetchWithAuth('/api/users/');
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(
        error.detail || 'Erro ao listar usuários',
        response.status,
        error
      );
    }

    return response.json();
  },

  async get(id: number): Promise<User> {
    const response = await fetchWithAuth(`/api/users/${id}/`);
    
    if (!response.ok) {
      throw new ApiError('Erro ao buscar usuário', response.status);
    }

    return response.json();
  },

  async create(data: CreateUserData): Promise<User> {
    const response = await fetchWithAuth('/api/users/', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(
        error.detail || 'Erro ao criar usuário',
        response.status,
        error
      );
    }

    return response.json();
  },

  async update(id: number, data: UpdateUserData): Promise<User> {
    const response = await fetchWithAuth(`/api/users/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(
        error.detail || 'Erro ao atualizar usuário',
        response.status,
        error
      );
    }

    return response.json();
  },

  async deactivate(id: number): Promise<void> {
    return this.update(id, { is_active: false });
  },

  async activate(id: number): Promise<void> {
    return this.update(id, { is_active: true });
  },
};

export default {
  auth: authService,
  users: userService,
};
