import { create } from 'zustand';
import { SecureStorage } from '@/services/storage/secureStorage';
import { User, LoginResponse } from '@/types/auth';
import { authService } from '@/services/auth/authService';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }, keepSignedIn: boolean) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (credentials, keepSignedIn) => {
    set({ isLoading: true });
    try {
      const response = await authService.login(credentials);
      
      // Store tokens securely
      SecureStorage.setItem('auth_token', response.token, keepSignedIn);
      SecureStorage.setItem('refresh_token', response.refreshToken, keepSignedIn);
      
      set({ 
        user: response.user, 
        isAuthenticated: true, 
        isLoading: false 
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    authService.logout(); // Fire and forget
    SecureStorage.clear();
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    const token = SecureStorage.getItem('auth_token');
    
    if (!token) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      // Verify token/get user profile
      const user = await authService.me();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      SecureStorage.clear();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
