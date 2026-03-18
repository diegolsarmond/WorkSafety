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
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url} - Auth header added`);
    } else {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url} - No auth token`);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling 401 errors
apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API] ${response.status} ${response.config.url}`);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    console.warn(`[API] Error ${error.response?.status} on ${originalRequest.url}`);

    // We only want to handle 401s that are NOT from the login endpoint.
    // If login returns 401, it's just invalid credentials, not a token expiration.
    const isLoginRequest = originalRequest.url?.includes('/auth/login');
    const isRefreshRequest = originalRequest.url?.includes('/auth/token/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isLoginRequest && !isRefreshRequest) {
      console.log('[API] Got 401, attempting token refresh...');
      originalRequest._retry = true;

      try {
        const refreshToken = SecureStorage.getItem('refresh_token');
        if (refreshToken) {
          // Attempt to refresh token
          const refreshUrl = env.API_URL.endsWith('/') ? `${env.API_URL}auth/token/refresh/` : `${env.API_URL}/auth/token/refresh/`;
          const refreshResponse = await axios.post(refreshUrl, { refresh: refreshToken });

          if (refreshResponse.data && refreshResponse.data.access) {
            const newAccessToken = refreshResponse.data.access;
            console.log('[API] Token refreshed successfully');

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
        console.error('[API] Token refresh failed, logging out');
        SecureStorage.clear();
        window.location.href = '/worksafety/login';
        return Promise.reject(refreshError);
      }

      // Default behavior if no refresh token or it fails
      console.error('[API] No refresh token, clearing storage and redirecting to login');
      SecureStorage.clear();
      window.location.href = '/worksafety/login';
    }

    return Promise.reject(error);
  }
);
