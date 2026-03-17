# Configuração de Ambiente Local

Este documento explica como configurar o ambiente de desenvolvimento local **SEM** o prefixo `/worksafety` nas URLs.

## Arquivos de Configuração Local

Os seguintes arquivos são usados apenas para desenvolvimento local e **não devem ser commitados**:

### Infraestrutura Docker
- `infra/frontend.Dockerfile.local` - Dockerfile para build local
- `infra/nginx-local.conf` - Configuração nginx sem `/worksafety`
- `docker-compose.override.yml` - Override do docker-compose

### Frontend (App Principal)
- `frontend/vite.config.ts.local` - Vite config com `base: '/'`
- `frontend/src/app/router.tsx.local` - Router com `basename: '/'`

### Admin (WorkSafetyWeb)
- `WorkSafetyWeb/vite.config.ts.local` - Vite config com `base: '/admin/'`
- `WorkSafetyWeb/src/App.tsx.local` - Router com `basename: '/admin'`

### Scripts
- `start-local.bat` / `start-local.sh` - Scripts para iniciar ambiente local

## Como Usar

### Opção 1: Script Automático (Recomendado)

**Windows:**
```batch
start-local.bat
```

**Linux/Mac:**
```bash
chmod +x start-local.sh
./start-local.sh
```

### Opção 2: Usando Docker Compose Override

```bash
# Copiar o override para dentro da pasta infra
cp docker-compose.override.yml infra/

# Aplicar configurações locais nos arquivos fonte
cp infra/frontend.Dockerfile.local infra/frontend.Dockerfile
cp infra/nginx-local.conf infra/nginx-prod.conf
cp frontend/vite.config.ts.local frontend/vite.config.ts
cp frontend/src/app/router.tsx.local frontend/src/app/router.tsx
cp WorkSafetyWeb/vite.config.ts.local WorkSafetyWeb/vite.config.ts
cp WorkSafetyWeb/src/App.tsx.local WorkSafetyWeb/src/App.tsx

# Iniciar Docker
cd infra
docker-compose down
docker-compose build --no-cache frontend
docker-compose up -d
```

### Opção 3: Desenvolvimento sem Docker

```bash
# Frontend (app principal)
cd frontend
cp vite.config.ts.local vite.config.ts
cp src/app/router.tsx.local src/app/router.tsx
npm install
npm run dev

# Admin (em outro terminal)
cd WorkSafetyWeb
cp vite.config.ts.local vite.config.ts
cp src/App.tsx.local src/App.tsx
npm install
npm run dev
```

## URLs após configuração local

| Serviço | URL |
|---------|-----|
| App Principal | http://localhost:3000 |
| Admin | http://localhost:3000/admin |
| API | http://localhost:8000 |

## Diferenças entre Produção e Local

| Aspecto | Produção | Local |
|---------|----------|-------|
| Base URL | `/worksafety/` | `/` |
| Admin URL | `/worksafety/admin/` | `/admin/` |
| Build | Otimizado | Debug |

## Restaurar Configurações de Produção

Se precisar voltar para as configurações de produção:

```bash
# Reverter todos os arquivos modificados
git checkout HEAD -- infra/frontend.Dockerfile infra/nginx-prod.conf
```

Ou simplesmente não aplique os arquivos `.local`.

## Notas Importantes

⚠️ **NUNCA commit arquivos `.local`** - Eles já estão no `.gitignore`

⚠️ **Arquivos na main** mantêm sempre o prefixo `/worksafety` para produção

⚠️ **Sempre verifique** se está usando as configurações corretas antes de fazer deploy
