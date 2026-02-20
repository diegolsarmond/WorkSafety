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
    const response = await apiClient.get<User[]>('/users/', { params: { search: query } });
    return response.data;
  },

  async createUser(data: CreateUserDto): Promise<User> {
    const requestData = {
      email: data.email,
      password: "DefaultPassword123!", // Temporary as createUserDto lacks password
      name: data.name,
      role: data.role,
      is_staff: data.role === 'admin'
    };
    const response = await apiClient.post<User>('/users/', requestData);
    return response.data;
  },

  async updateUser(id: string, data: UpdateUserDto): Promise<User> {
    const requestData: any = {};
    if (data.name !== undefined) requestData.name = data.name;
    if (data.role !== undefined) requestData.is_staff = data.role === 'admin';
    if (data.isActive !== undefined) requestData.is_active = data.isActive;

    const response = await apiClient.patch<User>(`/users/${id}/`, requestData);
    return response.data;
  },

  async deleteUser(id: string): Promise<void> {
    // Delete physical is disabled in API, so we patch is_active = false
    await apiClient.patch(`/users/${id}/`, { is_active: false });
  }
};
