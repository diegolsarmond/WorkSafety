export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'inspector';
  isActive: boolean;
}

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
