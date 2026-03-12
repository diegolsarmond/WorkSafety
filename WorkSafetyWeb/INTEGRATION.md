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
- `POST /auth/login/` - Login
- `POST /auth/logout/` - Logout
- `GET /auth/me/` - Dados do usuário atual
- `POST /auth/token/refresh/` - Refresh do token JWT
- `GET /users/` - Listar usuários
- `POST /users/` - Criar usuário
- `PATCH /users/{id}/` - Atualizar usuário

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
| Listar | GET | `/users/` | - |
| Criar | POST | `/users/` | `{email, password, is_staff}` |
| Atualizar | PATCH | `/users/{id}/` | `{is_active, is_staff}` |
| Desativar | PATCH | `/users/{id}/` | `{is_active: false}` |

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
