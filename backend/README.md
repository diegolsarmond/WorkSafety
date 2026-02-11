# WorkSafety Backend (Django)

API REST de autenticação (login/logout) com JWT, lockout após 5 falhas, blacklist de refresh token, modelo de avaliações de risco, gestão de usuários (admin) e reset de senha.

## Sprint 1 — Entregas

- **F20.1 + F6.1** — Login (email/senha, JWT access + refresh).
- **F20.5** — Logout seguro (blacklist do refresh token).
- **JWT** — djangorestframework-simplejwt com token_blacklist.
- **Lockout** — 5 falhas / 15 min (configurável).
- **Swagger/OpenAPI** — drf-spectacular em `/schema/` e `/docs/`.
- **Docker** — Compose com backend + Postgres.
- **F12.1–F12.6** — Modelo de dados: app `assessments` (RiskAssessment, Evidence, RiskFinding, AIInferenceResult, HumanValidationDecision); User mantido em `accounts`; MEDIA_ROOT para evidências; migrations.
- **F4.4** — Segurança: settings de produção (TLS via proxy, cookies seguros, redirect HTTPS); README com volumes criptografados e checklist de deploy.
- **F17.1** — Gestão de usuários: endpoints `/users/` (listar, criar, detalhe, PATCH/desativar); apenas admin (`IsAdminUser`).
- **F17.4** — Reset de senha: solicitar (email) e confirmar (uidb64 + token + nova senha); respostas genéricas; PasswordResetTokenGenerator + uidb64 (sem persistência).
- **Testes** — auth (login, logout, lockout), modelos assessments, user management, password reset.

## Pré-requisitos

- Docker e Docker Compose
- Ou: Python 3.12+, PostgreSQL (para rodar sem Docker)

## Configuração

1. Copie o arquivo de ambiente:
   ```bash
   cp .env.example .env
   ```
2. Ajuste `SECRET_KEY` e, se quiser, `POSTGRES_PASSWORD` em `.env`.

## Subir com Docker Compose (recomendado)

Na raiz do repositório (monorepo):

```bash
cd infra
docker compose up -d
```

O backend sobe na porta **8000** e aplica as migrations automaticamente ao iniciar.

### Criar um usuário para testar login

Com os containers em execução:

```bash
docker compose -f infra/docker-compose.yml run --rm backend python manage.py createsuperuser
```

Informe **email** (no lugar de username) e senha.

### Testar login

```bash
curl -X POST http://localhost:8000/auth/login/ \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"seu@email.com\", \"password\": \"suasenha\"}"
```

Resposta esperada (200): `{"access":"...", "refresh":"...", "user":{"id":1,"email":"seu@email.com"}}`.

### Documentação da API (Swagger)

- Schema OpenAPI: http://localhost:8000/schema/
- Swagger UI: http://localhost:8000/docs/

## Rodar sem Docker (local)

1. Crie um banco PostgreSQL e defina `DATABASE_URL` ou `POSTGRES_*` no `.env`.
2. No diretório `backend/`:
   ```bash
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py createsuperuser
   python manage.py runserver
   ```

## Testes

Com Docker (usa PostgreSQL do compose):

```bash
docker compose -f infra/docker-compose.yml run --rm backend python manage.py test accounts.tests assessments.tests -v 2
```

Sem Docker, com SQLite (não precisa de Postgres):

```bash
cd backend
set TESTING=1
python manage.py test accounts.tests assessments.tests -v 2
```

No PowerShell:

```powershell
$env:TESTING="1"; python manage.py test accounts.tests assessments.tests -v 2
```

## Segurança (F4.4)

### Criptografia em trânsito

- **Desenvolvimento:** o tráfego é HTTP (sem TLS).
- **Produção:** use um reverse proxy (Nginx, Traefik, etc.) com **TLS 1.2+** na frente do Django; configure redirecionamento HTTP → HTTPS no proxy. Defina no ambiente:
  - `SECURE_HTTPS=1`
  O Django aplica então: `SECURE_PROXY_SSL_HEADER`, `CSRF_COOKIE_SECURE`, `SESSION_COOKIE_SECURE`, `SECURE_SSL_REDIRECT` (confiando no header `X-Forwarded-Proto: https` enviado pelo proxy).

### Criptografia em repouso (MVP)

- **Banco (PostgreSQL):** os dados ficam no volume/disco do provedor. Garanta que o **volume do Postgres seja criptografado** no host ou no provedor (ex.: LUKS, EBS encryption, disco criptografado).
- **Arquivos (MEDIA):** evidências são armazenadas em `MEDIA_ROOT`. Garanta que o **volume ou diretório de mídia seja criptografado** no host/provedor.
- Criptografia “no app” (campos sensíveis, etc.) não está no escopo do MVP; evoluções podem ser tratadas em Sprint/infra futura.

### Checklist de deploy (produção)

- [ ] Reverse proxy com TLS 1.2+ e HTTP → HTTPS configurado.
- [ ] Variável `SECURE_HTTPS=1` no ambiente de produção.
- [ ] Volume do PostgreSQL criptografado (host/provedor).
- [ ] Volume ou diretório de MEDIA criptografado (host/provedor).
- [ ] `SECRET_KEY` forte e não commitada; `DEBUG=false`.

## Variáveis de ambiente (.env)

| Variável | Descrição | Default |
|----------|-----------|---------|
| `SECRET_KEY` | Chave secreta Django | (dev) |
| `DATABASE_URL` | URL PostgreSQL (postgres://user:pass@host:port/db) | - |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT` | Conexão Postgres (se não usar DATABASE_URL) | worksafety / localhost:5432 |
| `ACCESS_TOKEN_LIFETIME_MINUTES` | Tempo de vida do access token JWT (min) | 60 |
| `REFRESH_TOKEN_LIFETIME_DAYS` | Tempo de vida do refresh token (dias) | 7 |
| `LOCKOUT_MAX_ATTEMPTS` | Tentativas antes de bloquear | 5 |
| `LOCKOUT_MINUTES` | Minutos de bloqueio | 15 |
| `PASSWORD_RESET_TIMEOUT` | Expiração do token de reset de senha (segundos) | 3600 |
| `SECURE_HTTPS` | Se `1`, ativa cookies seguros e redirect HTTPS (produção) | 0 |
| `TESTING` | Se `1`, usa SQLite para testes | - |

## Endpoints

### Autenticação

- **POST /auth/login/** — Login (email + senha). Retorna `access`, `refresh` e `user`. 401 credenciais inválidas, 429 conta bloqueada.
- **POST /auth/logout/** — Body: `{"refresh": "<token>"}`. Invalida o refresh token (204).
- **POST /auth/token/refresh/** — Body: `{"refresh": "<token>"}`. Retorna novo access token.
- **POST /auth/password-reset/** — Solicitar redefinição de senha (body: `{"email": "..."}`). Resposta sempre genérica (200).
- **POST /auth/password-reset/confirm/** — Confirmar nova senha (body: `{"uidb64": "...", "token": "...", "new_password": "..."}`). 200 ou 400 genérico.

### Gestão de usuários (apenas admin — JWT com is_staff)

- **GET /users/** — Listar usuários.
- **POST /users/** — Cadastrar usuário (body: `{"email": "...", "password": "..."}`).
- **GET /users/<id>/** — Detalhe do usuário.
- **PATCH /users/<id>/** — Atualizar (ex.: `{"is_active": false}` para desativar).
