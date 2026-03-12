# Integração da Tela de Riscos com Backend

Documentação da integração entre a tela `RisksDetected` e a API backend.

## Sumário

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Tipos TypeScript](#tipos-typescript)
- [Serviço de API](#serviço-de-api)
- [Hook de Estado](#hook-de-estado)
- [Tela RisksDetected](#tela-risksdetected)
- [Estados da Tela](#estados-da-tela)
- [Integração com Ciclo de Vida](#integração-com-ciclo-de-vida)
- [Testes](#testes)

---

## Visão Geral

A tela de riscos foi integrada com o backend para exibir dados reais da avaliação, incluindo:

- Lista de riscos detectados pela IA
- Evidências (fotos) associadas a cada risco
- Recomendações de segurança
- Score de compliance
- Status do ciclo de vida da avaliação

### Arquivos Criados/Modificados

```
frontend/src/
├── types/risk.ts                          # Tipos TypeScript
├── services/risk/
│   ├── riskService.ts                     # Serviço de API
│   └── index.ts                           # Exports
├── hooks/risk/
│   ├── useRiskAssessment.ts               # Hook de estado
│   └── index.ts                           # Exports
├── features/inspection/
│   └── RisksDetected.tsx                  # Tela atualizada
└── __tests__/risk/
    ├── mockAxios.ts                       # Mock do axios
    ├── riskService.test.ts                # Testes do serviço
    └── useRiskAssessment.test.ts          # Testes do hook

backend/assessments/
├── serializers.py                         # Atualizado
├── views.py                               # Atualizado
├── urls.py                                # Atualizado
├── models.py                              # Atualizado (RiskFinding)
└── migrations/
    └── 0010_riskfinding_evidence_riskfinding_location.py
```

---

## Arquitetura

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   RisksDetected │────▶│ useRiskAssessment│────▶│  riskService   │
│    (UI Layer)   │◄────│  (State Layer)  │◄────│  (API Layer)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                              ┌─────────────────────────┘
                              ▼
                        ┌─────────────────┐
                        │  /assessments/:id
                        │  (Django API)
                        └─────────────────┘
```

---

## Tipos TypeScript

### Principais Interfaces

```typescript
// RiskItem - Risco detectado
interface RiskItem {
  id: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  location: string;
  evidence: EvidenceRef | null;
  recommendations: Recommendation[];
  ai_confidence: string;
  risk_status: 'pending' | 'ai_detected' | 'validated' | 'rejected';
  created_at: string;
  updated_at: string;
}

// EvidenceRef - Referência a evidência
interface EvidenceRef {
  id: string;
  thumbnail_url: string;
  captured_at: string | null;
}

// Recommendation - Recomendação de segurança
interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

// RiskAssessmentDetail - Detalhes completos
interface RiskAssessmentDetail {
  id: string;
  title: string;
  status: AssessmentStatus;
  risks: RiskItem[];
  evidences: Evidence[];
  compliance_score: number;
  // ... outros campos
}
```

---

## Serviço de API

### Funções Disponíveis

```typescript
// Buscar avaliação por ID
getAssessmentById(assessmentId: string): Promise<RiskAssessmentDetail>

// Listar avaliações
listAssessments(): Promise<RiskAssessmentSummary[]>

// Transições de ciclo de vida
humanValidateAssessment(id: string, reason?: string): Promise<...>
markAIReviewed(id: string, reason?: string): Promise<...>
finalizeAssessment(id: string, reason?: string): Promise<...>
```

### Tratamento de Erros

O serviço lança `RiskServiceError` com códigos específicos:

- `NOT_FOUND` - Avaliação não existe (404)
- `FORBIDDEN` - Acesso negado (403)
- `NETWORK_ERROR` - Erro de rede
- `TRANSITION_ERROR` - Transição inválida

---

## Hook de Estado

### useRiskAssessment

```typescript
const {
  // Estado
  screenState,        // 'loading' | 'error' | 'empty' | 'data'
  assessment,         // RiskAssessmentDetail | null
  filteredRisks,      // RiskItem[]
  riskCounts,         // Record<string, number>
  
  // Filtros
  filters,            // RiskFilters
  setFilters,         // (filters) => void
  sortOption,         // RiskSortOption
  setSortOption,      // (option) => void
  
  // Ações
  fetchAssessment,    // () => Promise<void>
  refresh,            // () => Promise<void>
  validateAssessment, // (reason?) => Promise<void>
  
  // Estados
  isValidating,       // boolean
  validationError,    // string | null
} = useRiskAssessment(assessmentId, {
  autoFetch: true,
  refreshInterval: 30000,
});
```

---

## Tela RisksDetected

### Estados da Tela

A tela possui 4 estados principais:

1. **Loading** - Carregando dados da avaliação
   ```
   ┌─────────────────────────────┐
   │     ↻ Loading...            │
   └─────────────────────────────┘
   ```

2. **Error** - Erro ao carregar
   ```
   ┌─────────────────────────────┐
   │     ⚠ Error loading         │
   │     [Try again]             │
   └─────────────────────────────┘
   ```

3. **Empty** - Nenhum risco detectado
   ```
   ┌─────────────────────────────┐
   │     ✓ No risks detected     │
   │     Great news!             │
   └─────────────────────────────┘
   ```

4. **Data** - Lista de riscos
   ```
   ┌─────────────────────────────┐
   │  Total: 03  |  Compliance 75%│
   ├─────────────────────────────┤
   │  ☐ Missing Guardrail        │
   │     📍 Platform L2          │
   │     [CRITICAL]              │
   │     [🖼️] Immediate Action   │
   └─────────────────────────────┘
   ```

### Funcionalidades

- **Filtros por severidade**: CRITICAL, HIGH, MEDIUM, LOW
- **Busca por texto**: descrição ou localização
- **Ordenação**: por severidade ou data
- **Miniaturas de evidências**: clicáveis para visualização
- **Expandir recomendações**: mostrar/ocultar detalhes

---

## Integração com Ciclo de Vida

### Status da Avaliação

| Status | Badge | Ações Disponíveis |
|--------|-------|-------------------|
| draft | Cinza | - |
| captured | Azul | - |
| synced | Roxo | - |
| ai_reviewed | Teal | Validar, Rejeitar |
| human_validated | Verde | Confirmar |
| finalized | Preto | - |
| error | Vermelho | Retry |

### Botões de Ação

```typescript
// Status = ai_reviewed
<Button>Reject</Button>  <Button>Validate</Button>

// Status = human_validated  
<Button>Reject</Button>  <Button disabled>Confirm</Button>
```

---

## Testes

### Executando Testes

```bash
# Testes manuais (console)
# Abra o console do navegador após importar os módulos

# Testes com Jest
npm test -- risk/
```

### Cobertura de Testes

| Componente | Testes |
|------------|--------|
| riskService | fetch, erro 404/403, network, helpers |
| useRiskAssessment | estados, filtros, ordenação, ações |
| mockAxios | handlers, reset, delays |

### Exemplo de Teste

```typescript
it('deve filtrar por severidade', async () => {
  const { result } = renderHook(() => useRiskAssessment('123'));
  
  await waitFor(() => {
    expect(result.current.screenState.type).toBe('data');
  });
  
  act(() => {
    result.current.setFilters({ severity: ['CRITICAL'] });
  });
  
  expect(result.current.filteredRisks).toHaveLength(1);
  expect(result.current.filteredRisks[0].severity).toBe('CRITICAL');
});
```

---

## API Backend

### Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/assessments/` | Lista avaliações |
| GET | `/assessments/:id/` | Detalhes da avaliação |
| POST | `/assessments/:id/human-validate/` | Validar por humano |
| POST | `/assessments/:id/mark-ai-reviewed/` | Marcar revisado por IA |
| POST | `/assessments/:id/finalize/` | Finalizar avaliação |

### Exemplo de Resposta

```json
{
  "id": "123",
  "title": "Construction Site Inspection",
  "status": "ai_reviewed",
  "risks": [
    {
      "id": "1",
      "description": "Missing Guardrail",
      "severity": "CRITICAL",
      "location": "Platform L2",
      "evidence": {
        "id": "1",
        "thumbnail_url": "/media/evidence/2026/03/1_test.jpg"
      },
      "recommendations": [
        {
          "id": "1",
          "title": "Immediate Action Required",
          "description": "Address immediately",
          "priority": "critical"
        }
      ],
      "ai_confidence": "95%",
      "risk_status": "ai_detected"
    }
  ],
  "compliance_score": 75,
  "valid_transitions": [
    {"value": "human_validated", "label": "Validado por Humano"}
  ]
}
```

---

## Checklist de Aceite

- [x] Tipos TypeScript definidos (`RiskItem`, `Recommendation`, `EvidenceRef`)
- [x] Serviço API criado (`/assessments/:id`)
- [x] Tela com loading, empty, error states
- [x] Lista de riscos renderizada com dados reais
- [x] Miniaturas de evidências linkadas
- [x] Integração com ciclo de vida (status)
- [x] Botões de ação condicionais ao status
- [x] Filtros e ordenação funcionais
- [x] Testes unitários com mock do axios
- [x] Tratamento de erros robusto

---

## Próximos Passos

1. **Integração com sync**: Atualizar `Syncing.tsx` para passar `assessmentId` via navigation state
2. **Modal de evidência**: Criar visualização em tela cheia das fotos
3. **Cache**: Implementar cache local dos dados da avaliação
4. **Offline**: Suporte para visualização offline após primeiro carregamento
