# Integração com API de Usuários

Este documento descreve a integração do frontend WorkSafetyWeb com a API de usuários do backend Django.

## Configuração

### 1. Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
VITE_API_URL="http://localhost:3001"
```

Ou use o valor padrão que já está configurado no código.

### 2. Backend Django

Certifique-se de que o backend está rodando na porta 3001:

```bash
cd backend
python manage.py runserver 3001
```

O backend deve ter as seguintes URLs disponíveis:
- `POST /api/auth/login/` - Login
- `POST /api/auth/logout/` - Logout
- `GET /api/auth/me/` - Dados do usuário atual
- `POST /api/auth/token/refresh/` - Refresh do token JWT
- `GET /api/users/` - Listar usuários
- `POST /api/users/` - Criar usuário
- `PATCH /api/users/{id}/` - Atualizar usuário
- `GET /api/admin/assessment-types/` - Listar tipos de avaliação
- `POST /api/admin/assessment-types/` - Criar tipo de avaliação
- `PATCH /api/admin/assessment-types/{id}/` - Atualizar tipo de avaliação
- `POST /api/admin/assessment-types/{id}/deactivate/` - Desativar tipo de avaliação
- `GET /api/admin/environment-types/` - Listar tipos de ambiente
- `POST /api/admin/environment-types/` - Criar tipo de ambiente
- `PATCH /api/admin/environment-types/{id}/` - Atualizar tipo de ambiente
- `POST /api/admin/environment-types/{id}/deactivate/` - Desativar tipo de ambiente
- `GET /api/admin/risk-types/` - Listar tipos de risco
- `POST /api/admin/risk-types/` - Criar tipo de risco
- `PATCH /api/admin/risk-types/{id}/` - Atualizar tipo de risco
- `POST /api/admin/risk-types/{id}/deactivate/` - Desativar tipo de risco
- `GET /api/admin/ai-thresholds/` - Listar thresholds da IA
- `PUT /api/admin/ai-thresholds/confidence/` - Atualizar threshold de confiança
- `GET /api/admin/ai-thresholds/confidence/current/` - Obter threshold atual

## Arquitetura da Integração

### Serviços (`src/services/api.ts`)

O arquivo `api.ts` contém:

1. **Tipos de Dados**: Interfaces TypeScript para User, CreateUserData, etc.
2. **Cliente HTTP**: Função `fetchWithAuth` que automaticamente:
   - Adiciona o token JWT nas requisições
   - Gerencia o refresh do token quando expira
   - Trata erros da API
3. **Serviços**:
   - `authService`: Login, logout, dados do usuário
   - `userService`: CRUD de usuários

### Hooks

#### useAuth (`src/hooks/useAuth.ts`)

Gerencia o estado de autenticação:

```typescript
const { 
  user,           // Dados do usuário logado
  isAuthenticated,// Booleano
  isLoading,      // Estado de carregamento
  error,          // Erro de autenticação
  login,          // Função de login
  logout,         // Função de logout
  checkAuth,      // Verifica autenticação
  clearError      // Limpa erros
} = useAuth();
```

#### useUsers (`src/hooks/useUsers.ts`)

Gerencia o estado dos usuários:

```typescript
const {
  users,          // Lista de usuários
  isLoading,      // Estado de carregamento
  error,          // Erro da API
  fetchUsers,     // Recarrega a lista
  createUser,     // Cria novo usuário
  updateUser,     // Atualiza usuário
  deactivateUser, // Desativa usuário
  activateUser,   // Ativa usuário
  clearError      // Limpa erros
} = useUsers();
```

### Componentes

#### ProtectedRoute (`src/components/ProtectedRoute.tsx`)

Protege rotas que requerem autenticação:

```tsx
<ProtectedRoute requireAdmin>
  <UsersPage />
</ProtectedRoute>
```

## Fluxo de Autenticação

1. Usuário faz login na página `/login`
2. Backend retorna tokens JWT (access + refresh)
3. Tokens são armazenados no localStorage
4. Todas as requisições incluem o token no header `Authorization: Bearer {token}`
5. Quando o token expira (401), o sistema tenta refresh automático
6. Se refresh falhar, usuário é redirecionado para login

## Páginas Integradas

### Login (`src/pages/Login.tsx`)

- Formulário de login
- Validação de credenciais
- Redirecionamento automático após login

### Users (`src/pages/Users.tsx`)

- Lista usuários da API
- Estatísticas (total, ativos, admins)
- Criar novo usuário (modal)
- Ativar/desativar usuário
- Protegida por autenticação de admin

## Mapeamento de Dados

### Backend → Frontend

| Backend | Frontend | Descrição |
|---------|----------|-----------|
| `id` | `id` | ID do usuário |
| `email` | `email` | E-mail |
| `first_name + last_name` | `name` | Nome completo |
| `is_staff` | `is_staff`, `role` | Papel (admin/inspector) |
| `is_active` | `is_active`, `isActive` | Status ativo |
| `date_joined` | `date_joined` | Data de criação |

### Operações CRUD

| Operação | Método HTTP | Endpoint | Body |
|----------|-------------|----------|------|
| Listar | GET | `/api/users/` | - |
| Criar | POST | `/api/users/` | `{email, password, is_staff}` |
| Atualizar | PATCH | `/api/users/{id}/` | `{is_active, is_staff}` |
| Desativar | PATCH | `/api/users/{id}/` | `{is_active: false}` |
| Listar Tipos de Avaliação | GET | `/api/admin/assessment-types/` | - |
| Criar Tipo de Avaliação | POST | `/api/admin/assessment-types/` | `{name, description}` |
| Atualizar Tipo de Avaliação | PATCH | `/api/admin/assessment-types/{id}/` | `{name, description}` |
| Desativar Tipo de Avaliação | POST | `/api/admin/assessment-types/{id}/deactivate/` | - |
| Listar Tipos de Ambiente | GET | `/api/admin/environment-types/` | - |
| Criar Tipo de Ambiente | POST | `/api/admin/environment-types/` | `{name, description}` |
| Atualizar Tipo de Ambiente | PATCH | `/api/admin/environment-types/{id}/` | `{name, description}` |
| Desativar Tipo de Ambiente | POST | `/api/admin/environment-types/{id}/deactivate/` | - |
| Listar Tipos de Risco | GET | `/api/admin/risk-types/` | - |
| Criar Tipo de Risco | POST | `/api/admin/risk-types/` | `{name, description}` |
| Atualizar Tipo de Risco | PATCH | `/api/admin/risk-types/{id}/` | `{name, description}` |
| Desativar Tipo de Risco | POST | `/api/admin/risk-types/{id}/deactivate/` | - |
| Obter Threshold IA | GET | `/api/admin/ai-thresholds/confidence/current/` | - |
| Atualizar Threshold IA | PUT | `/api/admin/ai-thresholds/confidence/` | `{threshold_value: 60}` |

## Testando a Integração

1. Inicie o backend:
   ```bash
   cd backend
   python manage.py runserver 3001
   ```

2. Inicie o frontend:
   ```bash
   cd WorkSafetyWeb
   npm run dev
   ```

3. Acesse `http://localhost:5173` (ou a porta do Vite)

4. Faça login com credenciais válidas do Django

5. Navegue até "Usuários" no menu lateral

## Troubleshooting

### Erro de CORS

Se ocorrer erro de CORS, adicione ao `settings.py` do Django:

```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
```

### Token expirando rapidamente

O sistema tenta fazer refresh automático. Se falhar, verifique:
- O endpoint `/auth/token/refresh/` está funcionando
- O refresh token está sendo salvo corretamente

### Erro 403 Forbidden

Apenas administradores (`is_staff=true`) podem acessar `/users/`. Verifique se o usuário logado tem permissão de admin.
