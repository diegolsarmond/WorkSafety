# WorkSafety PWA

Este aplicativo é um Progressive Web App (PWA) que pode ser instalado em dispositivos Android e iOS.

## Funcionalidades do PWA

- ✅ Instalação na tela inicial (Android/iOS)
- ✅ Funcionamento offline com cache de recursos
- ✅ Splash screen personalizada no estilo da aplicação
- ✅ Ícones adaptáveis para diferentes dispositivos
- ✅ Atualização automática em segundo plano
- ✅ Atalhos para ações rápidas (Nova Inspeção, Dashboard)

## Como Instalar

### Android (Chrome)
1. Abra o aplicativo no Chrome
2. Toque no menu (⋮) e selecione "Adicionar à tela inicial"
3. Ou toque no banner de instalação quando aparecer

### iOS (Safari)
1. Abra o aplicativo no Safari
2. Toque no botão Compartilhar (□↑)
3. Role para baixo e selecione "Adicionar à Tela de Início"
4. Toque em "Adicionar"

### Desktop (Chrome/Edge)
1. Abra o aplicativo
2. Clique no ícone de instalação na barra de endereço
3. Ou use o menu (⋮) → "Instalar WorkSafety"

## Estrutura de Arquivos PWA

```
public/
├── manifest.json          # Configuração do PWA
├── icon.svg               # Ícone fonte SVG
├── pwa-192x192.png        # Ícone 192x192
├── pwa-512x512.png        # Ícone 512x512
├── pwa-144x144.png        # Ícone 144x144
├── apple-touch-icon.png   # Ícone para iOS
├── favicon.ico            # Favicon
├── mask-icon.png          # Ícone mascarável
├── screenshot-narrow.png  # Screenshot mobile
├── screenshot-wide.png    # Screenshot desktop
└── splash/                # Telas de splash iOS
    ├── iPhone_16_Pro_Max_portrait.png
    ├── iPhone_16_Pro_portrait.png
    └── ...
```

## Scripts Disponíveis

```bash
# Gerar ícones do PWA
npm run generate-icons

# Build de produção (inclui PWA)
npm run build

# Preview do PWA após build
npm run pwa:preview

# Limpar build
npm run clean
```

## Configuração do Service Worker

O service worker é gerado automaticamente pelo `vite-plugin-pwa` com as seguintes configurações:

- **Estratégia de Cache**: Cache First para imagens, Network First para API
- **Precache**: Todos os assets da build
- **Runtime Caching**: Imagens externas e chamadas API
- **Atualização**: Auto-update em segundo plano

## Personalização

### Cores
As cores do tema são definidas em:
- `index.html`: `theme-color` e `background-color`
- `vite.config.ts`: manifest theme_color e background_color
- `public/manifest.json`: mesmas cores

### Splash Screen
A splash screen é controlada pelo componente `SplashScreen.tsx`:
- Local: `src/features/splash/SplashScreen.tsx`
- Duração: 3 segundos (configurável via prop `duration`)
- Mostrada apenas uma vez por sessão

### Ícones
Para regenerar os ícones após alterações no SVG:
```bash
npm run generate-icons
```

## Teste do PWA

Para testar as funcionalidades do PWA localmente:

1. Faça o build: `npm run build`
2. Inicie o preview: `npm run preview`
3. Use as DevTools do Chrome → Application → Service Workers
4. Teste o modo offline nas DevTools

## Requisitos para Publicação

Para que o PWA funcione corretamente em produção:

1. Servir em HTTPS (obrigatório para PWA)
2. Configurar CORS adequadamente
3. O service worker precisa estar no root do domínio
4. O manifest.json deve ser acessível

## Suporte a Navegadores

| Navegador | Instalação | Offline | Notificações |
|-----------|------------|---------|--------------|
| Chrome    | ✅         | ✅      | ✅           |
| Safari    | ✅ (iOS)   | ✅      | ❌           |
| Edge      | ✅         | ✅      | ✅           |
| Firefox   | ✅         | ✅      | ⚠️           |
| Samsung   | ✅         | ✅      | ✅           |

## Recursos Adicionais

- [MDN PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
