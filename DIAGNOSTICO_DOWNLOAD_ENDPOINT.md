# DIAGNÓSTICO: Problema com `/worksafety/api/reports/*/download/`

## PROBLEMAS IDENTIFICADOS

### 🔴 Problema 1: Nginx NÃO ESTÁ RODANDO
- **Status**: ❌ Nginx container NÃO existe em docker-compose.yml
- **Porto esperado**: 3000
- **O que deveria estar rodando**: `infra/frontend.Dockerfile.local` com Nginx
- **Configuração Nginx**: `infra/nginx-local.conf` existe, MAS não está sendo usada

### 🔴 Problema 2: Backend em estado "Unhealthy"
```
infra-backend-1     Up 4 hours (unhealthy)
```
- O healthcheck do backend está falhando
- Impossível testar o endpoint corretamente

### 🔴 Problema 3: Missing Frontend Service
- `docker-compose.override.yml` está na **raiz**, não em `infra/`
- O arquivo sugere copiar para `infra/docker-compose.override.yml`, mas não foi feito
- Resultado: Serviço frontend não está rodando em 3000

### 🟡 O que está rodando
```
infra-admin-web-1   3001  (WorkSafetyWeb)
infra-backend-1     8000  (unhealthy)
infra-db-1          5432
infra-redis-1       6379
infra-worker-1      (background)
```

---

## ROOT CAUSE: Por que `/worksafety/api/reports/*/download/` não funciona?

**Porque Nginx não está rodando!**

A rewrite rule:
```nginx
location /worksafety/api/ {
    rewrite ^/worksafety/api/(.*)$ /api/$1 break;
    proxy_pass http://backend;
}
```

**NUNCA é executada** porque não há Nginx rodando em 3000.

---

## VERIFICAÇÃO DO BACKEND (8000)

Tentamos testar `/api/reports/10/download/` direto em `http://localhost:8000`:
- Status: **301 (Redirect)**
- Problema: Está redirecionando (provavelmente HTTPS ou trailing slash)

O backend está com status "unhealthy", indicando problemas com health check ou migrations.

---

## SOLUÇÃO: Como colocar tudo funcionando

### Passo 1: Verificar por que Backend está "unhealthy"
```bash
cd infra
docker-compose logs backend | tail -100
```

Procure por:
- Erros de migration
- Erros de banco de dados
- Erros de timeoutOs logs mostram error de migration:
```
ValueError: Indexes passed to AddIndex operations require a name argument. 
<Index: fields=['evidence', '-created_at']> doesn't have one.
```

### Passo 2: Colocar Nginx + Frontend funcionando

**Opção A: Usar docker-compose.override.yml corretamente**
```bash
cd infra
cp ../docker-compose.override.yml ./docker-compose.override.yml
docker-compose up -d
```

Isso iniciará:
- Nginx em 3000
- Admin em 3001
- Backend em 8000

**Opção B: Adicionar frontend ao docker-compose.yml**
```yaml
  frontend:
    build:
      context: ..
      dockerfile: infra/frontend.Dockerfile.local
    ports:
      - "3000:3000"
    depends_on:
      - backend
```

### Passo 3: Corrigir problemas do Backend

1. **Fix Migration Error** (0014_lgpd_privacy_compliance.py)
   ```python
   # Adicione 'name=' aos indexes:
   migrations.AddIndex(
       model_name='evidence',
       index=models.Index(fields=['evidence', '-created_at'], name='evidence_created_idx'),
   ),
   ```

2. **Reiniciar o Backend**
   ```bash
   docker-compose restart backend
   docker-compose logs backend -f
   ```

---

## TESTE FINAL: Como reproduzir o erro

1. **Copie o override.yml para infra:**
```bash
cp docker-compose.override.yml infra/
cd infra
docker-compose up -d
```

2. **Confirme que tudo está saudável:**
```bash
docker-compose ps
docker-compose logs backend | head -20
```

3. **Teste direto no backend (sem Nginx):**
```bash
# Encontre um report_id que exista em backend/media/reports/2026/03/
curl -v "http://localhost:8000/api/reports/1/download/"
```

4. **Teste via Nginx (com rewrite):**
```bash
curl -v "http://localhost:3000/worksafety/api/reports/1/download/"
```

**Se ambos retornam 200:** ✅ Problema resolvido!

**Se apenas backend 200 e Nginx 404:** ⚠️ Problema na rewrite (configure proxy_pass `http://backend:8000` ao invés de `http://backend`)

**Se ambos 404 ou backend 301:** ⚠️ Problema no Django (arquivo ausente ou permissão)

---

## CHECKLIST DE DIAGNÓSTICO

- [ ] Backend não está unhealthy?
- [ ] Migration error fixado?
- [ ] Nginx está rodando em 3000?
- [ ] Frontend build completo?
- [ ] Arquivo `/app/media/reports/2026/03/report_*.pdf` existe?
- [ ] Testou com curl direto no backend?
- [ ] Testou com curl via Nginx?
- [ ] Logs do Nginx mostram rewrite correto?

---

## ARQUIVOS RELEVANTES

- [infra/docker-compose.yml](infra/docker-compose.yml) - Falta serviço frontend/nginx
- [docker-compose.override.yml](docker-compose.override.yml) - Deve estar em infra/
- [infra/frontend.Dockerfile.local](infra/frontend.Dockerfile.local) - Dockerfile com Nginx
- [infra/nginx-local.conf](infra/nginx-local.conf) - Config Nginx (não está sendo usada)
- [backend/assessments/migrations/0014_lgpd_privacy_compliance.py](backend/assessments/migrations/0014_lgpd_privacy_compliance.py) - Migration com erro

---

## PRÓXIMOS PASSOS IMEDIATOS

1. Verificar logs do backend para entender o erro de healthcheck
2. Corrigir a migration ou fazer rollback
3. Colocar o frontend/nginx funcionando
4. Testar a rewrite rule com curl

**Comando para começar:**
```bash
cd infra
docker-compose logs backend | grep -i "error\|fail\|unhealthy" | head -50
```
