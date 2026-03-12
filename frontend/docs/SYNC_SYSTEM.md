# Sistema de Fila de Sincronização - WorkSafety

## Visão Geral

Sistema robusto de fila local com reenvio automático para garantir tolerância a falhas de rede no aplicativo WorkSafety.

### Características Principais

- ✅ **Persistência durável**: IndexedDB via `idb-keyval`
- ✅ **Retry automático**: Até 3 tentativas com backoff exponencial
- ✅ **Jitter**: Prevenção de thundering herd
- ✅ **Worker em background**: Sincronização contínua mesmo com app em background
- ✅ **Retry manual**: Usuário pode forçar retry imediato
- ✅ **Dashboard UI**: Visualização de jobs pendentes/falhos
- ✅ **Migração de dados**: Migra inspeções legadas automaticamente

## Arquitetura

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Components    │────▶│    SyncStore     │────▶│  SyncStorage    │
│  (UI/Buttons)   │     │   (Zustand)      │     │  (IndexedDB)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                       ┌──────────────────┐
                       │   SyncWorker     │
                       │  (Background)    │
                       └──────────────────┘
                               │
                               ▼
                       ┌──────────────────┐
                       │      API         │
                       │   (Backend)      │
                       └──────────────────┘
```

## Estrutura de Arquivos

```
src/
├── types/
│   └── sync.ts              # Tipos e interfaces
├── store/
│   └── syncStore.ts         # Store Zustand
├── services/sync/
│   ├── syncStorage.ts       # Persistência IndexedDB
│   └── syncWorker.ts        # Lógica de sincronização
├── hooks/sync/
│   ├── useSyncQueue.ts      # Hook para dashboard
│   └── useSyncStatus.ts     # Hook leve para status
├── utils/
│   └── syncUtils.ts         # Utilitários (backoff, etc)
├── features/sync/
│   ├── components/
│   │   ├── SyncStatusBadge.tsx    # Badge no header
│   │   ├── SyncJobItem.tsx        # Item da lista
│   │   └── SyncQueueDashboard.tsx # Dashboard completo
│   └── pages/
│       └── SyncQueuePage.tsx      # Página /sync-queue
└── __tests__/sync/
    ├── syncUtils.test.ts    # Testes de utilitários
    ├── syncStorage.test.ts  # Testes de storage
    └── backoff.test.ts      # Testes de backoff
```

## Modelo de Dados

### SyncJob

```typescript
interface SyncJob {
  id: string;                    // UUID local
  assessmentDraft: {
    title: string;
    description: string;
    environment: string;
    category: string;
    status: 'draft' | 'pending' | 'completed';
  };
  photos: PhotoData[];           // Array de fotos
  status: 'PENDING' | 'SYNCING' | 'COMPLETED' | 'FAILED' | 'ERROR';
  retryCount: number;            // 0-3
  maxRetries: number;            // padrão: 3
  nextRetryAt: number | null;    // Timestamp para próximo retry
  lastError: string | null;      // Último erro
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  assessmentId?: string;         // ID do backend
}
```

## Backoff Exponencial + Jitter

### Fórmula

```
delay = min(base * (2 ^ retryCount) + jitter, maxDelay)

onde:
- base = 2000ms (2 segundos)
- maxDelay = 60000ms (1 minuto)
- jitter = random(0, 1000)ms
```

### Exemplo

| Retry | Base | Expo | Jitter | Total | Quando |
|-------|------|------|--------|-------|--------|
| 1ª | 2000ms | 2000ms | 0-1000ms | ~2.5s | Imediato |
| 2ª | 2000ms | 4000ms | 0-1000ms | ~4.5s | ~4s após 1ª |
| 3ª | 2000ms | 8000ms | 0-1000ms | ~8.5s | ~8s após 2ª |

## Fluxo de Uso

### 1. Criar Nova Inspeção

```typescript
// ReviewPhotos.tsx
const { addJob } = useSyncStore();

await addJob(
  {
    title: `Inspection - ${environment} - ${category}`,
    description: `Automated inspection...`,
    environment,
    category,
    status: 'draft',
  },
  photos
);
```

### 2. Monitorar Status

```typescript
// Dashboard ou componente
const { jobs, pendingCount, failedCount, isProcessing } = useSyncQueue();
```

### 3. Retry Manual

```typescript
const { retryJob } = useSyncQueue();
await retryJob(jobId);
```

## Eventos do Worker

O `SyncWorker` dispara callbacks em eventos importantes:

```typescript
syncWorker.on({
  onJobStarted: (jobId) => {},
  onJobCompleted: (jobId) => {},
  onJobFailed: (jobId, error) => {},
  onJobError: (jobId, error) => {}, // Max retries
  onSyncStarted: () => {},
  onSyncCompleted: () => {},
});
```

## Configurações

```typescript
// src/types/sync.ts
export const SYNC_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY_MS: 2000,
  MAX_DELAY_MS: 60000,
  BACKOFF_MULTIPLIER: 2,
  JITTER_MAX_MS: 1000,
  SYNC_INTERVAL_MS: 30000,        // 30s
  VISIBILITY_SYNC_DELAY_MS: 1000, // 1s
};
```

## Testes

### Executar testes de backoff

```bash
npx tsx src/__tests__/sync/backoff.test.ts
```

### Executar testes de utilitários

```bash
npx tsx src/__tests__/sync/syncUtils.test.ts
```

### Testes de integração (requer fake-indexeddb)

```bash
# Instalar dependência de teste
npm install -D fake-indexeddb vitest

# Configurar vitest.config.ts
# Rodar testes
npx vitest
```

## Migração de Dados Legadas

O sistema detecta automaticamente inspeções antigas no formato legado (`inspection-storage`) e migra para a nova fila na inicialização.

## Cenários de Uso

### Cenário 1: Offline Completo
1. Usuário captura fotos offline
2. Job é criado com status PENDING
3. Worker detecta offline e aguarda
4. Quando online, sincroniza automaticamente

### Cenário 2: Falha Intermitente
1. Job falha na 1ª tentativa (rede instável)
2. Status muda para FAILED, retryCount = 1
3. nextRetryAt calculado com backoff (~2s + jitter)
4. Worker tenta novamente quando nextRetryAt <= now
5. Processo repete até sucesso ou max retries

### Cenário 3: App Fechado/Reaberto
1. Job salvo no IndexedDB
2. Usuário fecha o app
3. Ao reabrir, SyncStore é inicializado
4. Migração roda se necessário
5. Worker inicia e processa jobs pendentes

### Cenário 4: Retry Manual
1. Job atinge max retries (status ERROR)
2. Usuário vê no dashboard
3. Clica "Tentar novamente"
4. Status reseta para PENDING
5. Worker processa imediatamente

## Troubleshooting

### Jobs não aparecem no dashboard
- Verificar se `useSyncStore().initialize()` foi chamado no App.tsx
- Verificar console por erros de IndexedDB

### Sincronização não inicia
- Verificar se está online (`navigator.onLine`)
- Verificar se Worker está rodando (`syncWorker.getStatus()`)

### Fotos duplicadas
- Verificar se assessmentId está sendo salvo após criação
- Isso evita recriar assessment em retry

## Roadmap Futuro

- [ ] Compressão de imagens antes do upload
- [ ] Upload progressivo (chunked upload)
- [ ] Background sync API (Service Worker)
- [ ] Notificações push para jobs completados
- [ ] Sincronização multi-dispositivo
