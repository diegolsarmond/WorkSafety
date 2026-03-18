# WorkSafety

Monorepo do projeto WorkSafety (Plataforma de Prevenção e Segurança no Trabalho com IA).

O WorkSafety é uma solução completa para análise de riscos utilizando IA, contando com aplicativo móvel (PWA), painel administrativo e um backend robusto em Django.

## 📚 Documentação Completa

Para um guia definitivo e unificado de todas as áreas do projeto, acesse:
👉 **[DOCUMENTACAO_UNIFICADA.md](DOCUMENTACAO_UNIFICADA.md)**

## 🏗️ Estrutura do Projeto

- **`backend/`** — API em Django (REST, JWT, auth), integração Celery/Redis para processamento assíncrono de IA (Integração Olímpia API).
- **`frontend/`** — Aplicativo Móvel PWA (React + Vite) usado para inspeções e captura de imagens de riscos no local de trabalho.
- **`WorkSafetyWeb/`** — Painel Administrativo Web (React + Vite) usado para gerenciar inspeções, usuários, visualizar relatórios e pagamentos.
- **`infra/`** — Orquestração de containers com Docker Compose. Contém as configurações para ambiente local e de produção (PostgreSQL, Redis, Celery, Nginx proxy).

## 🚀 Como Executar Localmente

### Pré-requisitos
- Docker e Docker Compose instalados.
- Node.js 18+ (para rodar o frontend separadamente)

### Opção 1: Scripts Automáticos (Recomendado)

**Apenas Backend (Docker) + Frontend (Node):**
```powershell
# Terminal 1: Iniciar backend (PostgreSQL, Redis, Django, Celery)
.\start-backend-docker.ps1

# Terminal 2: Iniciar frontend
 cd frontend
 npm install
 npm run dev
```

**Parar backend:**
```powershell
.\stop-backend-docker.ps1
```

### Opção 2: Comandos Manuais

1. **Subir toda a infraestrutura (Backend, Banco de Dados, Redis, Celery Worker):**
   ```bash
   cd infra
   docker-compose up -d --build
   ```

   Ou apenas o backend (sem frontend):
   ```bash
   docker-compose up -d db redis backend worker
   ```

2. **Backend (API):**
   A API estará rodando em `http://localhost:8000`. Crie um superusuário para acessar o sistema:
   ```bash
   docker-compose exec backend python manage.py createsuperuser
   ```

3. **Frontend App (PWA para os trabalhadores/inspetores):**
   ```bash
   cd frontend
   npm install
   npm run dev
   # Acessível em http://localhost:3000
   ```

4. **WorkSafetyWeb (Painel Admin):**
   ```bash
   cd WorkSafetyWeb
   npm install
   npm run dev
   # Acessível em http://localhost:3000 ou 3001 (dependendo da porta configurada localmente)
   ```

*(Nota: Em produção, ambos os frontends rodam sob a mesma porta controlados pelo Nginx em contextos separados `/worksafety/` e `/admin/`)*.

### Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `start-backend-docker.ps1` | Inicia apenas o backend via Docker |
| `stop-backend-docker.ps1` | Para os containers do backend |
| `status-docker.ps1` | Mostra status dos containers |
| `clear-cache-restart.ps1` (frontend) | Limpa cache e reinicia o frontend |

---

Para detalhes sobre deploy em produção, variáveis de ambiente ou funcionamento da submissão assíncrona de IA, consulte a [Documentação Unificada](DOCUMENTACAO_UNIFICADA.md).
