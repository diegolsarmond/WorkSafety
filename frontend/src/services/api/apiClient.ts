import axios from 'axios';
import { env } from '@/config/env';
import { SecureStorage } from '@/services/storage/secureStorage';

export const apiClient = axios.create({
  baseURL: env.API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding the auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = SecureStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling 401 errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // We only want to handle 401s that are NOT from the login endpoint.
    // If login returns 401, it's just invalid credentials, not a token expiration.
    const isLoginRequest = originalRequest.url?.includes('/auth/login');
    const isRefreshRequest = originalRequest.url?.includes('/auth/token/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isLoginRequest && !isRefreshRequest) {
      originalRequest._retry = true;

      try {
        const refreshToken = SecureStorage.getItem('refresh_token');
        if (refreshToken) {
          // Attempt to refresh token
          const refreshUrl = env.API_URL.endsWith('/') ? `${env.API_URL}auth/token/refresh/` : `${env.API_URL}/auth/token/refresh/`;
          const refreshResponse = await axios.post(refreshUrl, { refresh: refreshToken });

          if (refreshResponse.data && refreshResponse.data.access) {
            const newAccessToken = refreshResponse.data.access;

            // Re-store keeping the same storage type as before
            const keepSignedIn = localStorage.getItem('auth_token') !== null;
            SecureStorage.setItem('auth_token', newAccessToken, keepSignedIn);

            // Update the failed request auth header
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

            // Retry the original request
            return apiClient(originalRequest);
          }
        }
      } catch (refreshError) {
        // If refresh fails, clear and logout
        SecureStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }

      // Default behavior if no refresh token or it fails
      SecureStorage.clear();
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);
