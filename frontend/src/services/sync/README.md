# Sync Service

Serviço de sincronização para o PWA. Gerencia a fila de operações offline e sincroniza com o servidor quando online.

## Uso

### SyncManager (Global)

```typescript
import { syncManager } from '@/services/sync';

// Inscreve para mudanças de estado
const unsubscribe = syncManager.subscribe(state => {
  console.log('Status:', state.status);
  console.log('Pendentes:', state.pendingCount);
});

// Força sincronização
await syncManager.forceSync();

// Adiciona inspeção à fila
await syncManager.queueInspection(inspection);
```

### Hooks React

```typescript
import { useSyncManager, useOnlineStatus } from '@/services/sync/hooks';

function MeuComponente() {
  const { 
    isOnline, 
    isSyncing, 
    pendingCount, 
    forceSync 
  } = useSyncManager();

  const { isOnline: online } = useOnlineStatus();

  return (
    <div>
      {isSyncing ? 'Sincronizando...' : `Pendentes: ${pendingCount}`}
      {!isOnline && <span>Modo Offline</span>}
    </div>
  );
}
```

## Funcionamento

1. **Fila de Sync**: Operações offline são adicionadas à fila
2. **Auto-sync**: Tenta sincronizar automaticamente quando online
3. **Periodic Sync**: Verifica a cada 30 segundos
4. **WiFi-only**: Opção para sincronizar apenas no WiFi
5. **Retry**: Tenta 3x antes de marcar como falha

## Estados

| Status | Descrição |
|--------|-----------|
| `idle` | Aguardando |
| `syncing` | Sincronizando |
| `error` | Erro na sincronização |

## Eventos de Conexão

- `online`: Dispara sincronização
- `offline`: Pausa sincronização
- `visibilitychange`: Sincroniza quando aba fica visível
