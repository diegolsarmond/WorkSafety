# WorkSafety - Resumo de Configurações para Produção

## 📋 Resumo das Mudanças Realizadas

Este documento resume todas as alterações feitas para preparar o projeto WorkSafety para produção.

## 🎯 Objetivo Final

Configurar o projeto para:
- **App (WorkSafety)**: Acessível em `https://inovacao.dataprev.gov.br/worksafety/`
- **Admin Panel**: Acessível em `https://inovacao.dataprev.gov.br/admin/`
- **Backend API**: `http://200.152.38.136:8000/`
- **Ambos os frontends**: Servidos na mesma porta 3000 pelo Nginx

---

## 📁 Arquivos Criados

### 1. **`infra/nginx-prod.conf`** ✅
Configuração Nginx para servir ambos os frontends em caminhos diferentes:
- `/worksafety/` → App (React)
- `/admin/` → Admin Panel (React)
- `/api/*` → Proxy para Django Backend
- Porta: **3000**

**Características:**
- Compressão Gzip habilitada
- Cache de assets estáticos (1 ano)
- Proxy reverso para API
- SPA fallback (try_files para index.html)
- Health check endpoint em `/health`

### 2. **`infra/Dockerfile.prod`** ✅
Multi-stage Dockerfile para produção:
- **Stage 1**: Build Frontend App (Vite, output em `/worksafety/`)
- **Stage 2**: Build WorkSafetyWeb (Vite, output em `/admin/`)
- **Stage 3**: Nginx servindo ambos os frontends

### 3. **`infra/docker-compose.prod.yml`** ✅
Arquivo Docker Compose para produção com:
- PostgreSQL 16
- Redis 7
- Django Backend
- Celery Worker
- Nginx Frontend (ambos os projetos)
- Healthchecks configurados
- Restart policies
- Environment variables para .env.prod

### 4. **`backend/.env.prod`** ✅
Variáveis de ambiente para Django em produção:
- `DEBUG=false`
- `SECRET_KEY` (substituir com valor seguro)
- `ALLOWED_HOSTS` incluindo domínio e IP
- Segurança SSL habilitada
- Email e Celery configurados

### 5. **`frontend/.env.production`** ✅
Variáveis para Frontend App:
- `VITE_API_URL=/api/` (URL relativa para Nginx rotear)

### 6. **`WorkSafetyWeb/.env.production`** ✅
Variáveis para Admin Panel:
- `VITE_API_URL=/api/` (URL relativa para Nginx rotear)

### 7. **`PRODUCTION_DEPLOYMENT.md`** ✅
Guia completo de deployment com:
- Instruções passo-a-passo
- Docker Compose commands
- Migrações de banco
- Configuração de Nginx reverso externo (SSL/TLS)
- Troubleshooting
- Checklist de segurança
- Backup e manutenção

---

## 🔧 Modificações em Arquivos Existentes

### Frontend (App)

#### **`frontend/vite.config.ts`** ✅
```diff
+ const isProd = mode === 'production';
+ base: isProd ? '/worksafety/' : '/',
  manifest: {
+   start_url: isProd ? '/worksafety/' : '/',
+   scope: isProd ? '/worksafety/' : '/',
```
- Configurado para servir em `/worksafety/` em produção
- PWA manifest atualizado com scope correto

#### **`frontend/src/app/router.tsx`** ✅
```diff
+ const basename = import.meta.env.MODE === 'production' ? '/worksafety' : '/';
  <BrowserRouter basename={basename}>
```
- React Router agora usa basename correto para routing

### WorkSafetyWeb (Admin)

#### **`WorkSafetyWeb/vite.config.ts`** ✅
```diff
+ const isProd = mode === 'production';
+ base: isProd ? '/admin/' : '/',
```
- Configurado para servir em `/admin/` em produção

#### **`WorkSafetyWeb/server.ts`** ✅
```diff
- const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
+ const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
```
- Porta padrão mudada de 3001 para 3000

#### **`WorkSafetyWeb/src/App.tsx`** ✅
- Adicionado `basename={basename}` ao Router
- Removidos prefixos `/admin/` de todas as rotas (10 mudanças)
- Navegação ajustada para caminhos relativos
- Logout redirecionado para `/login` (não `/admin/login`)

```diff
+ const basename = import.meta.env.MODE === 'production' ? '/admin' : '/';
+ <Router basename={basename}>
  <Route path="/login" element={<Login />} />
  <Route path="/dashboard" element={...} />
  <Route path="/users" element={...} />
  // ... etc
```

#### **`WorkSafetyWeb/src/components/ProtectedRoute.tsx`** ✅
```diff
- return <Navigate to="/admin/login" replace />;
+ return <Navigate to="/login" replace />;
```
- Rota de login ajustada

#### **`WorkSafetyWeb/Dockerfile`** ✅
```diff
- EXPOSE 3001
+ EXPOSE 3000
```
- Porta mudada de 3001 para 3000

#### **`WorkSafetyWeb/src/App.tsx` - Navigation** ✅
```diff
  const navigation = [
-   { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
+   { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
-   { name: 'Usuários', href: '/admin/users', icon: Users },
+   { name: 'Usuários', href: '/users', icon: Users },
    // ... etc (10 itens)
```
- Todos os links de navegação atualizados

---

## 🚀 Fluxo de Acesso em Produção

```
1. Usuário acessa: https://inovacao.dataprev.gov.br/worksafety/
   ↓
2. Nginx reverso (200.152.47.9) roteia para 200.152.38.136:3000
   ↓
3. Container frontend (Nginx + ambos os apps) serve /worksafety/index.html
   ↓
4. React App carrega e faz requisições para /api/*
   ↓
5. Nginx roteia /api/* para backend:8000
   ↓
6. Django Backend processa requisição e responde

Mesma lógica para /admin/
```

---

## 🔐 Checklist de Configuração para Produção

### ⚠️ ANTES DE FAZER DEPLOY

- [ ] **Gerar SECRET_KEY segura**
  ```bash
  python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
  ```
  Editar em `backend/.env.prod`

- [ ] **Configurar DATABASE PASSWORD**
  - Alterar `POSTGRES_PASSWORD` em `backend/.env.prod`
  - Usar senha forte e aleatória

- [ ] **Configurar EMAIL**
  - Alterar `EMAIL_HOST_USER` e `EMAIL_HOST_PASSWORD`
  - Criar conta de email da Dataprev ou utilizar serviço específico

- [ ] **Configurar Olímpia API**
  - Obter `OLIMPIA_API_KEY` junto à Dataprev
  - Atualizar `OLIMPIA_API_BASE_URL` se diferente

- [ ] **Certificados SSL/TLS**
  - Preparar certificados para `inovacao.dataprev.gov.br`
  - Configurar no Nginx reverso externo

- [ ] **Versão de Build**
  - Verificar que `NODE_ENV=production` está configurado
  - Testar builds localmente: `npm run build` em ambos os frontends

---

## 📊 Estrutura de Portas

| Serviço | Porta | Acesso |
|---------|-------|--------|
| Frontend (App + Admin) | 3000 | Interno: localhost:3000 |
| Backend API | 8000 | Interno: backend:8000 |
| PostgreSQL | 5432 | Interno: db:5432 |
| Redis | 6379 | Interno: redis:6379 |
| Público HTTPS | 443 | https://inovacao.dataprev.gov.br |

---

## 🌐 URLs de Produção

| Serviço | URL |
|---------|-----|
| App (WorkSafety) | `https://inovacao.dataprev.gov.br/worksafety/` |
| Admin Panel | `https://inovacao.dataprev.gov.br/admin/` |
| API (direto) | `http://200.152.38.136:8000/api/` |
| API (via proxy) | `https://inovacao.dataprev.gov.br/api/` |

---

## 🧪 Testes Recomendados

```bash
# 1. Build das imagens
docker-compose -f infra/docker-compose.prod.yml build

# 2. Iniciar stack
docker-compose -f infra/docker-compose.prod.yml up -d

# 3. Verificar saúde dos serviços
docker-compose -f infra/docker-compose.prod.yml ps

# 4. Teste de conectividade do frontend
curl -I http://localhost:3000/health

# 5. Teste de API
curl http://localhost:3000/api/auth/login/

# 6. Teste do Nginx config
docker-compose -f infra/docker-compose.prod.yml exec frontend nginx -t

# 7. Logs para debugging
docker-compose -f infra/docker-compose.prod.yml logs -f frontend
```

---

## 📝 Próximos Passos

1. **Revisar todos os arquivos .env.prod**
   - Alterar valores sensíveis antes de fazer push

2. **Testar em staging**
   - Fazer deploy em ambiente de teste antes de produção

3. **Configurar monitoramento**
   - Prometheus + Grafana para métricas
   - ELK Stack para logs centralizados

4. **Documentação de Runbooks**
   - Criar procedimentos para escalação do sistema
   - Documentar processo de rollback

5. **Backup e DR**
   - Configurar backups automáticos de banco de dados
   - Testar restore procedures

---

## 📞 Contato e Suporte

Para problemas durante deployment, verifique:
1. [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) - Guia detalhado
2. Logs da aplicação: `docker-compose logs -f`
3. Validar arquivo de configuração: `docker-compose config`

---

**Versão**: 1.0  
**Data de Criação**: Março 2026  
**Status**: ✅ Pronto para Produção
