# Backend Docker - WorkSafety

Scripts para iniciar apenas o backend via Docker (sem frontend).

## Scripts Disponiveis

### PowerShell (Recomendado)
```powershell
# Iniciar backend
.\start-backend-docker.ps1

# Parar backend
.\stop-backend-docker.ps1

# Ver status
.\status-docker.ps1
```

### CMD/Batch
```cmd
# Iniciar backend
start-backend-docker.bat

# Parar backend
stop-backend-docker.bat
```

## Servicos Iniciados

| Servico     | Porta  | Descricao                    |
|-------------|--------|------------------------------|
| PostgreSQL  | 5432   | Banco de dados principal    |
| Redis       | 6379   | Cache e fila de tarefas     |
| Django API  | 8000   | Backend REST API            |
| Celery      | -      | Processamento em background |

**Nao inclui:** Frontend (voce deve iniciar manualmente)

## Fluxo de Trabalho Recomendado

### 1. Terminal 1 - Backend
```powershell
.\start-backend-docker.ps1
```

### 2. Terminal 2 - Frontend
```powershell
cd frontend
npm run dev
```

### 3. Acesse a aplicacao
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/api/docs/

## Comandos Uteis

### Ver logs em tempo real
```powershell
docker-compose -f infra/docker-compose.yml logs -f
```

### Ver logs de um servico especifico
```powershell
docker-compose -f infra/docker-compose.yml logs -f backend
docker-compose -f infra/docker-compose.yml logs -f worker
```

### Reiniciar um servico
```powershell
docker-compose -f infra/docker-compose.yml restart backend
```

### Executar comandos no container Django
```powershell
# Shell do Django
docker-compose -f infra/docker-compose.yml exec backend python manage.py shell

# Makemigrations
docker-compose -f infra/docker-compose.yml exec backend python manage.py makemigrations

# Migrate
docker-compose -f infra/docker-compose.yml exec backend python manage.py migrate

# Criar superusuario
docker-compose -f infra/docker-compose.yml exec backend python manage.py createsuperuser
```

## Solucao de Problemas

### Porta em uso
Se alguma porta estiver em uso, voce pode parar o servico local:
```powershell
# Windows - parar PostgreSQL local
Stop-Service postgresql-x64-15

# Ou verifique o que esta usando a porta
netstat -ano | findstr :8000
```

### Limpar tudo e recomecar
```powershell
# Parar e remover containers
.\stop-backend-docker.ps1

# Remover volumes (perde todos os dados)
docker-compose -f infra/docker-compose.yml down -v

# Reconstruir imagens
docker-compose -f infra/docker-compose.yml build --no-cache

# Iniciar novamente
.\start-backend-docker.ps1
```

### Erro de permissao no Linux/Mac
```bash
chmod +x start-backend-docker.ps1
```

## Problema de Encoding

Se voce ver caracteres estranhos no terminal, execute antes:
```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
```
