# Uso do Sistema de Storage

## Resumo

O projeto tem **dois sistemas** de armazenamento/sincronização:

| Sistema | Uso Principal | Local |
|---------|--------------|-------|
| **SyncStore** (existente) | Sincronização de inspeções com backend | `@/store/syncStore` |
| **Storage Service** (novo) | Armazenamento local de imagens/configs | `@/services/storage` |

---

## 1. SyncStore (Use para Inspeções)

Para criar inspeções e sincronizar com o backend:

```typescript
import { useSyncStore } from '@/store/syncStore';

function MinhaPagina() {
  const addJob = useSyncStore(state => state.addJob);

  const criarInspecao = async () => {
    const jobId = await addJob(
      {
        title: 'Inspeção Área X',
        description: 'Descrição...',
        environment: 'indoor',
        category: 'Ergonomia',
        status: 'draft',
      },
      photos // Array de PhotoData
    );
  };
}
```

---

## 2. Storage Service (Use para Imagens/Configs)

### Armazenar Imagem (com compressão)

```typescript
import { storeImage, getImagePreviewUrl } from '@/services/storage';

// Armazena com compressão
const metadata = await storeImage(file, {
  inspectionId: 'inspecao_123',
  quality: 'medium', // 'high' | 'medium' | 'low'
  generateThumbnail: true,
  tags: ['fachada', 'entrada'],
});

// Obtém URL para preview
const url = await getImagePreviewUrl(metadata.id);
// IMPORTANTE: Depois chamar URL.revokeObjectURL(url) para liberar memória
```

### Usar Hook de Imagens

```typescript
import { useImages } from '@/services/storage';

function Galeria() {
  const { 
    images, 
    loading, 
    storeImage, 
    deleteImage,
    getPreviewUrl,
    stats 
  } = useImages({ inspectionId: 'inspecao_123' });

  if (loading) return <Spinner />;

  return (
    <div>
      <p>Total: {stats?.total} imagens</p>
      {images.map(img => (
        <ImageCard key={img.id} metadata={img} />
      ))}
    </div>
  );
}
```

### Preferências do Usuário

```typescript
import { usePreferences } from '@/services/storage';

function Configuracoes() {
  const { preferences, loading, updatePreferences } = usePreferences();

  if (loading) return <Spinner />;

  return (
    <div>
      <select 
        value={preferences?.theme}
        onChange={e => updatePreferences({ theme: e.target.value })}
      >
        <option value="dark">Escuro</option>
        <option value="light">Claro</option>
      </select>
    </div>
  );
}
```

### Estatísticas de Storage

```typescript
import { useStorageStats } from '@/services/storage';

function StorageInfo() {
  const { stats, cleanup } = useStorageStats();

  return (
    <div>
      <p>Usado: {(stats?.used / 1024 / 1024).toFixed(2)} MB</p>
      <p>Disponível: {(stats?.available / 1024 / 1024).toFixed(2)} MB</p>
      
      <button onClick={() => cleanup({ clearCache: true })}>
        Limpar Cache
      </button>
    </div>
  );
}
```

---

## Quando Usar Cada Um?

### Use SyncStore quando:
- Criar nova inspeção
- Adicionar fotos a uma inspeção
- Quiser enviar para o servidor automaticamente
- Precisar de fila com retry automático

### Use Storage Service quando:
- Armazenar imagem temporariamente
- Salvar configurações do usuário
- Cache de dados da API
- Verificar espaço disponível
- Comprimir imagens antes de enviar

---

## Integração entre os dois

Você pode usar ambos juntos:

```typescript
import { useSyncStore } from '@/store/syncStore';
import { storeImage, getImagePreviewUrl } from '@/services/storage';

async function processarFotos(files: File[]) {
  // 1. Comprime e armazena localmente
  const imageIds = [];
  for (const file of files) {
    const metadata = await storeImage(file, { quality: 'medium' });
    imageIds.push(metadata.id);
  }

  // 2. Converte para PhotoData (formato do SyncStore)
  const photos = await Promise.all(
    imageIds.map(async (id, index) => {
      const blob = await getImage(id);
      const dataUrl = await blobToDataUrl(blob!);
      return {
        id: `photo_${index}`,
        dataUrl,
        timestamp: new Date().toISOString(),
      };
    })
  );

  // 3. Adiciona ao SyncStore para envio
  const syncStore = useSyncStore.getState();
  await syncStore.addJob(
    { title: 'Inspeção', ... },
    photos
  );
}
```
