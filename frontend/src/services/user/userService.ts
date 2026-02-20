import { apiClient } from '@/services/api/apiClient';
import { User } from '@/types/auth';

export interface CreateUserDto {
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'inspector';
}

export interface UpdateUserDto {
  name?: string;
  role?: 'admin' | 'manager' | 'inspector';
  isActive?: boolean;
}

export const userService = {
  async getUsers(query?: string): Promise<User[]> {
    if (import.meta.env.DEV) {
      // Mock data
      await new Promise((resolve) => setTimeout(resolve, 500));
      const users: User[] = [
        { id: '1', email: 'user@worksafety.gov', name: 'Alex Inspector', role: 'inspector', isActive: true },
        { id: '2', email: 'manager@worksafety.gov', name: 'Sarah Manager', role: 'manager', isActive: true },
        { id: '3', email: 'admin@worksafety.gov', name: 'Admin User', role: 'admin', isActive: true },
        { id: '4', email: 'inactive@worksafety.gov', name: 'Inactive User', role: 'inspector', isActive: false },
      ];
      
      if (query) {
        const lowerQuery = query.toLowerCase();
        return users.filter(u => 
          u.name.toLowerCase().includes(lowerQuery) || 
          u.email.toLowerCase().includes(lowerQuery)
        );
      }
      return users;
    }
    const response = await apiClient.get<User[]>('/users', { params: { q: query } });
    return response.data;
  },

  async createUser(data: CreateUserDto): Promise<User> {
    if (import.meta.env.DEV) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return {
        id: Math.random().toString(36).substr(2, 9),
        ...data,
        isActive: true,
      };
    }
    const response = await apiClient.post<User>('/users', data);
    return response.data;
  },

  async updateUser(id: string, data: UpdateUserDto): Promise<User> {
    if (import.meta.env.DEV) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return {
        id,
        email: 'updated@example.com', // Mock
        name: data.name || 'Updated Name',
        role: data.role || 'inspector',
        isActive: data.isActive ?? true,
      };
    }
    const response = await apiClient.patch<User>(`/users/${id}`, data);
    return response.data;
  },

  async deleteUser(id: string): Promise<void> {
    if (import.meta.env.DEV) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return;
    }
    await apiClient.delete(`/users/${id}`);
  }
};
