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

    if (error.response?.status === 401 && !originalRequest._retry && !isLoginRequest) {
      originalRequest._retry = true;

      // Clear token and redirect to login only if it wasn't a login request
      SecureStorage.clear();
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);
