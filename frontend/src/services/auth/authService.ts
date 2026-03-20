import { apiClient } from '@/services/api/apiClient';
import { SecureStorage } from '@/services/storage/secureStorage';
import { LoginResponse, User } from '@/types/auth';
import { REFRESH_TOKEN_KEY } from '@/services/auth/authKeys';
import axios from 'axios';

const LOGIN_TIMEOUT_MS = 30000;
const LOGIN_RETRY_DELAY_MS = 1500;

export const authService = {
  async login(credentials: { email: string; password: string }): Promise<LoginResponse> {
    try {
      const response = await apiClient.post('auth/login/', credentials, {
        timeout: LOGIN_TIMEOUT_MS,
      });
      const data = response.data;
      return {
        user: data.user,
        token: data.access,
        refreshToken: data.refresh,
      };
    } catch (error) {
      // First request after idle/redeploy may be slower; retry once on timeout only.
      if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
        await new Promise((resolve) => setTimeout(resolve, LOGIN_RETRY_DELAY_MS));
        const retryResponse = await apiClient.post('auth/login/', credentials, {
          timeout: LOGIN_TIMEOUT_MS,
        });
        const retryData = retryResponse.data;
        return {
          user: retryData.user,
          token: retryData.access,
          refreshToken: retryData.refresh,
        };
      }
      throw error;
    }
  },

  async logout(): Promise<void> {
    const refreshToken = SecureStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      await apiClient.post('auth/logout/', { refresh: refreshToken });
    }
  },

  async me(): Promise<User> {
    const response = await apiClient.get<User>('auth/me/');
    return response.data;
  },

  async forgotPassword(email: string): Promise<void> {
    await apiClient.post('auth/password-reset/', { email });
  },

  async resetPassword(password: string, token: string): Promise<void> {
    // Typically URL looks like /auth/password-reset/confirm/ with body { uidb64, token, new_password }
    // The frontend must pass uidb64 and token somewhere. 
    // Need to adjust this if `resetPassword` takes token as composite or separate parameters.
    // We will assume `token` here includes what backend needs if it was adjusted, else we pass as new_password and token.
    // Wait, let's keep it simple and just do the call as the backend expects, though the method signature only has `token`.
    // The plan didn't specify changing this signature, so I'll put a placeholder or adapt it based on typical usage.
    throw new Error('Full reset implementation requires uidb64 from the URL.');
  }
};
