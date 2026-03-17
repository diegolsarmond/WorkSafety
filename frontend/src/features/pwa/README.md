# PWA Features

Este módulo contém os componentes e hooks para gerenciar o Progressive Web App (PWA).

## Funcionalidades

### 1. Instalação do PWA (`usePWAInstall`)

Hook que detecta quando o PWA pode ser instalado e fornece funções para gerenciar a instalação.

```tsx
import { usePWAInstall } from './hooks';

function MeuComponente() {
  const { canInstall, isInstalled, install, dismiss } = usePWAInstall();
  
  if (canInstall) {
    return <button onClick={install}>Instalar App</button>;
  }
}
```

**Propriedades:**
- `canInstall`: Boolean indicando se o app pode ser instalado
- `isInstalled`: Boolean indicando se o app já está instalado
- `isInstalling`: Boolean indicando se está mostrando o prompt de instalação
- `install()`: Função para abrir o prompt de instalação nativo
- `dismiss()`: Função para esconder o banner (dismiss por 7 dias)
- `isDismissed`: Boolean indicando se o banner foi dismissado

### 2. Status de Rede (`useNetworkStatus`)

Hook para monitorar o status da conexão de rede.

```tsx
import { useNetworkStatus } from './hooks';

function MeuComponente() {
  const { isOnline, isOffline } = useNetworkStatus();
  
  return isOffline ? <AlertaOffline /> : null;
}
```

### 3. Componentes

#### `InstallPrompt`

Banner flutuante que aparece quando o PWA pode ser instalado.

```tsx
import { InstallPrompt } from './components';

function App() {
  return (
    <>
      <Router />
      <InstallPrompt />
    </>
  );
}
```

#### `OfflineIndicator`

Barra superior que aparece quando o usuário fica offline.

```tsx
import { OfflineIndicator, ConnectionBadge } from './components';

function App() {
  return (
    <>
      <OfflineIndicator />
      {/* ... */}
    </>
  );
}
```

## Como Testar

### Modo Offline

1. Faça o build: `npm run build`
2. Inicie o preview: `npm run preview`
3. Abra o Chrome DevTools → Application → Service Workers
4. Marque "Offline" para simular modo offline
5. Recarregue a página - deve funcionar normalmente

### Instalação do PWA

1. No Chrome DevTools → Application → Manifest
2. Verifique se o manifest está válido (deve mostrar ícone verde)
3. Clique em "Add to home screen" para testar a instalação

### Lighthouse Audit

1. No Chrome DevTools → Lighthouse
2. Selecione "PWA" e "Best Practices"
3. Clique em "Analyze page load"
4. Verifique se o PWA passa em todos os requisitos

## Cache Strategy

O service worker utiliza as seguintes estratégias:

| Recurso | Estratégia | TTL |
|---------|-----------|-----|
| Imagens | Cache First | 60 dias |
| Fontes | Cache First | 1 ano |
| API | Network First | 7 dias |
| App Shell | Network First | 24 horas |

## Arquivos em Cache

- Todos os arquivos `.js`, `.css`, `.html`
- Ícones: `.ico`, `.png`, `.svg`
- Fontes: `.woff2`
- Manifest: `.json`

## Troubleshooting

### O banner de instalação não aparece

1. Verifique se o manifest.json está acessível em `/manifest.json`
2. Confira se há ícones em todos os tamanhos necessários (192x192 e 512x512)
3. O site deve ser servido em HTTPS (exceto localhost)
4. O service worker deve estar registrado

### O modo offline não funciona

1. Verifique se o service worker está registrado em DevTools → Application → Service Workers
2. Confira se há erros no console
3. Tente limpar o cache: DevTools → Application → Clear storage → Clear site data
4. Recarregue a página

### Atualizações não aparecem

O service worker usa a estratégia `prompt` que mostra um toast quando há atualização disponível.
Para forçar atualização:
1. DevTools → Application → Service Workers
2. Clique em "Update"
3. Ou marque "Update on reload" para desenvolvimento
