/**
 * Mock do axios para testes de integração
 * 
 * Este módulo fornece um mock completo do axios para testar
 * os serviços de risco sem depender de chamadas reais de API.
 */

import type { RiskAssessmentDetail, RiskAssessmentSummary } from '@/types/risk';

// =============================================================================
// Dados Mock
// =============================================================================

export const mockEvidence = {
  id: '1',
  file: 'evidence/2026/03/1_test.jpg',
  url: '/media/evidence/2026/03/1_test.jpg',
  thumbnail_url: '/media/evidence/2026/03/1_test.jpg',
  file_hash: 'abc123',
  file_size: 1024000,
  mime_type: 'image/jpeg',
  captured_at: '2026-03-12T10:00:00Z',
  created_at: '2026-03-12T10:00:00Z',
};

export const mockRecommendations = [
  {
    id: '1',
    title: 'Immediate Action Required',
    description: 'Address immediately to prevent accidents',
    priority: 'critical' as const,
  },
  {
    id: '2',
    title: 'Schedule Inspection',
    description: 'Perform detailed inspection within 24 hours',
    priority: 'high' as const,
  },
];

export const mockRisks = [
  {
    id: '1',
    description: 'Missing Guardrail',
    severity: 'CRITICAL' as const,
    location: 'Platform L2',
    evidence: {
      id: '1',
      thumbnail_url: '/media/evidence/2026/03/1_test.jpg',
      captured_at: '2026-03-12T10:00:00Z',
    },
    recommendations: mockRecommendations,
    ai_confidence: '95%',
    risk_status: 'ai_detected' as const,
    created_at: '2026-03-12T10:00:00Z',
    updated_at: '2026-03-12T10:00:00Z',
  },
  {
    id: '2',
    description: 'PPE Violation',
    severity: 'HIGH' as const,
    location: 'Zone A',
    evidence: null,
    recommendations: [
      {
        id: '3',
        title: 'Warning Issued',
        description: 'Ensure proper PPE usage',
        priority: 'high' as const,
      },
    ],
    ai_confidence: '87%',
    risk_status: 'ai_detected' as const,
    created_at: '2026-03-12T10:05:00Z',
    updated_at: '2026-03-12T10:05:00Z',
  },
  {
    id: '3',
    description: 'Blocked Exit',
    severity: 'MEDIUM' as const,
    location: 'Corridor B',
    evidence: null,
    recommendations: [
      {
        id: '4',
        title: 'Clear Area',
        description: 'Remove obstructions immediately',
        priority: 'medium' as const,
      },
    ],
    ai_confidence: '72%',
    risk_status: 'pending' as const,
    created_at: '2026-03-12T10:10:00Z',
    updated_at: '2026-03-12T10:10:00Z',
  },
];

export const mockAssessmentDetail: RiskAssessmentDetail = {
  id: '123',
  title: 'Construction Site Inspection',
  description: 'Weekly safety inspection of building site',
  status: 'ai_reviewed',
  status_display: 'Revisado por IA',
  created_by: '1',
  created_by_email: 'inspector@example.com',
  risks: mockRisks,
  evidences: [mockEvidence],
  inferences: [
    {
      id: '1',
      raw_result: { detected_objects: ['guardrail', 'ppe', 'exit'] },
      confidence: '85%',
      decisions: [],
      created_at: '2026-03-12T10:00:00Z',
    },
  ],
  compliance_score: 75,
  valid_transitions: [
    { value: 'human_validated', label: 'Validado por Humano' },
    { value: 'error', label: 'Erro' },
  ],
  captured_at: '2026-03-12T10:00:00Z',
  synced_at: '2026-03-12T10:01:00Z',
  ai_reviewed_at: '2026-03-12T10:05:00Z',
  human_validated_at: null,
  finalized_at: null,
  status_changed_at: '2026-03-12T10:05:00Z',
  status_change_reason: '',
  created_at: '2026-03-12T10:00:00Z',
  updated_at: '2026-03-12T10:05:00Z',
};

export const mockAssessmentSummary: RiskAssessmentSummary = {
  id: '123',
  title: 'Construction Site Inspection',
  description: 'Weekly safety inspection of building site',
  status: 'ai_reviewed',
  created_by_email: 'inspector@example.com',
  risk_count: 3,
  captured_at: '2026-03-12T10:00:00Z',
  ai_reviewed_at: '2026-03-12T10:05:00Z',
  human_validated_at: null,
  created_at: '2026-03-12T10:00:00Z',
};

// =============================================================================
// Mock do Axios
// =============================================================================

export interface MockAxiosResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: Record<string, unknown>;
}

export type MockAxiosHandler = (config: {
  url?: string;
  method?: string;
  data?: unknown;
  params?: Record<string, unknown>;
}) => Promise<MockAxiosResponse>;

class MockAxios {
  private handlers: Map<string, MockAxiosHandler> = new Map();
  private defaultDelay = 100;
  private shouldFail = false;
  private failureError: Error | null = null;

  /**
   * Configura um handler para uma URL específica
   */
  onGet(url: string | RegExp, handler: MockAxiosHandler): void {
    const key = this.getKey('GET', url);
    this.handlers.set(key, handler);
  }

  onPost(url: string | RegExp, handler: MockAxiosHandler): void {
    const key = this.getKey('POST', url);
    this.handlers.set(key, handler);
  }

  onPut(url: string | RegExp, handler: MockAxiosHandler): void {
    const key = this.getKey('PUT', url);
    this.handlers.set(key, handler);
  }

  onDelete(url: string | RegExp, handler: MockAxiosHandler): void {
    const key = this.getKey('DELETE', url);
    this.handlers.set(key, handler);
  }

  /**
   * Configura o mock para falhar em todas as chamadas
   */
  setShouldFail(shouldFail: boolean, error?: Error): void {
    this.shouldFail = shouldFail;
    this.failureError = error || new Error('Network Error');
  }

  /**
   * Reseta todos os handlers
   */
  reset(): void {
    this.handlers.clear();
    this.shouldFail = false;
    this.failureError = null;
  }

  /**
   * Simula uma requisição GET
   */
  async get<T>(url: string): Promise<MockAxiosResponse<T>> {
    return this.request<T>('GET', url);
  }

  /**
   * Simula uma requisição POST
   */
  async post<T>(url: string, data?: unknown): Promise<MockAxiosResponse<T>> {
    return this.request<T>('POST', url, data);
  }

  /**
   * Simula uma requisição PUT
   */
  async put<T>(url: string, data?: unknown): Promise<MockAxiosResponse<T>> {
    return this.request<T>('PUT', url, data);
  }

  /**
   * Simula uma requisição DELETE
   */
  async delete<T>(url: string): Promise<MockAxiosResponse<T>> {
    return this.request<T>('DELETE', url);
  }

  /**
   * Método interno para processar requisições
   */
  private async request<T>(
    method: string,
    url: string,
    data?: unknown
  ): Promise<MockAxiosResponse<T>> {
    // Simula delay de rede
    await this.delay(this.defaultDelay);

    // Verifica se deve falhar
    if (this.shouldFail) {
      throw this.failureError || new Error('Network Error');
    }

    // Busca handler específico
    const key = this.findHandlerKey(method, url);
    const handler = key ? this.handlers.get(key) : undefined;

    if (handler) {
      return handler({ url, method, data }) as Promise<MockAxiosResponse<T>>;
    }

    // Resposta padrão 404
    return {
      data: { error: 'Not Found' } as unknown as T,
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config: { url, method },
    };
  }

  /**
   * Gera uma chave para o handler
   */
  private getKey(method: string, url: string | RegExp): string {
    return `${method}:${url.toString()}`;
  }

  /**
   * Encontra a chave do handler que corresponde à URL
   */
  private findHandlerKey(method: string, url: string): string | null {
    for (const [key] of this.handlers) {
      const [handlerMethod, handlerUrl] = key.split(':', 2);
      if (handlerMethod !== method) continue;

      // Tenta match exato
      if (handlerUrl === url) return key;

      // Tenta match com RegExp
      try {
        const regex = new RegExp(handlerUrl.slice(1, -1)); // Remove /.../
        if (regex.test(url)) return key;
      } catch {
        // Ignora erros de regex inválido
      }
    }
    return null;
  }

  /**
   * Delay assíncrono
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Instância global do mock
export const mockAxios = new MockAxios();

// =============================================================================
// Configurações Pré-definidas
// =============================================================================

/**
 * Configura o mock com handlers padrão para o serviço de riscos
 */
export function setupDefaultRiskMocks(): void {
  mockAxios.reset();

  // GET /assessments - Lista avaliações
  mockAxios.onGet('/assessments', async () => ({
    data: [mockAssessmentSummary],
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
  }));

  // GET /assessments/:id - Detalhes da avaliação
  mockAxios.onGet(/\/assessments\/\d+/, async () => ({
    data: mockAssessmentDetail,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
  }));

  // POST /assessments/:id/human-validate - Validar avaliação
  mockAxios.onPost(/\/assessments\/\d+\/human-validate/, async () => ({
    data: {
      status: 'human_validated',
      previous_status: 'ai_reviewed',
      message: 'Avaliação validada por humano com sucesso',
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
  }));
}

/**
 * Configura o mock para simular erro 404
 */
export function setupNotFoundMock(): void {
  mockAxios.reset();
  mockAxios.onGet(/\/assessments\/\d+/, async () => ({
    data: { error: 'Assessment not found' },
    status: 404,
    statusText: 'Not Found',
    headers: {},
    config: {},
  }));
}

/**
 * Configura o mock para simular erro 403
 */
export function setupForbiddenMock(): void {
  mockAxios.reset();
  mockAxios.onGet(/\/assessments\/\d+/, async () => ({
    data: { error: 'Access denied' },
    status: 403,
    statusText: 'Forbidden',
    headers: {},
    config: {},
  }));
}

/**
 * Configura o mock para simular avaliação sem riscos
 */
export function setupEmptyRisksMock(): void {
  mockAxios.reset();
  mockAxios.onGet(/\/assessments\/\d+/, async () => ({
    data: { ...mockAssessmentDetail, risks: [] },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
  }));
}

// Exporta o mock para uso em testes
export default mockAxios;
