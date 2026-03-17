# Guia de Storage PWA - WorkSafety

## Visão Geral

Este documento descreve o sistema de armazenamento offline implementado para o PWA.

### Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER APIs                             │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  IndexedDB   │  │ Cache API    │  │ LocalStorage     │  │
│  │  (Dados)     │  │ (Assets)     │  │ (Settings)       │  │
│  └──────┬───────┘  └──────────────┘  └──────────────────┘  │
└─────────┼───────────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────────┐
│                   SERVICE WORKER                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Cache First: Imagens, Fontes                         │  │
│  │  Network First: API calls (fallback to cache)         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────────┐
│                   APPLICATION LAYER                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────────────────┐    │
│  │  SyncStore       │  │  Storage Service (Novo)      │    │
│  │  ─────────────   │  │  ────────────────────────    │    │
│  │  • SyncWorker    │  │  • ImageStorage              │    │
│  │  • SyncQueue     │  │  • SettingsStorage           │    │
│  │  • API Integration│  │  • StorageStats             │    │
│  └──────────────────┘  └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Funcionalidades

### ✅ Funcionamento Offline Completo

- **Assets**: CSS, JS, HTML são cacheados pelo Service Worker
- **Imagens**: Compressão e armazenamento no IndexedDB
- **API**: Respostas cacheadas com Network First strategy
- **Dados**: Inspeções e configurações persistidas localmente

### ✅ Sincronização em Background

- Monitoramento automático de conexão
- Fila de sync com retry exponencial
- Sincronização ao voltar para a página
- Opção de sync apenas no WiFi

### ✅ Gestão de Storage

- Estatísticas de uso em tempo real
- Compressão automática de imagens
- Limpeza de dados antigos
- Alertas de quota

---

## Configuração

### vite.config.ts

O Service Worker está configurado com:

```typescript
VitePWA({
  registerType: 'prompt',
  injectRegister: 'auto',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
    runtimeCaching: [
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
        handler: 'CacheFirst',
        options: { cacheName: 'images-cache', maxAgeSeconds: 60 * 24 * 60 * 60 }
      },
      {
        urlPattern: /\/api\/.*/i,
        handler: 'NetworkFirst',
        options: { cacheName: 'api-cache', maxAgeSeconds: 7 * 24 * 60 * 60 }
      }
    ]
  }
})
```

---

## Uso nas Páginas

### Armazenar Imagem da Câmera

```typescript
import { storeImage } from '@/services/storage';

const handleCapture = async (file: File) => {
  const metadata = await storeImage(file, {
    quality: 'medium',
    inspectionId: currentInspectionId,
  });
  
  // Salva o ID da imagem na inspeção
  await saveImageReference(metadata.id);
};
```

### Salvar Rascunho Offline

```typescript
import { useSyncStore } from '@/store/syncStore';

const saveDraft = async () => {
  const syncStore = useSyncStore.getState();
  
  await syncStore.addJob(
    {
      title: 'Rascunho Local',
      description: '...',
      environment: 'outdoor',
      category: 'Segurança',
      status: 'draft',
    },
    photos
  );
};
```

### Mostrar Status de Conexão

```typescript
import { useSyncManager } from '@/services/sync';

function StatusBar() {
  const { isOnline, isSyncing, pendingCount } = useSyncManager();
  
  return (
    <div>
      {!isOnline && <Badge>Offline</Badge>}
      {isSyncing && <Spinner>Sincronizando...</Spinner>}
      {pendingCount > 0 && <span>{pendingCount} pendentes</span>}
    </div>
  );
}
```

---

## Limites e Quotas

| Recurso | Limite | Configuração |
|---------|--------|--------------|
| Imagens | 500MB | `maxOfflineStorage` em AppConfig |
| Tamanho imagem | 10MB | `maxImageSize` em AppConfig |
| Qualidade compressão | 0.5-0.9 | `compressionQuality` em AppConfig |
| Cache API | 5MB | `maximumFileSizeToCacheInBytes` no SW |

---

## Testes

### Modo Offline

1. DevTools → Network → Offline
2. Recarregue a página
3. Navegue entre as telas
4. Verifique se funciona normalmente

### Instalação PWA

1. DevTools → Application → Manifest
2. Clique em "Add to home screen"
3. Verifique se o app instala

### Sincronização

1. Crie uma inspeção offline
2. Vá para Online
3. Aguarde a sincronização automática
4. Verifique no servidor

### Storage

```javascript
// No console do DevTools:
const stats = await getStorageStats();
console.log('Usado:', stats.used / 1024 / 1024, 'MB');
```

---

## Troubleshooting

### App não instala

- Verifique se manifest.json está válido (DevTools → Application → Manifest)
- Confira se há Service Worker registrado
- Verifique se está em HTTPS (ou localhost)

### Dados não persistem

- Verifique quota: `navigator.storage.estimate()`
- Limpe dados antigos: `cleanupStorage()`
- Verifique erros no console

### Sincronização não funciona

- Verifique se há conexão
- Confira se o SyncWorker está rodando: `syncWorker.getStatus()`
- Verifique fila: `SyncStorage.getAllJobs()`

---

## Referências

- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)
- [idb-keyval](https://github.com/jakearchibald/idb-keyval)
- [Workbox](https://developer.chrome.com/docs/workbox/)
- [PWA Guide](https://web.dev/progressive-web-apps/)
