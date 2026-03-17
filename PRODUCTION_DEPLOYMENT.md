# WorkSafety - Production Deployment Guide

Este guia descreve como preparar e fazer deploy do projeto WorkSafety em produção.

## Arquitetura da Produção

```
User Browser (HTTP/HTTPS)
        ↓
Nginx Proxy (https://inovacao.dataprev.gov.br:443)
        ↓             
    ├─→ /worksafety  → Frontend App (React)
    ├─→ /admin       → Admin Panel (React)
    └─→ /api/*       → Django Backend (Port 8000)
        ↓
    Docker Compose Stack
    ├─ db (PostgreSQL 16)
    ├─ redis (Redis 7)
    ├─ backend (Django)
    ├─ worker (Celery)
    └─ frontend (Nginx com ambos os frontends)
```

## Configuração de IPs e Domínios

- **Backend**: `http://200.152.38.136:8000/`
- **Frontend (App)**: `https://inovacao.dataprev.gov.br/worksafety/`
- **Frontend (Admin)**: `https://inovacao.dataprev.gov.br/admin/`
- **Main Domain IP**: `200.152.47.9` (com roteamento para 200.152.38.136)

## Pré-requisitos

- Docker & Docker Compose instalados
- Git
- Acesso SSH ao servidor
- Certificados SSL/TLS para `inovacao.dataprev.gov.br`

## Passo 1: Preparar o Servidor

```bash
# Clonar repositório
git clone <repo-url> /opt/worksafety
cd /opt/worksafety

# Criar diretórios necessários
mkdir -p /opt/worksafety/logs
mkdir -p /opt/worksafety/media

# Definir permissões
chmod 755 /opt/worksafety
```

## Passo 2: Configurar Variáveis de Ambiente

### Arquivo: `backend/.env.prod`

Este arquivo já foi criado, mas você DEVE alterar:

1. **SECRET_KEY**: Gere uma chave segura:
```bash
python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

2. **POSTGRES_PASSWORD**: Mude para uma senha forte

3. **EMAIL_HOST_USER** e **EMAIL_HOST_PASSWORD**: Configure seu provedor de email

4. **OLIMPIA_API_KEY**: Obtenha da Dataprev

```bash
# Editar arquivo
nano /opt/worksafety/backend/.env.prod
```

### Arquivo: `infra/docker-compose.prod.yml`

Verifique se está pronto para usar:
```bash
cd /opt/worksafety
docker-compose -f infra/docker-compose.prod.yml config
```

## Passo 3: Compilar Imagens Docker

```bash
cd /opt/worksafety

# Build da imagem frontend (inclui App + Admin)
docker-compose -f infra/docker-compose.prod.yml build frontend

# Build das outras imagens
docker-compose -f infra/docker-compose.prod.yml build backend worker
```

## Passo 4: Iniciar Serviços

```bash
# Iniciar em background
docker-compose -f infra/docker-compose.prod.yml up -d

# Verificar status
docker-compose -f infra/docker-compose.prod.yml ps

# Ver logs
docker-compose -f infra/docker-compose.prod.yml logs -f
```

## Passo 5: Executar Migrações do Banco

```bash
# Aplicar migrações
docker-compose -f infra/docker-compose.prod.yml exec backend python manage.py migrate

# Criar superuser (admin)
docker-compose -f infra/docker-compose.prod.yml exec backend python manage.py createsuperuser

# Coletar arquivos estáticos (se necessário)
docker-compose -f infra/docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
```

## Passo 6: Configurar Nginx Reverso (no host)

**Nota**: O Dockerfile.prod já inclui Nginx internamente. Se você precisa de um Nginx reverso externo (para SSL/TLS), configure como:

```nginx
# /etc/nginx/sites-available/worksafety.conf

upstream worksafety_frontend {
    server 200.152.38.136:3000;
}

server {
    listen 80;
    server_name inovacao.dataprev.gov.br;
    
    # Redirecionar HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name inovacao.dataprev.gov.br;
    
    # Certificados SSL
    ssl_certificate /etc/letsencrypt/live/inovacao.dataprev.gov.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/inovacao.dataprev.gov.br/privkey.pem;
    
    # Segurança SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Proxy para aplicação
    location / {
        proxy_pass http://worksafety_frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_redirect off;
    }
}
```

## Passo 7: Testes de Acesso

```bash
# App
curl -I https://inovacao.dataprev.gov.br/worksafety/

# Admin
curl -I https://inovacao.dataprev.gov.br/admin/

# API
curl -I https://inovacao.dataprev.gov.br/api/health/
```

## Verificação de Saúde

### Backend API Health
```bash
curl http://200.152.38.136:8000/api/health/
```

### Frontend Health
```bash
curl http://200.152.38.136:3000/health
```

### Logs dos Serviços

```bash
# Backend
docker-compose -f infra/docker-compose.prod.yml logs backend

# Frontend/Nginx
docker-compose -f infra/docker-compose.prod.yml logs frontend

# Worker
docker-compose -f infra/docker-compose.prod.yml logs worker

# Database
docker-compose -f infra/docker-compose.prod.yml logs db
```

## Manutenção

### Backup do Banco de Dados

```bash
# Fazer backup
docker-compose -f infra/docker-compose.prod.yml exec db pg_dump -U worksafety worksafety > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup
docker-compose -f infra/docker-compose.prod.yml exec -T db psql -U worksafety worksafety < backup.sql
```

### Atualizar Código

```bash
# Pull das mudanças
git pull origin main

# Rebuild das imagens
docker-compose -f infra/docker-compose.prod.yml build

# Restart dos serviços
docker-compose -f infra/docker-compose.prod.yml up -d
```

### Monitoramento

Implemente monitoramento com ferramentas como:
- **Prometheus** para métricas
- **Grafana** para visualização
- **ELK Stack** para logs centralizados

## Troubleshooting

### Erro: "Connection refused" na API

Verifique:
```bash
docker-compose -f infra/docker-compose.prod.yml ps backend
docker-compose -f infra/docker-compose.prod.yml logs backend
```

### Erro: "Database is locked"

```bash
# Restart do banco
docker-compose -f infra/docker-compose.prod.yml restart db
```

### Erro: 404 em /worksafety ou /admin

Verifique:
```bash
# Verificar se build foi bem-sucedido
docker-compose -f infra/docker-compose.prod.yml logs frontend

# Verificar nginx config
docker-compose -f infra/docker-compose.prod.yml exec frontend nginx -t
```

## Segurança

### Checklist de Segurança

- [ ] Mudar SECRET_KEY do Django
- [ ] Mudar POSTGRES_PASSWORD
- [ ] Configurar SECRET de JWT
- [ ] Habilitar HTTPS/SSL
- [ ] Configurar firewall (ufw/iptables)
- [ ] Desabilitar SSH para root
- [ ] Configurar fail2ban
- [ ] Implementar rate limiting no Nginx
- [ ] Manter Docker atualizado
- [ ] Implementar monitoramento e alertas
- [ ] Configurar backups automáticos
- [ ] Revisar logs regularmente

## Suporte

Para erros ou dúvidas, verifique:
1. Logs do Docker: `docker-compose logs -f`
2. Status dos containers: `docker-compose ps`
3. Redes: `docker network ls` e `docker inspect <network_id>`
