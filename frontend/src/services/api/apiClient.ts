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
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Clear token and redirect to login
      SecureStorage.clear();
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);
