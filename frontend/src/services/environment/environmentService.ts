import { apiClient } from '@/services/api/apiClient';

export interface EnvironmentType {
  id: number;
  name: string;
  description: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AssessmentType {
  id: number;
  name: string;
  description: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export const environmentService = {
  async getAll(): Promise<EnvironmentType[]> {
    const response = await apiClient.get('admin/environment-types/');
    return response.data;
  },
};

export const assessmentService = {
  async getAll(): Promise<AssessmentType[]> {
    const response = await apiClient.get('admin/assessment-types/');
    return response.data;
  },
};
