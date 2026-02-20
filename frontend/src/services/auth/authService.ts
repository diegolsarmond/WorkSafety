import { apiClient } from '@/services/api/apiClient';
import { LoginResponse, User } from '@/types/auth';

export const authService = {
  async login(credentials: { email: string; password: string }): Promise<LoginResponse> {
    // Mock implementation until backend is ready
    if (import.meta.env.DEV) {
      console.log('Mocking login for:', credentials.email);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate delay
      
      if (credentials.email === 'user@worksafety.gov' && credentials.password === 'password') {
        return {
          user: {
            id: '1',
            email: 'user@worksafety.gov',
            name: 'Alex Inspector',
            role: 'inspector',
            isActive: true,
          },
          token: 'mock-jwt-token',
          refreshToken: 'mock-refresh-token',
        };
      }
      throw new Error('Invalid credentials');
    }
    
    const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
    return response.data;
  },

  async logout(): Promise<void> {
    // Mock implementation
    if (import.meta.env.DEV) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return;
    }
    await apiClient.post('/auth/logout');
  },

  async me(): Promise<User> {
    // Mock implementation
    if (import.meta.env.DEV) {
      return {
        id: '1',
        email: 'user@worksafety.gov',
        name: 'Alex Inspector',
        role: 'inspector',
        isActive: true,
      };
    }
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  },
  
  async forgotPassword(email: string): Promise<void> {
     if (import.meta.env.DEV) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return;
     }
     await apiClient.post('/auth/forgot-password', { email });
  },

  async resetPassword(password: string, token: string): Promise<void> {
      if (import.meta.env.DEV) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return;
      }
      await apiClient.post('/auth/reset-password', { password, token });
  }
};
