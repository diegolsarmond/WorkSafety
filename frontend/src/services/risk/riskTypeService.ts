/**
 * Serviço para buscar tipos de risco da API
 */

import { apiClient } from '@/services/api/apiClient';

export interface RiskType {
  id: number;
  name: string;
  description: string;
  active: boolean;
}

export interface RiskTypeListResponse {
  count: number;
  results: RiskType[];
}

/**
 * Busca tipos de risco ativos do backend
 * Endpoint: GET /api/admin/risk-types/
 */
export async function listRiskTypes(): Promise<RiskType[]> {
  try {
    const response = await apiClient.get<RiskTypeListResponse>('admin/risk-types/', {
      params: { active: true },
    });
    return response.data.results || [];
  } catch (error) {
    console.error('[RiskTypeService] Failed to fetch risk types:', error);
    return [];
  }
}

/**
 * Busca um tipo de risco específico
 * Endpoint: GET /api/admin/risk-types/:id/
 */
export async function getRiskType(id: number): Promise<RiskType | null> {
  try {
    const response = await apiClient.get<RiskType>(`admin/risk-types/${id}/`);
    return response.data;
  } catch (error) {
    console.error(`[RiskTypeService] Failed to fetch risk type ${id}:`, error);
    return null;
  }
}
