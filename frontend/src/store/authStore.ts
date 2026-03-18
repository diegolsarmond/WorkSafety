import { create } from 'zustand';
import { SecureStorage } from '@/services/storage/secureStorage';
import { User, LoginResponse } from '@/types/auth';
import { authService } from '@/services/auth/authService';
import { AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY } from '@/services/auth/authKeys';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  login: (credentials: { email: string; password: string }, keepSignedIn: boolean) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitializing: true,

  login: async (credentials, keepSignedIn) => {
    console.log('[AuthStore] login called with email:', credentials.email);
    set({ isLoading: true });
    try {
      const response = await authService.login(credentials);

      // Store tokens securely
      console.log('[AuthStore] Storing auth tokens (keepSignedIn:', keepSignedIn, ')');
      SecureStorage.setItem(AUTH_TOKEN_KEY, response.token, keepSignedIn);
      SecureStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken, keepSignedIn);

      console.log('[AuthStore] Login successful, user:', response.user.email);
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false
      });
    } catch (error: any) {
      console.error('[AuthStore] Login failed:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    authService.logout(); // Fire and forget
    SecureStorage.removeItem(AUTH_TOKEN_KEY);
    SecureStorage.removeItem(REFRESH_TOKEN_KEY);
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    console.log('[AuthStore] checkAuth called');
    set({ isInitializing: true });
    const token = SecureStorage.getItem(AUTH_TOKEN_KEY);

    if (!token) {
      console.log('[AuthStore] No auth token found - user not authenticated');
      set({ user: null, isAuthenticated: false, isInitializing: false });
      return;
    }

    console.log('[AuthStore] Token found, verifying with backend...');
    try {
      // Verify token/get user profile
      const user = await authService.me();
      console.log('[AuthStore] User verified successfully:', user.email);
      set({ user, isAuthenticated: true, isInitializing: false });
    } catch (error: any) {
      console.warn('[AuthStore] checkAuth failed:', error.status || error.message);
      // Clear corrupted/invalid tokens
      SecureStorage.removeItem(AUTH_TOKEN_KEY);
      SecureStorage.removeItem(REFRESH_TOKEN_KEY);
      set({ user: null, isAuthenticated: false, isInitializing: false });
    }
  },
}));
