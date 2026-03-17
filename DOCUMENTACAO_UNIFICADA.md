# Documentação Completa do WorkSafety

Índice:
- [AI_PIPELINE_INSTRUCTIONS.md](#AI_PIPELINE_INSTRUCTIONS)
- [AI_PROCESSING_FIX.md](#AI_PROCESSING_FIX)
- [DOCKER_CHEATSHEET.md](#DOCKER_CHEATSHEET)
- [DOCKER_LGPD_SETUP.md](#DOCKER_LGPD_SETUP)
- [MUDANCAS_API_OLIMPIA.md](#MUDANCAS_API_OLIMPIA)
- [OLIMPIA_INTEGRATION.md](#OLIMPIA_INTEGRATION)
- [PRODUCTION_DEPLOYMENT.md](#PRODUCTION_DEPLOYMENT)
- [PRODUCTION_SUMMARY.md](#PRODUCTION_SUMMARY)
- [README.md](#README)
- [SOLUCAO_CONFIANCA_FINAL.md](#SOLUCAO_CONFIANCA_FINAL)
- [TESTE_CONFIANCA.md](#TESTE_CONFIANCA)
- [WINDOWS_SETUP.md](#WINDOWS_SETUP)
- [WorkSafetyWeb\INTEGRATION.md](#WorkSafetyWeb-INTEGRATION)
- [WorkSafetyWeb\README.md](#WorkSafetyWeb-README)
- [backend\LGPD_PRIVACY_IMPLEMENTATION.md](#backend-LGPD_PRIVACY_IMPLEMENTATION)
- [backend\README.md](#backend-README)
- [backend\configurations\README.md](#backend-configurations-README)
- [frontend\PWA.md](#frontend-PWA)
- [frontend\README.md](#frontend-README)
- [frontend\SECURITY.md](#frontend-SECURITY)
- [frontend\docs\RISK_INTEGRATION.md](#frontend-docs-RISK_INTEGRATION)
- [frontend\docs\SYNC_SYSTEM.md](#frontend-docs-SYNC_SYSTEM)

---

<a id="AI_PIPELINE_INSTRUCTIONS"></a>
# Arquivo: AI_PIPELINE_INSTRUCTIONS.md

# Pipeline AssÃ­ncrono de IA - InstruÃ§Ãµes de ExecuÃ§Ã£o

Este documento descreve como executar o pipeline assÃ­ncrono de processamento de IA do WorkSafety.

## Arquitetura

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚   Django    â”‚â”€â”€â”€â”€â–¶â”‚  Redis  â”‚â—€â”€â”€â”€â”€â”‚   Worker    â”‚
â”‚   Backend   â”‚     â”‚  Queue  â”‚     â”‚   Celery    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
       â”‚                                    â”‚
       â”‚                                    â”‚
       â–¼                                    â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ PostgreSQL  â”‚                     â”‚  AI Service â”‚
â”‚   (dados)   â”‚                     â”‚  (Mock/Real)â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

## ExecuÃ§Ã£o com Docker Compose (Recomendado)

### 1. Configurar Ambiente

```bash
# Copiar arquivo de exemplo
cp backend/.env.example backend/.env

# Editar se necessÃ¡rio (valores padrÃ£o funcionam para docker-compose)
```

### 2. Subir Todos os ServiÃ§os

```bash
cd infra
docker compose up -d
```

Isso inicia:
- **PostgreSQL** (porta 5432)
- **Redis** (porta 6379)
- **Backend Django** (porta 8000)
- **Worker Celery** (processamento assÃ­ncrono)

### 3. Aplicar MigraÃ§Ãµes

```bash
docker compose exec backend python manage.py migrate
```

### 4. Criar SuperusuÃ¡rio

```bash
docker compose exec backend python manage.py createsuperuser
```

### 5. Verificar Logs

```bash
# Backend
docker compose logs -f backend

# Worker (processamento de IA)
docker compose logs -f worker

# Redis
docker compose logs -f redis
```

## ExecuÃ§Ã£o Local (Sem Docker)

### PrÃ©-requisitos

- Python 3.12+
- PostgreSQL
- Redis

### 1. Instalar DependÃªncias

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configurar Banco de Dados

Crie um banco PostgreSQL e configure `.env`:

```env
POSTGRES_DB=worksafety
POSTGRES_USER=worksafety
POSTGRES_PASSWORD=worksafety
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Redis
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

### 3. Iniciar Redis

```bash
# Ubuntu/Debian
sudo service redis-server start

# macOS
brew services start redis

# Windows (WSL)
sudo service redis-server start
```

### 4. Aplicar MigraÃ§Ãµes

```bash
cd backend
python manage.py migrate
```

### 5. Iniciar Worker (Terminal 1)

```bash
cd backend
celery -A config worker --loglevel=info
```

### 6. Iniciar Backend (Terminal 2)

```bash
cd backend
python manage.py runserver
```

## Testando o Pipeline

### 1. Criar AvaliaÃ§Ã£o

```bash
curl -X POST http://localhost:8000/api/v1/assessments/ \
  -H "Authorization: Bearer <seu_token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "AvaliaÃ§Ã£o de Teste", "description": "Teste do pipeline de IA"}'
```

### 2. Fazer Upload de EvidÃªncias

```bash
curl -X POST http://localhost:8000/api/v1/assessments/1/evidences/ \
  -H "Authorization: Bearer <seu_token>" \
  -F "images=@foto1.jpg" \
  -F "images=@foto2.jpg"
```

### 3. Capturar AvaliaÃ§Ã£o

```bash
curl -X POST http://localhost:8000/api/v1/assessments/1/capture/ \
  -H "Authorization: Bearer <seu_token>"
```

### 4. Sincronizar (Dispara Processamento AutomÃ¡tico)

```bash
curl -X POST http://localhost:8000/api/v1/assessments/1/sync/ \
  -H "Authorization: Bearer <seu_token>"
```

ApÃ³s este passo, o processamento de IA Ã© enfileirado automaticamente!

### 5. Consultar Status do Processamento

```bash
curl http://localhost:8000/api/v1/assessments/1/ai-status/ \
  -H "Authorization: Bearer <seu_token>"
```

Resposta esperada durante processamento:
```json
{
  "id": 1,
  "status": "running",
  "status_display": "Em execuÃ§Ã£o",
  "started_at": "2026-03-12T18:30:00Z",
  ...
}
```

Resposta esperada apÃ³s sucesso:
```json
{
  "id": 1,
  "status": "succeeded",
  "status_display": "Sucesso",
  "confidence": "HIGH",
  "result_json": {
    "processed_images": 2,
    "analysis_duration_ms": 1500,
    "model_confidence": "HIGH"
  },
  ...
}
```

### 6. Reprocessar (se necessÃ¡rio)

Se o processamento falhar (status=error):

```bash
curl -X POST http://localhost:8000/api/v1/assessments/1/reprocess/ \
  -H "Authorization: Bearer <seu_token>"
```

## Endpoints de IA

| Endpoint | MÃ©todo | DescriÃ§Ã£o |
|----------|--------|-----------|
| `/assessments/<id>/process-ai/` | POST | ForÃ§a processamento de IA |
| `/assessments/<id>/reprocess/` | POST | Reprocessa avaliaÃ§Ã£o em erro |
| `/assessments/<id>/ai-status/` | GET | Consulta status do processamento |

## ConfiguraÃ§Ã£o do Cliente de IA

O cliente de IA pode operar em trÃªs modos:

### Modo Mock (Desenvolvimento/Testes)

```env
AI_SERVICE_MOCK_MODE=true
AI_SERVICE_ENABLED=true
```

Neste modo, o serviÃ§o de IA Ã© simulado, retornando resultados fictÃ­cios baseados nas evidÃªncias.

### Modo OlÃ­mpia - API Dataprev (ProduÃ§Ã£o)

Edite o arquivo `backend/.env`:

```env
AI_SERVICE_MOCK_MODE=false
AI_SERVICE_ENABLED=true

# ConfiguraÃ§Ã£o da API OlÃ­mpia
OLIMPIA_API_ENABLED=true
OLIMPIA_API_TOKEN=seu_token_aqui
# OLIMPIA_API_URL=https://api.olimpia.suia.dataprev.gov.br/v2/seguranca-por-imagem/infer
# OLIMPIA_API_TIMEOUT=60
# OLIMPIA_API_LANGUAGE=en_us
# OLIMPIA_MIN_CONFIDENCE=0.70

# Processamento de imagens
SAFETY_IMAGE_DRAW_BOUNDING_BOXES=true
```

Este modo utiliza a API OlÃ­mpia da Dataprev para anÃ¡lise real de seguranÃ§a por imagem, detectando:
- Uso inadequado de EPI
- Trabalho em altura sem proteÃ§Ã£o
- Proximidade com mÃ¡quinas perigosas
- EscavaÃ§Ãµes sem sinalizaÃ§Ã£o
- Riscos elÃ©tricos
- EspaÃ§os confinados

### Modo AI GenÃ©rico (Futuro)

```env
AI_SERVICE_MOCK_MODE=false
AI_SERVICE_ENABLED=true
AI_SERVICE_BASE_URL=https://ai-service.seu-dominio.com
AI_SERVICE_API_KEY=sua-api-key
AI_SERVICE_TIMEOUT=30
```

**Nota:** O cliente genÃ©rico (`AIClient`) pode ser implementado para outros provedores de IA.

## Executando Testes

### Com Docker

```bash
docker compose exec backend python manage.py test assessments.tests.test_ai_pipeline -v 2
```

### Sem Docker (SQLite)

```bash
cd backend
set TESTING=1
python manage.py test assessments.tests.test_ai_pipeline -v 2
```

## Troubleshooting

### Worker nÃ£o estÃ¡ processando tasks

1. Verifique se o worker estÃ¡ rodando:
   ```bash
   docker compose ps
   ```

2. Verifique logs do worker:
   ```bash
   docker compose logs -f worker
   ```

3. Verifique conexÃ£o com Redis:
   ```bash
   docker compose exec redis redis-cli ping
   # Deve retornar: PONG
   ```

### Tasks estÃ£o presas em "running"

Use a task de limpeza:

```bash
docker compose exec backend python manage.py shell -c "
from assessments.tasks import cleanup_stalled_processes
cleanup_stalled_processes()
"
```

### MigraÃ§Ãµes pendentes

```bash
docker compose exec backend python manage.py migrate
```

## Monitoramento

### Flower (Dashboard Celery) - Opcional

Para monitorar tasks em tempo real, descomente o serviÃ§o `flower` no `docker-compose.yml` e acesse:

```
http://localhost:5555
```

## Estrutura de Arquivos

```
backend/
â”œâ”€â”€ assessments/
â”‚   â”œâ”€â”€ ai_client.py          # Interface e implementaÃ§Ãµes do cliente IA (inclui OlimpiaAIClient)
â”‚   â”œâ”€â”€ olimpia_service.py    # ServiÃ§o de integraÃ§Ã£o com API OlÃ­mpia
â”‚   â”œâ”€â”€ image_processor.py    # Processamento de imagens com bounding boxes
â”‚   â”œâ”€â”€ tasks.py              # Tasks Celery
â”‚   â”œâ”€â”€ models.py             # Modelos (AIInferenceResult, OlimpiaDetectionResult)
â”‚   â”œâ”€â”€ views.py              # Endpoints de IA
â”‚   â”œâ”€â”€ urls.py               # Rotas de IA
â”‚   â””â”€â”€ tests/
â”‚       â””â”€â”€ test_ai_pipeline.py  # Testes
â”œâ”€â”€ config/
â”‚   â”œâ”€â”€ celery.py             # ConfiguraÃ§Ã£o Celery
â”‚   â””â”€â”€ settings/
â”‚       â””â”€â”€ base.py           # ConfiguraÃ§Ãµes de IA (OLIMPIA_API_*)
â””â”€â”€ requirements.txt          # DependÃªncias (celery, redis, requests)

infra/
â””â”€â”€ docker-compose.yml        # Redis e Worker adicionados
```


---

<a id="AI_PROCESSING_FIX"></a>
# Arquivo: AI_PROCESSING_FIX.md

# CorreÃ§Ã£o do Fluxo de Processamento de IA

## ðŸ› Problema Identificado

As imagens estavam sendo enviadas mas **nenhum risco era detectado** porque o fluxo de processamento de IA nunca era iniciado.

### Causa Raiz
O frontend estava:
1. âœ… Criando assessment (status: `draft`)
2. âœ… Fazendo upload das fotos
3. âŒ **Nunca transicionando para `SYNCED`** (que dispara a IA)

O backend sÃ³ processa a IA quando o assessment estÃ¡ no status `SYNCED`:
```python
# tasks.py
if assessment.status not in [RiskAssessment.STATUS_SYNCED, RiskAssessment.STATUS_ERROR_AI]:
    return {"status": "skipped", "message": f"Invalid status: {assessment.status}"}
```

---

## âœ… SoluÃ§Ã£o Implementada

### 1. Frontend - syncWorker.ts
Adicionadas chamadas aos endpoints de transiÃ§Ã£o apÃ³s o upload:

```typescript
// Passo 3: Transicionar para CAPTURED
await apiClient.post(`/assessments/${assessmentId}/capture/`, {});

// Passo 4: Transicionar para SYNCED (dispara processamento de IA)
await apiClient.post(`/assessments/${assessmentId}/sync/`, {});
```

### 2. Frontend - useRiskAssessment.ts
Adicionados estados de processamento:
- Detecta quando assessment estÃ¡ em `synced` (IA processando)
- Mostra mensagem "AI is analyzing the images..."
- Polling mais frequente (5s) quando processando
- Detecta erro de IA (`error_ai`)

### 3. Frontend - RisksDetected.tsx
Adicionada tela de "AI Analysis in Progress" com indicador visual.

### 4. Backend - .env
Adicionadas configuraÃ§Ãµes do Celery e AI Service:
```bash
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

AI_SERVICE_ENABLED=true
AI_SERVICE_MOCK_MODE=true
AI_SERVICE_TIMEOUT=30
```

---

## ðŸš€ Como Executar o Sistema Completo

### PrÃ©-requisitos
1. **Redis** rodando (para o Celery)
2. **PostgreSQL** rodando
3. **Backend** Django
4. **Worker Celery** (processamento assÃ­ncrono)
5. **Frontend** React

### Passo a Passo

#### 1. Iniciar Redis
```bash
# Usando Docker
docker run -d -p 6379:6379 redis:alpine

# Ou instalaÃ§Ã£o local
redis-server
```

#### 2. Configurar Backend
```bash
cd backend

# Criar/ativar ambiente virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate  # Windows

# Instalar dependÃªncias
pip install -r requirements.txt

# Aplicar migraÃ§Ãµes
python manage.py migrate

# Criar superusuÃ¡rio (opcional)
python manage.py createsuperuser
```

#### 3. Iniciar Worker Celery (NOVO!)
Em um terminal separado:
```bash
cd backend
source venv/bin/activate  # ou venv\Scripts\activate no Windows

celery -A config worker -l info
```

#### 4. Iniciar Servidor Django
Em outro terminal:
```bash
cd backend
source venv/bin/activate

python manage.py runserver
```

#### 5. Iniciar Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## ðŸ“Š Fluxo Completo Atualizado

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚   FRONTEND      â”‚     â”‚    BACKEND      â”‚     â”‚  CELERY WORKER  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜     â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜     â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜
         â”‚                       â”‚                       â”‚
         â”‚  1. POST /assessments â”‚                       â”‚
         â”‚â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€>â”‚                       â”‚
         â”‚  (cria assessment)    â”‚                       â”‚
         â”‚                       â”‚                       â”‚
         â”‚  2. POST /evidences   â”‚                       â”‚
         â”‚â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€>â”‚                       â”‚
         â”‚  (upload fotos)       â”‚                       â”‚
         â”‚                       â”‚                       â”‚
         â”‚  3. POST /capture     â”‚                       â”‚
         â”‚â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€>â”‚                       â”‚
         â”‚  (status: CAPTURED)   â”‚                       â”‚
         â”‚                       â”‚                       â”‚
         â”‚  4. POST /sync        â”‚                       â”‚
         â”‚â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€>â”‚                       â”‚
         â”‚  (status: SYNCED)     â”‚                       â”‚
         â”‚                       â”‚  5. Dispara task      â”‚
         â”‚                       â”‚â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€>â”‚
         â”‚                       â”‚                       â”‚
         â”‚                       â”‚                       â”‚ 6. MockAIClient
         â”‚                       â”‚                       â”‚    processa imagens
         â”‚                       â”‚                       â”‚
         â”‚                       â”‚  7. Cria RiskFindings â”‚
         â”‚                       â”‚<â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”‚
         â”‚                       â”‚                       â”‚
         â”‚                       â”‚  8. Transiciona para  â”‚
         â”‚                       â”‚     AI_REVIEWED       â”‚
         â”‚                       â”‚                       â”‚
         â”‚  9. GET /:id (poll)   â”‚                       â”‚
         â”‚<â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”‚                       â”‚
         â”‚  (status: ai_reviewed)â”‚                       â”‚
         â”‚                       â”‚                       â”‚
         â–¼                       â–¼                       â–¼
```

---

## ðŸ§ª Testando o Fluxo

### Verificar se o Worker estÃ¡ rodando:
```bash
# No terminal do Celery, vocÃª deve ver:
[tasks]
  . assessments.tasks.process_assessment
  . assessments.tasks.reprocess_assessment
  . assessments.tasks.cleanup_stalled_processes

[2026-03-13 00:00:00,000: INFO/MainProcess] Connected to redis://localhost:6379/0
```

### Acompanhar o processamento:
1. **Frontend**: Console do navegador mostra logs do sync
2. **Backend**: Terminal do Django mostra requests HTTP
3. **Celery**: Terminal do worker mostra processamento da IA

### Logs esperados no Celery:
```
[INFO] Starting AI processing for assessment 123
[INFO] Using MockAIClient (mock mode enabled)
[INFO] Assessment 123 processed successfully. Found 2 risks.
```

---

## âš™ï¸ ConfiguraÃ§Ãµes

### Modo Mock (Desenvolvimento)
No `backend/.env`:
```bash
AI_SERVICE_MOCK_MODE=true  # Usa MockAIClient (simula riscos)
AI_SERVICE_MOCK_MODE=false # Usa AIClient real (quando implementado)
```

### Ajustar Polling
No frontend, em `useRiskAssessment.ts`:
```typescript
useRiskAssessment(assessmentId, {
  autoFetch: true,
  refreshInterval: 30000, // 30s quando nÃ£o processando
  // Quando processando IA: 5s (automÃ¡tico)
});
```

---

## ðŸ› Troubleshooting

### "AI processing failed" na tela
- Verificar se Celery worker estÃ¡ rodando
- Verificar logs do Celery para erros
- Verificar se Redis estÃ¡ acessÃ­vel

### "No risks detected" (mas deveria ter)
- Verificar se assessment chegou em `ai_reviewed`
- Verificar logs do Celery: quantos riscos foram detectados?
- Verificar se `AI_SERVICE_MOCK_MODE=true` (para testes)

### Job fica "SYNCING" eternamente
- Verificar se backend estÃ¡ respondendo
- Verificar console do navegador para erros de rede
- Verificar se o assessment foi criado no backend

### Erro 500 no sync
- Verificar logs do Django
- Verificar se o usuÃ¡rio estÃ¡ autenticado
- Verificar se o assessment existe

---

## ðŸ“ Arquivos Modificados

- `frontend/src/services/sync/syncWorker.ts` - Adicionado capture e sync
- `frontend/src/hooks/risk/useRiskAssessment.ts` - Estados de processamento
- `frontend/src/features/inspection/RisksDetected.tsx` - Tela de loading da IA
- `frontend/src/types/risk.ts` - Adicionado status `error_ai`
- `backend/.env` - ConfiguraÃ§Ãµes do Celery e AI


---

<a id="DOCKER_CHEATSHEET"></a>
# Arquivo: DOCKER_CHEATSHEET.md

# WorkSafety - Docker Cheat Sheet

## ðŸš€ Comandos RÃ¡pidos

### Subir TUDO (com o Worker Celery novo)
```bash
cd infra
docker-compose up -d --build
```

### Ver se estÃ¡ rodando
```bash
docker-compose ps
```

**Deve mostrar:**
```
NAME                STATUS
docker-db-1         Up
docker-redis-1      Up
docker-backend-1    Up
docker-worker-1     Up   <- IMPORTANTE!
```

---

## ðŸ› Se o Worker nÃ£o estiver rodando

### OpÃ§Ã£o 1: Subir sÃ³ o worker
```bash
cd infra
docker-compose up -d worker
```

### OpÃ§Ã£o 2: Rebuild e subir tudo
```bash
cd infra
docker-compose down
docker-compose up -d --build
```

### OpÃ§Ã£o 3: Ver logs do worker
```bash
cd infra
docker-compose logs -f worker
```

---

## ðŸ“Š Logs Ãšteis

### Ver logs do Worker (Celery)
```bash
cd infra
docker-compose logs -f worker
```

**Deve aparecer:**
```
[tasks]
  . assessments.tasks.process_assessment
  . assessments.tasks.reprocess_assessment
  . assessments.tasks.cleanup_stalled_processes
  . reports.tasks.generate_report
  
[INFO] Connected to redis://redis:6379/0
[INFO] worker ready
```

### Ver logs do Backend (Django)
```bash
cd infra
docker-compose logs -f backend
```

### Ver logs de TUDO
```bash
cd infra
docker-compose logs -f
```

---

## ðŸ”„ Reiniciar apÃ³s mudanÃ§as no cÃ³digo

### Backend/Python mudou:
```bash
cd infra
docker-compose restart backend worker
```

### Frontend mudou:
```bash
cd frontend
npm run dev
```

---

## ðŸ§ª Testar o Fluxo Completo

1. **Subir tudo:**
   ```bash
   cd infra
   docker-compose up -d --build
   ```

2. **Verificar worker:**
   ```bash
   docker-compose ps
   # Deve mostrar worker como "Up"
   ```

3. **Ver logs do worker:**
   ```bash
   docker-compose logs -f worker
   ```

4. **Acessar app:** http://localhost:3000

5. **Fazer uma inspeÃ§Ã£o com fotos**

6. **Ver no log do worker:**
   ```
   [INFO] Starting AI processing for assessment 123
   [INFO] Assessment 123 processed successfully. Found 2 risks.
   ```

---

## ðŸ“„ GeraÃ§Ã£o de RelatÃ³rios PDF (BE-03)

### Verificar se a task estÃ¡ carregada
```bash
cd infra
docker-compose logs worker | grep "reports.tasks.generate_report"
# Deve mostrar: . reports.tasks.generate_report
```

### Gerar relatÃ³rio via API
```bash
# Requer autenticaÃ§Ã£o admin
curl -X POST http://localhost:8000/api/admin/assessments/1/generate-report/ \
  -H "Authorization: Bearer <seu_token>"

# Resposta:
# {"message": "Report generation queued successfully", "report_id": 1, "task_id": "...", "status": "generating"}
```

### Ver logs da geraÃ§Ã£o de relatÃ³rio
```bash
cd infra
docker-compose logs -f worker | grep "PDF\|report"
```

**Log esperado:**
```
[INFO] Starting PDF generation for report 1
[INFO] Report 1 generated successfully in 3.45s (2 evidences)
[INFO] PDF Generation Performance: 3.45s for 2 images (target: 15s for 10 images)
```

### Listar relatÃ³rios
```bash
curl http://localhost:8000/api/admin/reports/ \
  -H "Authorization: Bearer <seu_token>"
```

---

## âŒ Parar tudo

```bash
cd infra
docker-compose down
```

---

## ðŸ†˜ Troubleshooting

### "worker keeps restarting"
```bash
docker-compose logs worker
# Verifique se o Redis estÃ¡ acessÃ­vel
```

### "Cannot connect to Redis"
Verifique se o serviÃ§o redis estÃ¡ healthy:
```bash
docker-compose ps
```

### Limpar tudo e recomeÃ§ar
```bash
cd infra
docker-compose down -v  # -v remove volumes
docker-compose up -d --build
```


---

<a id="DOCKER_LGPD_SETUP"></a>
# Arquivo: DOCKER_LGPD_SETUP.md

# Setup LGPD/GDPR no Docker

## 1. Rebuild da Imagem (necessÃ¡rio - OpenCV)

Como adicionamos `opencv-python` como dependÃªncia, Ã© necessÃ¡rio rebuild da imagem Docker:

```bash
cd d:\DATAPrev\WorkSafety\infra
docker-compose down
docker-compose up -d --build
```

Isso vai:
- Instalar as bibliotecas de sistema necessÃ¡rias para OpenCV
- Instalar `opencv-python` no container
- Subir todos os serviÃ§os

## 2. Aplicar MigraÃ§Ãµes

```bash
cd d:\DATAPrev\WorkSafety\infra
docker-compose exec backend python manage.py migrate
```

## 3. Verificar se tudo subiu corretamente

```bash
cd d:\DATAPrev\WorkSafety\infra
docker-compose ps
```

Deve mostrar:
```
NAME                STATUS
docker-db-1         Up
docker-redis-1      Up
docker-backend-1    Up
docker-worker-1     Up
```

## 4. Verificar logs do Worker (Celery)

O worker deve mostrar as novas tasks de anonimizaÃ§Ã£o:

```bash
cd d:\DATAPrev\WorkSafety\infra
docker-compose logs worker | grep "anonymize"
```

Deve aparecer:
```
[tasks]
  . assessments.tasks.anonymize_evidence_task
  . assessments.tasks.batch_anonymize_assessment_evidences
```

## 5. Executar Testes

```bash
cd d:\DATAPrev\WorkSafety\infra
docker-compose exec backend python manage.py test assessments.tests.test_privacy_lgpd -v 2
```

## 6. Verificar no Admin

Acesse: http://localhost:8000/admin/

Novos campos visÃ­veis:
- **RiskAssessment**: campos "Base legal LGPD" e "Notas da base legal"
- **Evidence**: campos "Anonimizado", "Status da anonimizaÃ§Ã£o", "Anonimizado em"
- **EvidenceAnonymizationLog**: novo modelo de auditoria

## Comandos Ãšteis

### Ver logs de anonimizaÃ§Ã£o em tempo real
```bash
cd d:\DATAPrev\WorkSafety\infra
docker-compose logs -f worker | grep -i "anonymiz\|privacy\|lgpd"
```

### Testar upload de imagem com anonimizaÃ§Ã£o
```bash
# Fazer login e obter token primeiro
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "seu@email.com", "password": "sua_senha"}'

# Upload de imagem
curl -X POST http://localhost:8000/api/assessments/1/upload/ \
  -H "Authorization: Bearer <seu_token>" \
  -F "images=@foto_teste.jpg"
```

### Verificar status das evidÃªncias
```bash
curl http://localhost:8000/api/assessments/1/ \
  -H "Authorization: Bearer <seu_token>"
```

Deve retornar:
```json
{
  "evidences": [{
    "is_anonymized": true,
    "anonymization_status": "completed",
    "privacy_status": {
      "is_anonymized": true,
      "anonymization_status": "completed"
    }
  }],
  "legal_basis": "legitimate_interest",
  "legal_basis_display": "Interesse legÃ­timo"
}
```

## Troubleshooting

### Erro: "ImportError: libGL.so.1: cannot open shared object file"

Isso significa que o rebuild nÃ£o foi feito corretamente:

```bash
cd d:\DATAPrev\WorkSafety\infra
docker-compose down
docker-compose build --no-cache backend worker
docker-compose up -d
```

### Worker nÃ£o aparece nos logs

```bash
cd d:\DATAPrev\WorkSafety\infra
docker-compose restart worker
docker-compose logs -f worker
```

### Limpar tudo e recomeÃ§ar

```bash
cd d:\DATAPrev\WorkSafety\infra
docker-compose down -v
docker-compose up -d --build
```

## ConfiguraÃ§Ãµes Opcionais

Para desabilitar anonimizaÃ§Ã£o em desenvolvimento, adicione ao `backend/.env`:

```
ANONYMIZATION_ENABLED=false
```

E restart os containers:
```bash
cd d:\DATAPrev\WorkSafety\infra
docker-compose restart backend worker
```


---

<a id="MUDANCAS_API_OLIMPIA"></a>
# Arquivo: MUDANCAS_API_OLIMPIA.md

# âœ… IntegraÃ§Ã£o API OlÃ­mpia - Resumo de MudanÃ§as

## ðŸ“‹ Problema Resolvido
Em http://localhost:3000/inspection/risks, os riscos detectados agora exibem dados REAIS retornados pela API OlÃ­mpia em vez de dados mockados.

## ðŸ”§ MudanÃ§as Implementadas

### Backend

#### 1. **Modelo de Dados** (`assessments/models.py`)
- âœ… Adicionado campo `ai_confidence` (DecimalField) ao modelo `RiskFinding`
- Armazena confianÃ§a individual de cada risco (0-0.999 = 0% a 99.9%)

#### 2. **MigraÃ§Ã£o de Banco de Dados** (`assessments/migrations/0026_add_ai_confidence_to_riskfinding.py`)
- âœ… Criada migraÃ§Ã£o para adicionar coluna `ai_confidence` Ã  tabela `risk_finding`

#### 3. **ServiÃ§o de IntegraÃ§Ã£o** (`assessments/olimpia_service.py`)
- âœ… Atualizado `create_risk_findings_from_detections()` para:
  - Ler confianÃ§a do `OlimpiaDetectionResult`
  - Preencher campo `ai_confidence` do `RiskFinding`

#### 4. **SerializaÃ§Ã£o** (`assessments/serializers.py`)
- âœ… Atualizado `RiskItemSerializer.get_ai_confidence()` para:
  - Ler valor do campo `RiskFinding.ai_confidence`
  - Converter de decimal (0.92) para percentual string ("92%")

### Frontend

#### 1. **Componente Principal** (`features/inspection/RisksDetected.tsx`)
- âœ… Melhorada exibiÃ§Ã£o da confianÃ§a com badge visual destacada:
  - Badge azul-teal com borda
  - Texto formatado: "92% confidence"
  - Posicionado ao lado da severidade

#### 2. **Dados de Teste** (`__tests__/risk/mockAxios.ts`)
- âœ… Mantidos dados mockados com valores realistas (92%, 89%, 72%)
- Usados apenas para testes, nÃ£o afetam produÃ§Ã£o

## ðŸ”„ Fluxo de Dados (Corrigido)

```
API OlÃ­mpia
  â”œâ”€ rule_1_violation: confidence: 0.92
  â””â”€ rule_2_violation: confidence: 0.89

        â†“ OlimpiaAIClient.analyze_image_file()

SafetyViolation
  â””â”€ confidence: 0.92

        â†“ olimpia_service.save_detection_results()

OlimpiaDetectionResult (DB)
  â””â”€ confidence: 0.920 (DecimalField)

        â†“ olimpia_service.create_risk_findings_from_detections()

RiskFinding (DB)
  â””â”€ ai_confidence: 0.920 (Novo campo)

        â†“ RiskItemSerializer.get_ai_confidence()

JSON Response
  â””â”€ ai_confidence: "92%"

        â†“ Frontend exibe

Tela (RisksDetected.tsx)
  â””â”€ Badge: "92% confidence" (teal)
```

## ðŸ“Š Exemplo de Dados Retornados

Antes (Mockado):
```json
{
  "description": "Missing Guardrail",
  "severity": "CRITICAL",
  "ai_confidence": "95%"  // Sempre mockado
}
```

Depois (Real):
```json
{
  "description": "[Uso de EPI] missing reflective vest",
  "severity": "HIGH",
  "ai_confidence": "92%"  // Real da API OlÃ­mpia
}
```

## ðŸš€ PrÃ³ximos Passos

1. **Executar migraÃ§Ã£o:**
   ```bash
   python manage.py migrate assessments
   ```

2. **Testar com API Real:**
   - Configurar token OlÃ­mpia em `.env`
   - Enviar imagens para anÃ¡lise
   - Verificar que confianÃ§a aparece corretamente

3. **Verificar em ProduÃ§Ã£o:**
   - Os valores de confianÃ§a devem ser baseados na API real
   - NÃ£o haverÃ¡ mais dados mockados em produÃ§Ã£o

## âœ¨ BenefÃ­cios

- âœ… ConfianÃ§a individual por risco (nÃ£o agregada)
- âœ… Dados reais da API OlÃ­mpia
- âœ… UI melhorada com badge visual
- âœ… Estrutura mantida coerente (sem quebras)
- âœ… FÃ¡cil manutenÃ§Ã£o e expandibilidade


---

<a id="OLIMPIA_INTEGRATION"></a>
# Arquivo: OLIMPIA_INTEGRATION.md

# IntegraÃ§Ã£o com API OlÃ­mpia (Dataprev)

DocumentaÃ§Ã£o da integraÃ§Ã£o do WorkSafety com a API OlÃ­mpia para anÃ¡lise de seguranÃ§a por imagem.

## ðŸ“‹ VisÃ£o Geral

A integraÃ§Ã£o permite anÃ¡lise automÃ¡tica de imagens de inspeÃ§Ãµes utilizando a API OlÃ­mpia da Dataprev, detectando violaÃ§Ãµes de seguranÃ§a ocupacional com bounding boxes e classificaÃ§Ãµes de risco.

## ðŸ”— Endpoint

```
POST https://api.olimpia.suia.dataprev.gov.br/v2/seguranca-por-imagem/infer?lang=en_us
```

## ðŸ” AutenticaÃ§Ã£o

AutenticaÃ§Ã£o via Bearer Token no header:
```
Authorization: Bearer <TOKEN_OLIMPIA>
```

## âš™ï¸ ConfiguraÃ§Ã£o

Todas as configuraÃ§Ãµes da API OlÃ­mpia estÃ£o centralizadas no arquivo `backend/.env`.

### Para Desenvolvimento/Testes (Mock)

```bash
# No arquivo backend/.env
AI_SERVICE_MOCK_MODE=true
OLIMPIA_API_ENABLED=false
```

### Para ProduÃ§Ã£o (API Real)

```bash
# No arquivo backend/.env
AI_SERVICE_MOCK_MODE=false
OLIMPIA_API_ENABLED=true
OLIMPIA_API_TOKEN=seu_token_aqui

# Opcionais (valores padrÃ£o sÃ£o usados se nÃ£o informados)
# OLIMPIA_API_URL=https://api.olimpia.suia.dataprev.gov.br/v2/seguranca-por-imagem/infer
# OLIMPIA_API_TIMEOUT=60
# OLIMPIA_API_LANGUAGE=en_us
# OLIMPIA_MIN_CONFIDENCE=0.70
# SAFETY_IMAGE_DRAW_BOUNDING_BOXES=true
```

## ðŸ“¦ Estrutura da Resposta

A API retorna violaÃ§Ãµes organizadas por regras:

```json
{
  "rule_1_violation": [
    {
      "bounding_box": [0.34, 0.13, 0.55, 0.75],
      "reason": "missing reflective vest",
      "confidence": 0.92
    }
  ],
  "rule_2_violation": [
    {
      "bounding_box": [0.34, 0.13, 0.55, 0.75],
      "reason": "worker above 3m without harness in area without guardrails",
      "confidence": 0.88
    }
  ],
  "rule_3_violation": [
    {
      "bounding_box": [0, 0.48, 1, 0.68],
      "reason": "trench edge",
      "confidence": 0.95
    }
  ],
  "rule_4_violation": [
    {
      "bounding_box": [0.59, 0.31, 0.65, 0.43],
      "reason": "pedestrian behind excavator",
      "confidence": 0.85
    }
  ]
}
```

## ðŸ·ï¸ Mapeamento de Regras

| Regra | Nome | Categoria | Severidade |
|-------|------|-----------|------------|
| rule_1_violation | Uso de EPI | EPI | HIGH |
| rule_2_violation | Trabalho em Altura | QUEDA | CRITICAL |
| rule_3_violation | Abertura de Valas | ESCAVACAO | HIGH |
| rule_4_violation | Proximidade com MÃ¡quinas | MAQUINARIO | CRITICAL |
| rule_5_violation | EspaÃ§o Confinado | ESPACO_CONFINADO | CRITICAL |
| rule_6_violation | ProteÃ§Ã£o ElÃ©trica | ELETRICO | HIGH |

## ðŸ–¼ï¸ Processamento de Imagens

As imagens sÃ£o processadas automaticamente com:

1. **DetecÃ§Ã£o de violaÃ§Ãµes** via API OlÃ­mpia
2. **Bounding boxes** desenhadas nas Ã¡reas de risco
3. **Cores por severidade**:
   - ðŸ”´ CrÃ­tica: Crimson (#DC143C)
   - ðŸŸ  Alta: Vermelho (#FF0000)
   - ðŸŸ¡ MÃ©dia: Laranja (#FFA500)
   - ðŸŸ¢ Baixa: Amarelo (#FFFF00)

4. **Legenda** com nÃºmero da detecÃ§Ã£o e confianÃ§a

## ðŸ“Š CÃ¡lculo de Compliance

O score de compliance Ã© calculado como:

```
Score = 100 - Î£(count_severity Ã— weight_severity)
```

Pesos:
- CRITICAL: 25 pontos
- HIGH: 10 pontos
- MEDIUM: 5 pontos
- LOW: 2 pontos

Status:
- 90-100: EXCELLENT
- 75-89: GOOD
- 60-74: FAIR
- 40-59: POOR
- 0-39: CRITICAL

## ðŸ”„ Fluxo de Processamento

```
1. Upload de evidÃªncia (imagem)
      â†“
2. Task Celery process_assessment
      â†“
3. OlimpiaAIClient.analyze_assessment()
      â†“
4. Para cada imagem:
   a. POST /v2/seguranca-por-imagem/infer
   b. Parse das violaÃ§Ãµes
   c. Desenhar bounding boxes
   d. Salvar OlimpiaDetectionResult
      â†“
5. Criar RiskFinding para cada detecÃ§Ã£o
      â†“
6. Atualizar AIInferenceResult
      â†“
7. Transicionar assessment para AI_REVIEWED
```

## ðŸ§ª Testes

Para testar a integraÃ§Ã£o em modo de desenvolvimento:

```bash
# Usar modo mock (nÃ£o chama API real)
AI_SERVICE_MOCK_MODE=true

# Ou usar cliente OlÃ­mpia com token de teste
AI_SERVICE_MOCK_MODE=false
OLIMPIA_API_ENABLED=true
OLIMPIA_API_TOKEN=test_token
```

## ðŸ“ Exemplo de Uso

```python
from assessments.olimpia_service import get_olimpia_service
from assessments.models import RiskAssessment

# Obter serviÃ§o
service = get_olimpia_service()

# Buscar avaliaÃ§Ã£o
assessment = RiskAssessment.objects.get(id=1)

# Processar
result = service.process_assessment_with_detections(
    assessment,
    assessment.inferences.first()
)

print(f"DetecÃ§Ãµes: {result['detections_count']}")
print(f"Score: {result['compliance_score']}")
```

## ðŸ”§ Troubleshooting

### Timeout na API
Aumente `OLIMPIA_API_TIMEOUT` (padrÃ£o: 60s)

### DetecÃ§Ãµes com confianÃ§a baixa
Ajuste `OLIMPIA_MIN_CONFIDENCE` (padrÃ£o: 0.70)

### Erro de autenticaÃ§Ã£o
Verifique se o token estÃ¡ vÃ¡lido e nÃ£o expirado

### Imagens nÃ£o processadas
Verifique se `SAFETY_IMAGE_DRAW_BOUNDING_BOXES=true`

## ðŸ“š Arquivos Relacionados

- `backend/assessments/ai_client.py` - Cliente HTTP da API OlÃ­mpia
- `backend/assessments/image_processor.py` - Processamento de imagens
- `backend/assessments/olimpia_service.py` - ServiÃ§o de integraÃ§Ã£o
- `backend/assessments/models.py` - Modelos OlimpiaDetectionResult
- `backend/config/settings/base.py` - ConfiguraÃ§Ãµes

## ðŸ“ž Suporte

Para obter acesso Ã  API OlÃ­mpia, entre em contato com:
- Equipe Dataprev/OlÃ­mpia
- GestÃ£o do projeto WorkSafety


---

<a id="PRODUCTION_DEPLOYMENT"></a>
# Arquivo: PRODUCTION_DEPLOYMENT.md

# WorkSafety - Production Deployment Guide

Este guia descreve como preparar e fazer deploy do projeto WorkSafety em produÃ§Ã£o.

## Arquitetura da ProduÃ§Ã£o

```
User Browser (HTTP/HTTPS)
        â†“
Nginx Proxy (https://inovacao.dataprev.gov.br:443)
        â†“             
    â”œâ”€â†’ /worksafety  â†’ Frontend App (React)
    â”œâ”€â†’ /admin       â†’ Admin Panel (React)
    â””â”€â†’ /api/*       â†’ Django Backend (Port 8000)
        â†“
    Docker Compose Stack
    â”œâ”€ db (PostgreSQL 16)
    â”œâ”€ redis (Redis 7)
    â”œâ”€ backend (Django)
    â”œâ”€ worker (Celery)
    â””â”€ frontend (Nginx com ambos os frontends)
```

## ConfiguraÃ§Ã£o de IPs e DomÃ­nios

- **Backend**: `http://200.152.38.136:8000/`
- **Frontend (App)**: `https://inovacao.dataprev.gov.br/worksafety/`
- **Frontend (Admin)**: `https://inovacao.dataprev.gov.br/admin/`
- **Main Domain IP**: `200.152.47.9` (com roteamento para 200.152.38.136)

## PrÃ©-requisitos

- Docker & Docker Compose instalados
- Git
- Acesso SSH ao servidor
- Certificados SSL/TLS para `inovacao.dataprev.gov.br`

## Passo 1: Preparar o Servidor

```bash
# Clonar repositÃ³rio
git clone <repo-url> /opt/worksafety
cd /opt/worksafety

# Criar diretÃ³rios necessÃ¡rios
mkdir -p /opt/worksafety/logs
mkdir -p /opt/worksafety/media

# Definir permissÃµes
chmod 755 /opt/worksafety
```

## Passo 2: Configurar VariÃ¡veis de Ambiente

### Arquivo: `backend/.env.prod`

Este arquivo jÃ¡ foi criado, mas vocÃª DEVE alterar:

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

Verifique se estÃ¡ pronto para usar:
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

## Passo 4: Iniciar ServiÃ§os

```bash
# Iniciar em background
docker-compose -f infra/docker-compose.prod.yml up -d

# Verificar status
docker-compose -f infra/docker-compose.prod.yml ps

# Ver logs
docker-compose -f infra/docker-compose.prod.yml logs -f
```

## Passo 5: Executar MigraÃ§Ãµes do Banco

```bash
# Aplicar migraÃ§Ãµes
docker-compose -f infra/docker-compose.prod.yml exec backend python manage.py migrate

# Criar superuser (admin)
docker-compose -f infra/docker-compose.prod.yml exec backend python manage.py createsuperuser

# Coletar arquivos estÃ¡ticos (se necessÃ¡rio)
docker-compose -f infra/docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
```

## Passo 6: Configurar Nginx Reverso (no host)

**Nota**: O Dockerfile.prod jÃ¡ inclui Nginx internamente. Se vocÃª precisa de um Nginx reverso externo (para SSL/TLS), configure como:

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
    
    # SeguranÃ§a SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Proxy para aplicaÃ§Ã£o
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

## VerificaÃ§Ã£o de SaÃºde

### Backend API Health
```bash
curl http://200.152.38.136:8000/api/health/
```

### Frontend Health
```bash
curl http://200.152.38.136:3000/health
```

### Logs dos ServiÃ§os

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

## ManutenÃ§Ã£o

### Backup do Banco de Dados

```bash
# Fazer backup
docker-compose -f infra/docker-compose.prod.yml exec db pg_dump -U worksafety worksafety > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup
docker-compose -f infra/docker-compose.prod.yml exec -T db psql -U worksafety worksafety < backup.sql
```

### Atualizar CÃ³digo

```bash
# Pull das mudanÃ§as
git pull origin main

# Rebuild das imagens
docker-compose -f infra/docker-compose.prod.yml build

# Restart dos serviÃ§os
docker-compose -f infra/docker-compose.prod.yml up -d
```

### Monitoramento

Implemente monitoramento com ferramentas como:
- **Prometheus** para mÃ©tricas
- **Grafana** para visualizaÃ§Ã£o
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

## SeguranÃ§a

### Checklist de SeguranÃ§a

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
- [ ] Configurar backups automÃ¡ticos
- [ ] Revisar logs regularmente

## Suporte

Para erros ou dÃºvidas, verifique:
1. Logs do Docker: `docker-compose logs -f`
2. Status dos containers: `docker-compose ps`
3. Redes: `docker network ls` e `docker inspect <network_id>`


---

<a id="PRODUCTION_SUMMARY"></a>
# Arquivo: PRODUCTION_SUMMARY.md

# WorkSafety - Resumo de ConfiguraÃ§Ãµes para ProduÃ§Ã£o

## ðŸ“‹ Resumo das MudanÃ§as Realizadas

Este documento resume todas as alteraÃ§Ãµes feitas para preparar o projeto WorkSafety para produÃ§Ã£o.

## ðŸŽ¯ Objetivo Final

Configurar o projeto para:
- **App (WorkSafety)**: AcessÃ­vel em `https://inovacao.dataprev.gov.br/worksafety/`
- **Admin Panel**: AcessÃ­vel em `https://inovacao.dataprev.gov.br/admin/`
- **Backend API**: `http://200.152.38.136:8000/`
- **Ambos os frontends**: Servidos na mesma porta 3000 pelo Nginx

---

## ðŸ“ Arquivos Criados

### 1. **`infra/nginx-prod.conf`** âœ…
ConfiguraÃ§Ã£o Nginx para servir ambos os frontends em caminhos diferentes:
- `/worksafety/` â†’ App (React)
- `/admin/` â†’ Admin Panel (React)
- `/api/*` â†’ Proxy para Django Backend
- Porta: **3000**

**CaracterÃ­sticas:**
- CompressÃ£o Gzip habilitada
- Cache de assets estÃ¡ticos (1 ano)
- Proxy reverso para API
- SPA fallback (try_files para index.html)
- Health check endpoint em `/health`

### 2. **`infra/Dockerfile.prod`** âœ…
Multi-stage Dockerfile para produÃ§Ã£o:
- **Stage 1**: Build Frontend App (Vite, output em `/worksafety/`)
- **Stage 2**: Build WorkSafetyWeb (Vite, output em `/admin/`)
- **Stage 3**: Nginx servindo ambos os frontends

### 3. **`infra/docker-compose.prod.yml`** âœ…
Arquivo Docker Compose para produÃ§Ã£o com:
- PostgreSQL 16
- Redis 7
- Django Backend
- Celery Worker
- Nginx Frontend (ambos os projetos)
- Healthchecks configurados
- Restart policies
- Environment variables para .env.prod

### 4. **`backend/.env.prod`** âœ…
VariÃ¡veis de ambiente para Django em produÃ§Ã£o:
- `DEBUG=false`
- `SECRET_KEY` (substituir com valor seguro)
- `ALLOWED_HOSTS` incluindo domÃ­nio e IP
- SeguranÃ§a SSL habilitada
- Email e Celery configurados

### 5. **`frontend/.env.production`** âœ…
VariÃ¡veis para Frontend App:
- `VITE_API_URL=/api/` (URL relativa para Nginx rotear)

### 6. **`WorkSafetyWeb/.env.production`** âœ…
VariÃ¡veis para Admin Panel:
- `VITE_API_URL=/api/` (URL relativa para Nginx rotear)

### 7. **`PRODUCTION_DEPLOYMENT.md`** âœ…
Guia completo de deployment com:
- InstruÃ§Ãµes passo-a-passo
- Docker Compose commands
- MigraÃ§Ãµes de banco
- ConfiguraÃ§Ã£o de Nginx reverso externo (SSL/TLS)
- Troubleshooting
- Checklist de seguranÃ§a
- Backup e manutenÃ§Ã£o

---

## ðŸ”§ ModificaÃ§Ãµes em Arquivos Existentes

### Frontend (App)

#### **`frontend/vite.config.ts`** âœ…
```diff
+ const isProd = mode === 'production';
+ base: isProd ? '/worksafety/' : '/',
  manifest: {
+   start_url: isProd ? '/worksafety/' : '/',
+   scope: isProd ? '/worksafety/' : '/',
```
- Configurado para servir em `/worksafety/` em produÃ§Ã£o
- PWA manifest atualizado com scope correto

#### **`frontend/src/app/router.tsx`** âœ…
```diff
+ const basename = import.meta.env.MODE === 'production' ? '/worksafety' : '/';
  <BrowserRouter basename={basename}>
```
- React Router agora usa basename correto para routing

### WorkSafetyWeb (Admin)

#### **`WorkSafetyWeb/vite.config.ts`** âœ…
```diff
+ const isProd = mode === 'production';
+ base: isProd ? '/admin/' : '/',
```
- Configurado para servir em `/admin/` em produÃ§Ã£o

#### **`WorkSafetyWeb/server.ts`** âœ…
```diff
- const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
+ const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
```
- Porta padrÃ£o mudada de 3001 para 3000

#### **`WorkSafetyWeb/src/App.tsx`** âœ…
- Adicionado `basename={basename}` ao Router
- Removidos prefixos `/admin/` de todas as rotas (10 mudanÃ§as)
- NavegaÃ§Ã£o ajustada para caminhos relativos
- Logout redirecionado para `/login` (nÃ£o `/admin/login`)

```diff
+ const basename = import.meta.env.MODE === 'production' ? '/admin' : '/';
+ <Router basename={basename}>
  <Route path="/login" element={<Login />} />
  <Route path="/dashboard" element={...} />
  <Route path="/users" element={...} />
  // ... etc
```

#### **`WorkSafetyWeb/src/components/ProtectedRoute.tsx`** âœ…
```diff
- return <Navigate to="/admin/login" replace />;
+ return <Navigate to="/login" replace />;
```
- Rota de login ajustada

#### **`WorkSafetyWeb/Dockerfile`** âœ…
```diff
- EXPOSE 3001
+ EXPOSE 3000
```
- Porta mudada de 3001 para 3000

#### **`WorkSafetyWeb/src/App.tsx` - Navigation** âœ…
```diff
  const navigation = [
-   { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
+   { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
-   { name: 'UsuÃ¡rios', href: '/admin/users', icon: Users },
+   { name: 'UsuÃ¡rios', href: '/users', icon: Users },
    // ... etc (10 itens)
```
- Todos os links de navegaÃ§Ã£o atualizados

---

## ðŸš€ Fluxo de Acesso em ProduÃ§Ã£o

```
1. UsuÃ¡rio acessa: https://inovacao.dataprev.gov.br/worksafety/
   â†“
2. Nginx reverso (200.152.47.9) roteia para 200.152.38.136:3000
   â†“
3. Container frontend (Nginx + ambos os apps) serve /worksafety/index.html
   â†“
4. React App carrega e faz requisiÃ§Ãµes para /api/*
   â†“
5. Nginx roteia /api/* para backend:8000
   â†“
6. Django Backend processa requisiÃ§Ã£o e responde

Mesma lÃ³gica para /admin/
```

---

## ðŸ” Checklist de ConfiguraÃ§Ã£o para ProduÃ§Ã£o

### âš ï¸ ANTES DE FAZER DEPLOY

- [ ] **Gerar SECRET_KEY segura**
  ```bash
  python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
  ```
  Editar em `backend/.env.prod`

- [ ] **Configurar DATABASE PASSWORD**
  - Alterar `POSTGRES_PASSWORD` em `backend/.env.prod`
  - Usar senha forte e aleatÃ³ria

- [ ] **Configurar EMAIL**
  - Alterar `EMAIL_HOST_USER` e `EMAIL_HOST_PASSWORD`
  - Criar conta de email da Dataprev ou utilizar serviÃ§o especÃ­fico

- [ ] **Configurar OlÃ­mpia API**
  - Obter `OLIMPIA_API_KEY` junto Ã  Dataprev
  - Atualizar `OLIMPIA_API_BASE_URL` se diferente

- [ ] **Certificados SSL/TLS**
  - Preparar certificados para `inovacao.dataprev.gov.br`
  - Configurar no Nginx reverso externo

- [ ] **VersÃ£o de Build**
  - Verificar que `NODE_ENV=production` estÃ¡ configurado
  - Testar builds localmente: `npm run build` em ambos os frontends

---

## ðŸ“Š Estrutura de Portas

| ServiÃ§o | Porta | Acesso |
|---------|-------|--------|
| Frontend (App + Admin) | 3000 | Interno: localhost:3000 |
| Backend API | 8000 | Interno: backend:8000 |
| PostgreSQL | 5432 | Interno: db:5432 |
| Redis | 6379 | Interno: redis:6379 |
| PÃºblico HTTPS | 443 | https://inovacao.dataprev.gov.br |

---

## ðŸŒ URLs de ProduÃ§Ã£o

| ServiÃ§o | URL |
|---------|-----|
| App (WorkSafety) | `https://inovacao.dataprev.gov.br/worksafety/` |
| Admin Panel | `https://inovacao.dataprev.gov.br/admin/` |
| API (direto) | `http://200.152.38.136:8000/api/` |
| API (via proxy) | `https://inovacao.dataprev.gov.br/api/` |

---

## ðŸ§ª Testes Recomendados

```bash
# 1. Build das imagens
docker-compose -f infra/docker-compose.prod.yml build

# 2. Iniciar stack
docker-compose -f infra/docker-compose.prod.yml up -d

# 3. Verificar saÃºde dos serviÃ§os
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

## ðŸ“ PrÃ³ximos Passos

1. **Revisar todos os arquivos .env.prod**
   - Alterar valores sensÃ­veis antes de fazer push

2. **Testar em staging**
   - Fazer deploy em ambiente de teste antes de produÃ§Ã£o

3. **Configurar monitoramento**
   - Prometheus + Grafana para mÃ©tricas
   - ELK Stack para logs centralizados

4. **DocumentaÃ§Ã£o de Runbooks**
   - Criar procedimentos para escalaÃ§Ã£o do sistema
   - Documentar processo de rollback

5. **Backup e DR**
   - Configurar backups automÃ¡ticos de banco de dados
   - Testar restore procedures

---

## ðŸ“ž Contato e Suporte

Para problemas durante deployment, verifique:
1. [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) - Guia detalhado
2. Logs da aplicaÃ§Ã£o: `docker-compose logs -f`
3. Validar arquivo de configuraÃ§Ã£o: `docker-compose config`

---

**VersÃ£o**: 1.0  
**Data de CriaÃ§Ã£o**: MarÃ§o 2026  
**Status**: âœ… Pronto para ProduÃ§Ã£o


---

<a id="README"></a>
# Arquivo: README.md

# WorkSafety

Monorepo do projeto WorkSafety (prevenÃ§Ã£o / seguranÃ§a no trabalho).

## Estrutura

- **backend/** â€” API Django (REST, JWT, auth, lockout). Ver [backend/README.md](backend/README.md).
- **infra/** â€” Docker Compose (PostgreSQL + backend).
- **documentacao/** â€” Documentos de visÃ£o e planejamento.

## Subir o backend localmente

```bash
cd infra
docker compose up -d
```

Depois crie um usuÃ¡rio e teste o login conforme [backend/README.md](backend/README.md).


---

<a id="SOLUCAO_CONFIANCA_FINAL"></a>
# Arquivo: SOLUCAO_CONFIANCA_FINAL.md

# âœ… SoluÃ§Ã£o: Riscos com ConfianÃ§a Real da API

## ðŸŽ¯ O Que Foi Feito

### Problema Original
- Riscos em http://localhost:3000/inspection/risks exibiam **dados mockados** sem confianÃ§a individual
- Exemplo: "Risco tipo 1" em portuguÃªs, "Area 1", sem badge de confianÃ§a

### SoluÃ§Ã£o Implementada
Agora o sistema **retorna e exibe confianÃ§a real** de cada detecÃ§Ã£o:

```json
{
  "id": "1",
  "description": "[Uso de EPI] missing reflective vest",
  "severity": "HIGH",
  "ai_confidence": "92%",  // â† NOVO: Real da IA
  "risk_status": "ai_detected",
  "location": "Area 1"
}
```

---

## ðŸ“‹ Arquivos Modificados (5 mudanÃ§as)

### 1. `backend/assessments/ai_client.py` â­ CrÃ­tica
**O quÃª:** MockAIClient agora retorna "confidence" em cada achado
**MudanÃ§a:**
```python
# Antes:
findings.append({
    "description": "...",
    "severity": "HIGH",
    "location": f"Area {i+1}",  # Sem confidence!
})

# Depois:
findings.append({
    "description": "...",
    "severity": "HIGH",
    "location": f"Area {i+1}",
    "confidence": 0.92,  # â† NOVO
    "category": "GENERAL",  # â† NOVO
})
```

### 2. `backend/assessments/tasks.py` â­ CrÃ­tica
**O quÃª:** Task de processamento agora lÃª e armazena confianÃ§a
**MudanÃ§a na funÃ§Ã£o `_update_risk_findings()`:**
```python
# Antes:
finding = RiskFinding.objects.create(
    assessment=assessment,
    description=finding_data.get("description", ""),
    severity=finding_data.get("severity", "MEDIUM"),
    location=finding_data.get("location", ""),
    evidence=evidence,
)  # Sem ai_confidence!

# Depois:
confidence = finding_data.get("confidence", None)
# ... conversÃ£o se necessÃ¡rio ...
finding = RiskFinding.objects.create(
    assessment=assessment,
    description=finding_data.get("description", ""),
    severity=finding_data.get("severity", "MEDIUM"),
    location=finding_data.get("location", ""),
    evidence=evidence,
    ai_confidence=confidence,  # â† NOVO
)
```

### 3. `backend/assessments/models.py` âœ… JÃ¡ feito
**O quÃª:** Campo `ai_confidence` adicionado ao modelo RiskFinding
```python
ai_confidence = models.DecimalField(
    "confianÃ§a da IA",
    max_digits=4,
    decimal_places=3,  # 0.000 a 0.999
    null=True,
    blank=True,
)
```

### 4. `backend/assessments/serializers.py` âœ… JÃ¡ feito
**O quÃª:** Serializer formata confianÃ§a como percentual
```python
def get_ai_confidence(self, obj: RiskFinding) -> str:
    if obj.ai_confidence:
        return f"{obj.ai_confidence * 100:.0f}%"  # 0.92 â†’ "92%"
    return ""
```

### 5. `frontend/src/features/inspection/RisksDetected.tsx` âœ… JÃ¡ feito
**O quÃª:** Badge visual melhorado para exibir confianÃ§a
```tsx
{risk.ai_confidence && (
  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200">
    <span className="text-xs font-medium text-teal-700">
      {risk.ai_confidence}
    </span>
    <span className="text-xs text-teal-500">confidence</span>
  </div>
)}
```

---

## ðŸš€ Como Usar

### Passo 1: Aplicar MigraÃ§Ã£o
```bash
cd backend
python manage.py migrate assessments
# Deve conectar migraÃ§Ã£o 0026_add_ai_confidence_to_riskfinding
```

### Passo 2: Reiniciar ServiÃ§os
```bash
# Se usar docker-compose
docker-compose down
docker-compose up -d

# Ou se rodar localmente
# Parar e reiniciar backend + frontend
```

### Passo 3: Testar
**OpÃ§Ã£o A: Com avaliaÃ§Ã£o existente**
```bash
cd backend
python manage.py shell
```

```python
from assessments.models import RiskAssessment
from assessments.tasks import process_assessment

# Buscar avaliaÃ§Ã£o em status 'synced' ou 'error_ai'
assessment = RiskAssessment.objects.filter(
    status__in=['synced', 'error_ai']
).first()

if assessment:
    print(f"Reprocessando avaliaÃ§Ã£o {assessment.id}...")
    process_assessment(assessment.id)
    
    # Verificar resultados
    from assessments.models import RiskFinding
    findings = RiskFinding.objects.filter(assessment=assessment)
    
    for finding in findings:
        confidence = f"{finding.ai_confidence * 100:.0f}%" if finding.ai_confidence else "N/A"
        print(f"âœ“ {finding.description}: {confidence}")
```

**OpÃ§Ã£o B: Script de teste automatizado**
```bash
cd backend
python manage.py shell < test_confidence_script.py
```

### Passo 4: Acessar Frontend
https://localhost:3000/inspection/risks

Procure por um risco e veja a badge **"92% confidence"** (ou outro percentual)

---

## ðŸ“Š Dados Antes vs Depois

### Antes (Quebrado)
```json
{
  "id": "1",
  "description": "Risco tipo 1",
  "severity": "HIGH",
  "location": "Area 1",
  "ai_confidence": "",           // â† VAZIO!
  "recommendations": [...]
}
```

### Depois (Corrigido)
```json
{
  "id": "1",
  "description": "[Uso de EPI] missing reflective vest",
  "severity": "HIGH",
  "location": "Area 1",
  "ai_confidence": "92%",        // â† CONFIANÃ‡A REAL!
  "recommendations": [...]
}
```

---

## ðŸ§ª VerificaÃ§Ã£o RÃ¡pida

### No Backend
```bash
python manage.py shell

# Verificar que o campo existe
from assessments.models import RiskFinding
rf = RiskFinding.objects.first()
print(f"ai_confidence field exists: {hasattr(rf, 'ai_confidence')}")
print(f"ai_confidence value: {rf.ai_confidence}")
```

### No Banco de Dados
```bash
# Conectar ao DB
python manage.py dbshell

# Executar query
SELECT id, description, ai_confidence FROM assessments_riskfinding LIMIT 5;
```

Deve retornar algo como:
```
id | description                    | ai_confidence
1  | [Uso de EPI] missing vest      | 0.920
2  | [Trabalho em Altura] unsafe    | 0.845
```

---

## âœ¨ PrÃ³ximos Passos (Opcional)

### Para Usar API Real do OlÃ­mpia
Edite `backend/.env`:
```env
AI_SERVICE_MOCK_MODE=false
OLIMPIA_API_ENABLED=true
OLIMPIA_API_TOKEN=seu_token_aqui
```

Reinicie o backend e os dados virÃ£o direto da API!

### Para Adicionar Mais Campos
Se precisar adicionar mais informaÃ§Ãµes (bounding box, etc), siga o mesmo padrÃ£o:

1. Adicione campo ao modelo RiskFinding
2. Crie migraÃ§Ã£o
3. Atualizar `_update_risk_findings()` para ler do finding_data
4. Atualizar serializer para retornar
5. Atualizar frontend para exibir

---

## ðŸ› Troubleshooting

### ConfianÃ§a ainda nÃ£o aparece?

**1. Verificar migraÃ§Ã£o aplicada:**
```bash
python manage.py showmigrations assessments | grep 0026
# Deve estar [X] (aplicada)
```

**2. Limpar cache do navegador:**
```
Ctrl+Shift+Delete (Windows/Linux)
Cmd+Shift+Delete (Mac)
```

**3. ForÃ§ar reprocessamento:**
```bash
cd backend
python manage.py shell

from assessments.models import RiskAssessment
from assessments.tasks import process_assessment

# Mudar status para synced
assessment = RiskAssessment.objects.filter(status='ai_reviewed').first()
if assessment:
    assessment.status = 'synced'
    assessment.save()
    
    # Reprocessar
    process_assessment(assessment.id)
```

**4. Verificar logs:**
```bash
docker-compose logs -f backend | grep -i confidence
# ou
tail -f backend.log | grep -i confidence
```

### Ainda vendo "Risco tipo 1"?

Isso significa que estÃ¡ usando dados muito antigos ou cache. Execute:

```bash
# Limpar cache do navegador (veja acima)
# Limpar cache de DNS
# Reiniciar navegador completamente
# Tentar em modo incÃ³gnito

# Se ainda nÃ£o funcionar, verificar que a migraÃ§Ã£o foi aplicada (passo 1)
```

---

## ðŸ“ž Suporte

Se encontrar problemas:

1. Verifique o arquivo `TESTE_CONFIANCA.md` para guia detalhado
2. Execute `test_confidence_script.py` para diagnÃ³stico automÃ¡tico
3. Consulte os logs: `docker-compose logs -f backend`
4. Verifique se a migraÃ§Ã£o foi aplicada

---

## âœ… Checklist Final

- [ ] MigraÃ§Ã£o 0026 aplicada (`python manage.py migrate assessments`)
- [ ] Backend reiniciado
- [ ] Frontend limpou cache
- [ ] Acessou http://localhost:3000/inspection/risks
- [ ] VÃª badge "92% confidence" ao lado dos riscos
- [ ] Dados nÃ£o estÃ£o mais em portuguÃªs ("Risco tipo 1")
- [ ] Score de compliance aparece corretamente

**Se todos os itens estÃ£o âœ…, vocÃª estÃ¡ pronto!**


---

<a id="TESTE_CONFIANCA"></a>
# Arquivo: TESTE_CONFIANCA.md

# Guia de Teste - IntegraÃ§Ã£o API OlÃ­mpia com ConfianÃ§a

## MudanÃ§as Implementadas

### 1. Backend - MockAIClient agora retorna confianÃ§a

**Arquivo:** `backend/assessments/ai_client.py`

O MockAIClient foi atualizado para retornar `confidence` individual em cada finding:

```python
findings.append({
    "description": risk_type["description"],
    "severity": risk_type["severity"],
    "location": f"Area {i+1}",
    "confidence": individual_confidence,  # â† NOVO
    "category": "GENERAL",  # â† NOVO
})
```

Valores gerados: **0.70 a 0.95**

### 2. Backend - Task de Processamento atualizada

**Arquivo:** `backend/assessments/tasks.py`

A funÃ§Ã£o `_update_risk_findings` foi atualizada para **ler e armazenar** a confianÃ§a:

```python
confidence = finding_data.get("confidence", None)
# ... conversÃ£o de string para float se necessÃ¡rio ...

finding = RiskFinding.objects.create(
    # ... outros campos ...
    ai_confidence=confidence,  # â† NOVO: preenche com confianÃ§a individual
)
```

### 3. Frontend - Serializer retorna confianÃ§a formatada

**Arquivo:** `backend/assessments/serializers.py`

O serializer foi atualizado para converter decimal em percentual:

```python
def get_ai_confidence(self, obj: RiskFinding) -> str:
    if obj.ai_confidence:
        return f"{obj.ai_confidence * 100:.0f}%"  # 0.92 â†’ "92%"
    return ""
```

## âœ… Steps para Testar

### Passo 1: Aplicar MigraÃ§Ã£o
```bash
cd backend
python manage.py migrate assessments
```

### Passo 2: ForÃ§ar Reprocessamento

Acesse o shell Django e reprocesse uma avaliaÃ§Ã£o:

```bash
python manage.py shell
```

```python
from assessments.models import RiskAssessment
from assessments.tasks import process_assessment

# Buscar uma avaliaÃ§Ã£o em status AI_REVIEWED
assessment = RiskAssessment.objects.filter(
    status='synced'  # ou 'error_ai' para reprocessar
).first()

if assessment:
    print(f"Processando avaliaÃ§Ã£o {assessment.id}...")
    process_assessment(assessment.id)
    
    # Verificar resultados
    from assessments.models import RiskFinding
    findings = RiskFinding.objects.filter(assessment=assessment)
    
    for finding in findings:
        confidence_str = f"{finding.ai_confidence * 100:.0f}%" if finding.ai_confidence else "N/A"
        print(f"  - {finding.description}: {confidence_str}")
```

### Passo 3: Verificar no Frontend

1. Acesse: http://localhost:3000/inspection/risks
2. Procure por um risco
3. Verifique a badge "92% confidence" (ou outro percentual)

## ðŸ” Fluxo Completo (Atualizado)

```
MockAIClient.analyze_assessment()
  â”‚
  â”œâ”€ finding = { "confidence": 0.92, "description": "...", ... }
  â”‚
  â””â”€ AIInferenceResult(findings=[finding])
      â”‚
      â””â”€ process_assessment() task
          â”‚
          â”œâ”€ _update_risk_findings()
          â”‚  â”‚
          â”‚  â”œâ”€ confidence = finding_data.get("confidence")  # 0.92
          â”‚  â”‚
          â”‚  â””â”€ RiskFinding.objects.create(ai_confidence=0.92)
          â”‚
          â””â”€ API JSON Response
              â”‚
              â”œâ”€ RiskItemSerializer.get_ai_confidence()
              â”‚  â”‚
              â”‚  â””â”€ return "92%"
              â”‚
              â””â”€ Frontend recebe:
                  {
                    "ai_confidence": "92%",
                    "description": "...",
                    "severity": "HIGH"
                  }
                  â””â”€ Exibe: Badge teal "92% confidence"
```

## ðŸ“Š Dados Esperados

### Antes (Quebrado)
```json
{
  "description": "Risco tipo 1",
  "severity": "HIGH",
  "ai_confidence": ""
}
```

### Depois (Corrigido)
```json
{
  "description": "[Risk Type] Description",
  "severity": "HIGH",
  "location": "Area 1",
  "ai_confidence": "75%"
}
```

## ðŸ› Troubleshooting

### ConfianÃ§a ainda nÃ£o aparece?

1. **Limpar cache do navegador:**
   ```bash
   Ctrl+Shift+Delete
   ```

2. **Verificar se a migraÃ§Ã£o foi aplicada:**
   ```bash
   python manage.py showmigrations assessments | grep 0026
   ```

3. **Verificar se o campo existe no BD:**
   ```bash
   python manage.py dbshell
   select * from assessments_riskfinding limit 1;
   # Procure pelo campo ai_confidence
   ```

4. **Verificar logs:**
   ```bash
   docker-compose logs -f backend
   # Procure por avisos ou erros no processamento
   ```

### Ainda vendo "Area 1" em portuguÃªs?

Isso significa que o MockAIClient estÃ¡ sendo usado. Para usar a API real do OlÃ­mpia:

```env
# backend/.env
AI_SERVICE_MOCK_MODE=false
OLIMPIA_API_ENABLED=true
OLIMPIA_API_TOKEN=seu_token_aqui
```

## âœ¨ Resumo das MudanÃ§as

| Arquivo | MudanÃ§a | Impacto |
|---------|---------|--------|
| `ai_client.py` | MockAIClient retorna "confidence" | Dados mockados tÃªm confianÃ§a |
| `tasks.py` | `_update_risk_findings` lÃª "confidence" | RiskFinding armazena confianÃ§a |
| `serializers.py` | `get_ai_confidence` formata em % | API retorna "92%" |
| `models.py` | Campo `ai_confidence` adicionado | BD persiste confianÃ§a |
| `RisksDetected.tsx` | Badge visual melhorado | UI mostra confianÃ§a bonita |

---

**Status:** âœ… Todas as mudanÃ§as implementadas e prontas para teste!


---

<a id="WINDOWS_SETUP"></a>
# Arquivo: WINDOWS_SETUP.md

# Setup no Windows (PowerShell)

## ðŸ”´ Problemas Comuns

### 1. Redis jÃ¡ estÃ¡ rodando
A porta 6379 jÃ¡ estÃ¡ em uso porque o Redis jÃ¡ estÃ¡ rodando no Docker. âœ… **NÃ£o precisa fazer nada!**

### 2. Comando 'celery' nÃ£o encontrado
O ambiente virtual Python nÃ£o estÃ¡ criado ou ativado.

---

## âœ… Passo a Passo

### Passo 1: Preparar Backend (execute no PowerShell)

```powershell
# Entrar na pasta do backend
cd D:\DATAPrev\WorkSafety\backend

# Criar ambiente virtual (sÃ³ primeira vez)
python -m venv venv

# Ativar ambiente virtual
.\venv\Scripts\Activate.ps1

# Instalar dependÃªncias
pip install -r requirements.txt
```

---

### Passo 2: Iniciar Celery Worker (Terminal 1)

```powershell
cd D:\DATAPrev\WorkSafety\backend
.\venv\Scripts\Activate.ps1
celery -A config worker -l info
```

**Deve aparecer:**
```
[tasks]
  . assessments.tasks.process_assessment
  . assessments.tasks.reprocess_assessment

[INFO] Connected to redis://localhost:6379/0
```

---

### Passo 3: Iniciar Django (Terminal 2)

```powershell
cd D:\DATAPrev\WorkSafety\backend
.\venv\Scripts\Activate.ps1
python manage.py runserver
```

---

### Passo 4: Iniciar Frontend (Terminal 3)

```powershell
cd D:\DATAPrev\WorkSafety\frontend
npm run dev
```

---

## ðŸš€ Script AutomÃ¡tico

Execute no PowerShell como Administrador:

```powershell
# Permitir execuÃ§Ã£o de scripts
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Executar script de setup
cd D:\DATAPrev\WorkSafety
.\START_WINDOWS.ps1
```

---

## ðŸ§ª Testando

1. Acesse http://localhost:3000
2. FaÃ§a login
3. Crie uma nova inspeÃ§Ã£o com fotos
4. Acompanhe nos logs:
   - **Terminal Celery**: Deve mostrar "Processing assessment X"
   - **Terminal Django**: RequisiÃ§Ãµes HTTP
   - **Navegador**: Tela de "AI Analysis in Progress"

---

## â— Troubleshooting

### "python nÃ£o Ã© reconhecido"
Instale o Python 3.10+ do https://python.org e marque "Add to PATH"

### "npm nÃ£o Ã© reconhecido"
Instale o Node.js do https://nodejs.org

### "Erro de permissÃ£o no PowerShell"
Execute: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

### Redis parou de funcionar
```powershell
docker ps
# Se nÃ£o aparecer, inicie:
docker run -d -p 6379:6379 redis:alpine
```


---

<a id="WorkSafetyWeb-INTEGRATION"></a>
# Arquivo: WorkSafetyWeb\INTEGRATION.md

# IntegraÃ§Ã£o com API de UsuÃ¡rios

Este documento descreve a integraÃ§Ã£o do frontend WorkSafetyWeb com a API de usuÃ¡rios do backend Django.

## ConfiguraÃ§Ã£o

### 1. VariÃ¡veis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variÃ¡veis:

```env
VITE_API_URL="http://localhost:3001"
```

Ou use o valor padrÃ£o que jÃ¡ estÃ¡ configurado no cÃ³digo.

### 2. Backend Django

Certifique-se de que o backend estÃ¡ rodando na porta 3001:

```bash
cd backend
python manage.py runserver 3001
```

O backend deve ter as seguintes URLs disponÃ­veis:
- `POST /api/auth/login/` - Login
- `POST /api/auth/logout/` - Logout
- `GET /api/auth/me/` - Dados do usuÃ¡rio atual
- `POST /api/auth/token/refresh/` - Refresh do token JWT
- `GET /api/users/` - Listar usuÃ¡rios
- `POST /api/users/` - Criar usuÃ¡rio
- `PATCH /api/users/{id}/` - Atualizar usuÃ¡rio
- `GET /api/admin/assessment-types/` - Listar tipos de avaliaÃ§Ã£o
- `POST /api/admin/assessment-types/` - Criar tipo de avaliaÃ§Ã£o
- `PATCH /api/admin/assessment-types/{id}/` - Atualizar tipo de avaliaÃ§Ã£o
- `POST /api/admin/assessment-types/{id}/deactivate/` - Desativar tipo de avaliaÃ§Ã£o
- `GET /api/admin/environment-types/` - Listar tipos de ambiente
- `POST /api/admin/environment-types/` - Criar tipo de ambiente
- `PATCH /api/admin/environment-types/{id}/` - Atualizar tipo de ambiente
- `POST /api/admin/environment-types/{id}/deactivate/` - Desativar tipo de ambiente
- `GET /api/admin/risk-types/` - Listar tipos de risco
- `POST /api/admin/risk-types/` - Criar tipo de risco
- `PATCH /api/admin/risk-types/{id}/` - Atualizar tipo de risco
- `POST /api/admin/risk-types/{id}/deactivate/` - Desativar tipo de risco
- `GET /api/admin/ai-thresholds/` - Listar thresholds da IA
- `PUT /api/admin/ai-thresholds/confidence/` - Atualizar threshold de confianÃ§a
- `GET /api/admin/ai-thresholds/confidence/current/` - Obter threshold atual

## Arquitetura da IntegraÃ§Ã£o

### ServiÃ§os (`src/services/api.ts`)

O arquivo `api.ts` contÃ©m:

1. **Tipos de Dados**: Interfaces TypeScript para User, CreateUserData, etc.
2. **Cliente HTTP**: FunÃ§Ã£o `fetchWithAuth` que automaticamente:
   - Adiciona o token JWT nas requisiÃ§Ãµes
   - Gerencia o refresh do token quando expira
   - Trata erros da API
3. **ServiÃ§os**:
   - `authService`: Login, logout, dados do usuÃ¡rio
   - `userService`: CRUD de usuÃ¡rios

### Hooks

#### useAuth (`src/hooks/useAuth.ts`)

Gerencia o estado de autenticaÃ§Ã£o:

```typescript
const { 
  user,           // Dados do usuÃ¡rio logado
  isAuthenticated,// Booleano
  isLoading,      // Estado de carregamento
  error,          // Erro de autenticaÃ§Ã£o
  login,          // FunÃ§Ã£o de login
  logout,         // FunÃ§Ã£o de logout
  checkAuth,      // Verifica autenticaÃ§Ã£o
  clearError      // Limpa erros
} = useAuth();
```

#### useUsers (`src/hooks/useUsers.ts`)

Gerencia o estado dos usuÃ¡rios:

```typescript
const {
  users,          // Lista de usuÃ¡rios
  isLoading,      // Estado de carregamento
  error,          // Erro da API
  fetchUsers,     // Recarrega a lista
  createUser,     // Cria novo usuÃ¡rio
  updateUser,     // Atualiza usuÃ¡rio
  deactivateUser, // Desativa usuÃ¡rio
  activateUser,   // Ativa usuÃ¡rio
  clearError      // Limpa erros
} = useUsers();
```

### Componentes

#### ProtectedRoute (`src/components/ProtectedRoute.tsx`)

Protege rotas que requerem autenticaÃ§Ã£o:

```tsx
<ProtectedRoute requireAdmin>
  <UsersPage />
</ProtectedRoute>
```

## Fluxo de AutenticaÃ§Ã£o

1. UsuÃ¡rio faz login na pÃ¡gina `/login`
2. Backend retorna tokens JWT (access + refresh)
3. Tokens sÃ£o armazenados no localStorage
4. Todas as requisiÃ§Ãµes incluem o token no header `Authorization: Bearer {token}`
5. Quando o token expira (401), o sistema tenta refresh automÃ¡tico
6. Se refresh falhar, usuÃ¡rio Ã© redirecionado para login

## PÃ¡ginas Integradas

### Login (`src/pages/Login.tsx`)

- FormulÃ¡rio de login
- ValidaÃ§Ã£o de credenciais
- Redirecionamento automÃ¡tico apÃ³s login

### Users (`src/pages/Users.tsx`)

- Lista usuÃ¡rios da API
- EstatÃ­sticas (total, ativos, admins)
- Criar novo usuÃ¡rio (modal)
- Ativar/desativar usuÃ¡rio
- Protegida por autenticaÃ§Ã£o de admin

## Mapeamento de Dados

### Backend â†’ Frontend

| Backend | Frontend | DescriÃ§Ã£o |
|---------|----------|-----------|
| `id` | `id` | ID do usuÃ¡rio |
| `email` | `email` | E-mail |
| `first_name + last_name` | `name` | Nome completo |
| `is_staff` | `is_staff`, `role` | Papel (admin/inspector) |
| `is_active` | `is_active`, `isActive` | Status ativo |
| `date_joined` | `date_joined` | Data de criaÃ§Ã£o |

### OperaÃ§Ãµes CRUD

| OperaÃ§Ã£o | MÃ©todo HTTP | Endpoint | Body |
|----------|-------------|----------|------|
| Listar | GET | `/api/users/` | - |
| Criar | POST | `/api/users/` | `{email, password, is_staff}` |
| Atualizar | PATCH | `/api/users/{id}/` | `{is_active, is_staff}` |
| Desativar | PATCH | `/api/users/{id}/` | `{is_active: false}` |
| Listar Tipos de AvaliaÃ§Ã£o | GET | `/api/admin/assessment-types/` | - |
| Criar Tipo de AvaliaÃ§Ã£o | POST | `/api/admin/assessment-types/` | `{name, description}` |
| Atualizar Tipo de AvaliaÃ§Ã£o | PATCH | `/api/admin/assessment-types/{id}/` | `{name, description}` |
| Desativar Tipo de AvaliaÃ§Ã£o | POST | `/api/admin/assessment-types/{id}/deactivate/` | - |
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

## Testando a IntegraÃ§Ã£o

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

4. FaÃ§a login com credenciais vÃ¡lidas do Django

5. Navegue atÃ© "UsuÃ¡rios" no menu lateral

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

O sistema tenta fazer refresh automÃ¡tico. Se falhar, verifique:
- O endpoint `/auth/token/refresh/` estÃ¡ funcionando
- O refresh token estÃ¡ sendo salvo corretamente

### Erro 403 Forbidden

Apenas administradores (`is_staff=true`) podem acessar `/users/`. Verifique se o usuÃ¡rio logado tem permissÃ£o de admin.


---

<a id="WorkSafetyWeb-README"></a>
# Arquivo: WorkSafetyWeb\README.md

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/61749515-c837-49a0-9c70-cb5ab416878f

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


---

<a id="backend-LGPD_PRIVACY_IMPLEMENTATION"></a>
# Arquivo: backend\LGPD_PRIVACY_IMPLEMENTATION.md

# ImplementaÃ§Ã£o LGPD/GDPR - Conformidade de Privacidade

## Resumo

Esta implementaÃ§Ã£o adiciona conformidade com LGPD (Lei Geral de ProteÃ§Ã£o de Dados) e GDPR (General Data Protection Regulation) ao sistema WorkSafety, garantindo que dados pessoais em evidÃªncias (imagens) sejam tratados de acordo com as regulamentaÃ§Ãµes.

## CritÃ©rios de Aceite Atendidos

### 1. Base Legal por AvaliaÃ§Ã£o âœ…

- Campo `legal_basis` em `RiskAssessment` com as seguintes opÃ§Ãµes:
  - `consent` - Consentimento do titular
  - `legitimate_interest` - Interesse legÃ­timo (padrÃ£o)
  - `legal_obligation` - Cumprimento de obrigaÃ§Ã£o legal
  - `contract` - ExecuÃ§Ã£o de contrato
  - `public_interest` - MissÃ£o de interesse pÃºblico
  - `vital_interest` - ProteÃ§Ã£o da vida

- Campo `legal_basis_notes` para justificativa adicional

- Base legal exposta em:
  - Serializers (list, detail, create/update)
  - Admin Django
  - RelatÃ³rios PDF (dados de compliance)

### 2. AnonimizaÃ§Ã£o de EvidÃªncias âœ…

- **ServiÃ§o de AnonimizaÃ§Ã£o** (`assessments/anonymization.py`):
  - DetecÃ§Ã£o de rostos usando OpenCV Haar Cascade
  - AnonimizaÃ§Ã£o via blur, pixelate ou blackout
  - TODO explÃ­cito para placas de veÃ­culos
  - Flag `ANONYMIZATION_BLOCK_PLATES` para ambientes que exigem

- **Pipeline de Upload** (`EvidenceUploadView`):
  - AnonimizaÃ§Ã£o sÃ­ncrona por padrÃ£o
  - Fallback para processamento assÃ­ncrono via Celery
  - Arquivo persistido jÃ¡ estÃ¡ anonimizado

- **Task Celery** (`anonymize_evidence_task`):
  - Processamento assÃ­ncrono para casos de erro
  - Batch processing para reprocessamento em lote

- **Campos de Rastreamento** no modelo `Evidence`:
  - `is_anonymized` - Indica se foi processada
  - `anonymized_at` - Timestamp da anonimizaÃ§Ã£o
  - `anonymization_status` - Estado do processo (pending/processing/completed/failed/skipped)
  - `original_file_hash` - SHA-256 do arquivo original (para auditoria)

### 3. Logs e Auditoria âœ…

- **Modelo `EvidenceAnonymizationLog`**:
  - Registro de todas as operaÃ§Ãµes de anonimizaÃ§Ã£o
  - Contadores de rostos/placas detectados e anonimizados
  - DuraÃ§Ã£o do processamento
  - UsuÃ¡rio que executou
  - Mensagens de erro

- **IntegraÃ§Ã£o com PDF**:
  - VerificaÃ§Ã£o de anonimizaÃ§Ã£o antes de gerar PDF
  - Dados de compliance LGPD incluÃ­dos no relatÃ³rio
  - Garantia de que imagens no PDF estÃ£o anonimizadas

### 4. MinimizaÃ§Ã£o de Dados âœ…

- Hash do arquivo original armazenado apenas para auditoria
- Arquivo final Ã© sempre a versÃ£o anonimizada
- Logs detalhados para rastreabilidade
- ConfiguraÃ§Ãµes para desabilitar anonimizaÃ§Ã£o em desenvolvimento

## ConfiguraÃ§Ãµes

Adicione ao `settings.py` ou via variÃ¡veis de ambiente:

```python
# Habilitar/desabilitar anonimizaÃ§Ã£o (default: True)
ANONYMIZATION_ENABLED = True

# Bloquear upload se placas nÃ£o forem anonimizadas (default: False)
ANONYMIZATION_BLOCK_PLATES = False

# MÃ©todo de anonimizaÃ§Ã£o: 'blur', 'pixelate', 'blackout' (default: 'blur')
ANONYMIZATION_METHOD = 'blur'

# Tamanho do kernel de blur (deve ser Ã­mpar, default: 51)
ANONYMIZATION_BLUR_KERNEL = 51
```

## DependÃªncias

Adicionada ao `requirements.txt`:
```
opencv-python>=4.9.0
```

## MigraÃ§Ãµes

Arquivo: `assessments/migrations/0014_lgpd_privacy_compliance.py`

Inclui:
- Campos `legal_basis` e `legal_basis_notes` em RiskAssessment
- Campos de anonimizaÃ§Ã£o em Evidence
- CriaÃ§Ã£o do modelo EvidenceAnonymizationLog
- Ãndices para performance de consultas

## Testes

Arquivo: `assessments/tests/test_privacy_lgpd.py`

Cobertura:
- Modelos (LegalBasis, Evidence anonymization fields)
- ServiÃ§o de anonimizaÃ§Ã£o
- Serializers
- IntegraÃ§Ã£o com upload
- Auditoria e logs

Execute com:
```bash
cd backend
python manage.py test assessments.tests.test_privacy_lgpd
```

## Admin Django

Atualizado para incluir:
- Campos LGPD em RiskAssessment
- Status de anonimizaÃ§Ã£o em Evidence
- Inline de logs de anonimizaÃ§Ã£o
- Filtros e buscas adicionais

## API Endpoints

### Upload de EvidÃªncias
```
POST /api/assessments/{id}/upload/
```

Agora inclui processo automÃ¡tico de anonimizaÃ§Ã£o.

### Dados de AvaliaÃ§Ã£o
```
GET /api/assessments/{id}/
```

Retorna campos `legal_basis`, `legal_basis_display`, `legal_basis_notes`.

### EvidÃªncias
Todas as respostas de evidÃªncia incluem:
- `is_anonymized`
- `anonymization_status`
- `anonymized_at`
- `privacy_status` (resumo)

## TODOs e LimitaÃ§Ãµes

1. **AnonimizaÃ§Ã£o de Placas**: 
   - NÃ£o implementada atualmente
   - Sempre retorna 0 detectados
   - Flag `ANONYMIZATION_BLOCK_PLATES` disponÃ­vel para ambientes que exigem
   - SugestÃµes para implementaÃ§Ã£o futura:
     - Treinar modelo Haar Cascade customizado
     - Usar OCR (Tesseract/EasyOCR)
     - Modelo de deep learning (YOLO)

2. **Performance**:
   - AnonimizaÃ§Ã£o sÃ­ncrona pode adicionar latÃªncia ao upload
   - Para grandes volumes, considere aumentar workers do Celery

3. **PrecisÃ£o**:
   - Haar Cascade pode nÃ£o detectar todos os rostos
   - Falsos positivos sÃ£o possÃ­veis
   - Recomenda-se validaÃ§Ã£o humana periÃ³dica

## SeguranÃ§a

- Arquivos originais nÃ£o sÃ£o mantidos (apenas hash para auditoria)
- URLs pÃºblicas sempre apontam para versÃ£o anonimizada
- Logs detalhados permitem rastreabilidade completa
- ConfiguraÃ§Ãµes sensÃ­veis via environment variables

## Compatibilidade

- MantÃ©m compatibilidade com cÃ³digo existente
- Campos novos tÃªm valores padrÃ£o sensÃ­veis
- AnonimizaÃ§Ã£o pode ser desabilitada via configuraÃ§Ã£o
- Fallbacks implementados para erros de processamento


---

<a id="backend-README"></a>
# Arquivo: backend\README.md

# WorkSafety Backend (Django)

API REST de autenticaÃ§Ã£o (login/logout) com JWT, lockout apÃ³s 5 falhas, blacklist de refresh token, modelo de avaliaÃ§Ãµes de risco, gestÃ£o de usuÃ¡rios (admin), reset de senha e **pipeline assÃ­ncrono de processamento de IA**.

## Sprint 3 â€” Pipeline AssÃ­ncrono de IA

- **F3.2/F5.3** â€” Processamento assÃ­ncrono de avaliaÃ§Ãµes com Celery + Redis
- **Enfileiramento automÃ¡tico** â€” Ao atingir SYNCED, o processamento de IA Ã© enfileirado automaticamente
- **Retry automÃ¡tico** â€” AtÃ© 3 tentativas em caso de falha
- **Status tracking** â€” PENDING â†’ RUNNING â†’ SUCCEEDED/FAILED
- **Reprocessamento** â€” Endpoint para re-enfileirar avaliaÃ§Ãµes em erro
- **Mock de IA** â€” Cliente mock para desenvolvimento e testes

### Fluxo de Processamento

```
SYNCED â†’ [enfileira Celery] â†’ RUNNING â†’ [IA analisa] â†’ SUCCEEDED â†’ AI_REVIEWED
                                    â†“
                              [falha apÃ³s retries] â†’ FAILED â†’ ERROR
```

### Componentes

- **AIClient Interface** (`assessments/ai_client.py`) â€” Interface mockÃ¡vel para serviÃ§o de IA
- **Celery Tasks** (`assessments/tasks.py`) â€” Tasks assÃ­ncronas de processamento
- **Endpoints de IA** â€” Processamento forÃ§ado, reprocessamento e consulta de status

## Sprint 1 â€” Entregas

- **F20.1 + F6.1** â€” Login (email/senha, JWT access + refresh).
- **F20.5** â€” Logout seguro (blacklist do refresh token).
- **JWT** â€” djangorestframework-simplejwt com token_blacklist.
- **Lockout** â€” 5 falhas / 15 min (configurÃ¡vel).
- **Swagger/OpenAPI** â€” drf-spectacular em `/schema/` e `/docs/`.
- **Docker** â€” Compose com backend + Postgres.
- **F12.1â€“F12.6** â€” Modelo de dados: app `assessments` (RiskAssessment, Evidence, RiskFinding, AIInferenceResult, HumanValidationDecision); User mantido em `accounts`; MEDIA_ROOT para evidÃªncias; migrations.
- **F4.4** â€” SeguranÃ§a: settings de produÃ§Ã£o (TLS via proxy, cookies seguros, redirect HTTPS); README com volumes criptografados e checklist de deploy.
- **F17.1** â€” GestÃ£o de usuÃ¡rios: endpoints `/users/` (listar, criar, detalhe, PATCH/desativar); apenas admin (`IsAdminUser`).
- **F17.4** â€” Reset de senha: solicitar (email) e confirmar (uidb64 + token + nova senha); respostas genÃ©ricas; PasswordResetTokenGenerator + uidb64 (sem persistÃªncia).
- **Testes** â€” auth (login, logout, lockout), modelos assessments, user management, password reset.

## PrÃ©-requisitos

- Docker e Docker Compose
- Ou: Python 3.12+, PostgreSQL (para rodar sem Docker)

## ConfiguraÃ§Ã£o

1. Copie o arquivo de ambiente:
   ```bash
   cp .env.example .env
   ```
2. Ajuste `SECRET_KEY` e, se quiser, `POSTGRES_PASSWORD` em `.env`.

## Subir com Docker Compose (recomendado)

Na raiz do repositÃ³rio (monorepo):

```bash
cd infra
docker compose up -d
```

O backend sobe na porta **8000** e aplica as migrations automaticamente ao iniciar.

### Criar um usuÃ¡rio para testar login

Com os containers em execuÃ§Ã£o:

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

### DocumentaÃ§Ã£o da API (Swagger)

- Schema OpenAPI: http://localhost:8000/schema/
- Swagger UI: http://localhost:8000/docs/

## Rodar sem Docker (local)

1. Crie um banco PostgreSQL e defina `DATABASE_URL` ou `POSTGRES_*` no `.env`.
2. No diretÃ³rio `backend/`:
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

Sem Docker, com SQLite (nÃ£o precisa de Postgres):

```bash
cd backend
set TESTING=1
python manage.py test accounts.tests assessments.tests -v 2
```

No PowerShell:

```powershell
$env:TESTING="1"; python manage.py test accounts.tests assessments.tests -v 2
```

## SeguranÃ§a (F4.4)

### Criptografia em trÃ¢nsito

- **Desenvolvimento:** o trÃ¡fego Ã© HTTP (sem TLS).
- **ProduÃ§Ã£o:** use um reverse proxy (Nginx, Traefik, etc.) com **TLS 1.2+** na frente do Django; configure redirecionamento HTTP â†’ HTTPS no proxy. Defina no ambiente:
  - `SECURE_HTTPS=1`
  O Django aplica entÃ£o: `SECURE_PROXY_SSL_HEADER`, `CSRF_COOKIE_SECURE`, `SESSION_COOKIE_SECURE`, `SECURE_SSL_REDIRECT` (confiando no header `X-Forwarded-Proto: https` enviado pelo proxy).

### Criptografia em repouso (MVP)

- **Banco (PostgreSQL):** os dados ficam no volume/disco do provedor. Garanta que o **volume do Postgres seja criptografado** no host ou no provedor (ex.: LUKS, EBS encryption, disco criptografado).
- **Arquivos (MEDIA):** evidÃªncias sÃ£o armazenadas em `MEDIA_ROOT`. Garanta que o **volume ou diretÃ³rio de mÃ­dia seja criptografado** no host/provedor.
- Criptografia â€œno appâ€ (campos sensÃ­veis, etc.) nÃ£o estÃ¡ no escopo do MVP; evoluÃ§Ãµes podem ser tratadas em Sprint/infra futura.

### Checklist de deploy (produÃ§Ã£o)

- [ ] Reverse proxy com TLS 1.2+ e HTTP â†’ HTTPS configurado.
- [ ] VariÃ¡vel `SECURE_HTTPS=1` no ambiente de produÃ§Ã£o.
- [ ] Volume do PostgreSQL criptografado (host/provedor).
- [ ] Volume ou diretÃ³rio de MEDIA criptografado (host/provedor).
- [ ] `SECRET_KEY` forte e nÃ£o commitada; `DEBUG=false`.

## VariÃ¡veis de ambiente (.env)

| VariÃ¡vel | DescriÃ§Ã£o | Default |
|----------|-----------|---------|
| `SECRET_KEY` | Chave secreta Django | (dev) |
| `DATABASE_URL` | URL PostgreSQL (postgres://user:pass@host:port/db) | - |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT` | ConexÃ£o Postgres (se nÃ£o usar DATABASE_URL) | worksafety / localhost:5432 |
| `ACCESS_TOKEN_LIFETIME_MINUTES` | Tempo de vida do access token JWT (min) | 60 |
| `REFRESH_TOKEN_LIFETIME_DAYS` | Tempo de vida do refresh token (dias) | 7 |
| `LOCKOUT_MAX_ATTEMPTS` | Tentativas antes de bloquear | 5 |
| `LOCKOUT_MINUTES` | Minutos de bloqueio | 15 |
| `PASSWORD_RESET_TIMEOUT` | ExpiraÃ§Ã£o do token de reset de senha (segundos) | 3600 |
| `SECURE_HTTPS` | Se `1`, ativa cookies seguros e redirect HTTPS (produÃ§Ã£o) | 0 |
| `TESTING` | Se `1`, usa SQLite para testes | - |
| `CELERY_BROKER_URL` | URL do broker Redis | redis://localhost:6379/0 |
| `CELERY_RESULT_BACKEND` | URL do backend de resultados Redis | redis://localhost:6379/0 |
| `AI_SERVICE_ENABLED` | Habilita serviÃ§o de IA | true |
| `AI_SERVICE_MOCK_MODE` | Usa mock de IA em vez de serviÃ§o real | true |
| `AI_SERVICE_TIMEOUT` | Timeout para chamadas de IA (segundos) | 30 |
| `AI_SERVICE_BASE_URL` | URL base do serviÃ§o de IA (produÃ§Ã£o) | - |
| `AI_SERVICE_API_KEY` | API key do serviÃ§o de IA (produÃ§Ã£o) | - |

## Endpoints

### AutenticaÃ§Ã£o

- **POST /auth/login/** â€” Login (email + senha). Retorna `access`, `refresh` e `user`. 401 credenciais invÃ¡lidas, 429 conta bloqueada.
- **POST /auth/logout/** â€” Body: `{"refresh": "<token>"}`. Invalida o refresh token (204).
- **POST /auth/token/refresh/** â€” Body: `{"refresh": "<token>"}`. Retorna novo access token.
- **POST /auth/password-reset/** â€” Solicitar redefiniÃ§Ã£o de senha (body: `{"email": "..."}`). Resposta sempre genÃ©rica (200).
- **POST /auth/password-reset/confirm/** â€” Confirmar nova senha (body: `{"uidb64": "...", "token": "...", "new_password": "..."}`). 200 ou 400 genÃ©rico.

### Processamento de IA (autenticado)

- **POST /assessments/<id>/process-ai/** â€” ForÃ§a processamento de IA (status deve ser `synced` ou `error`).
- **POST /assessments/<id>/reprocess/** â€” Reprocessa avaliaÃ§Ã£o em erro (status deve ser `error`).
- **GET /assessments/<id>/ai-status/** â€” Consulta status do processamento de IA.

### GestÃ£o de usuÃ¡rios (apenas admin â€” JWT com is_staff)

- **GET /users/** â€” Listar usuÃ¡rios.
- **POST /users/** â€” Cadastrar usuÃ¡rio (body: `{"email": "...", "password": "..."}`).
- **GET /users/<id>/** â€” Detalhe do usuÃ¡rio.
- **PATCH /users/<id>/** â€” Atualizar (ex.: `{"is_active": false}` para desativar).

## ExecuÃ§Ã£o do Pipeline de IA

### Com Docker Compose (recomendado)

O `docker-compose.yml` jÃ¡ inclui os serviÃ§os `redis` e `worker`:

```bash
cd infra
docker compose up -d
```

Isso inicia:
- PostgreSQL (banco de dados)
- Redis (broker de filas)
- Backend Django (API)
- Worker Celery (processamento assÃ­ncrono)

### Sem Docker (local)

1. Instale e inicie o Redis:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install redis-server
   sudo service redis-server start
   
   # macOS
   brew install redis
   brew services start redis
   ```

2. Em um terminal, inicie o worker Celery:
   ```bash
   cd backend
   celery -A config worker --loglevel=info
   ```

3. Em outro terminal, inicie o servidor Django:
   ```bash
   cd backend
   python manage.py runserver
   ```

### Testando o Pipeline

1. Crie uma avaliaÃ§Ã£o e faÃ§a upload de evidÃªncias:
   ```bash
   # Criar avaliaÃ§Ã£o
   curl -X POST http://localhost:8000/api/v1/assessments/ \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"title": "Test Assessment"}'
   
   # Fazer upload de imagens
   curl -X POST http://localhost:8000/api/v1/assessments/1/evidences/ \
     -H "Authorization: Bearer <token>" \
     -F "images=@photo1.jpg" \
     -F "images=@photo2.jpg"
   ```

2. Capture e sincronize (dispara processamento automÃ¡tico):
   ```bash
   # Capturar
   curl -X POST http://localhost:8000/api/v1/assessments/1/capture/ \
     -H "Authorization: Bearer <token>"
   
   # Sincronizar (enfileira processamento de IA)
   curl -X POST http://localhost:8000/api/v1/assessments/1/sync/ \
     -H "Authorization: Bearer <token>"
   ```

3. Consulte o status do processamento:
   ```bash
   curl http://localhost:8000/api/v1/assessments/1/ai-status/ \
     -H "Authorization: Bearer <token>"
   ```

4. Se falhar, reprocessar:
   ```bash
   curl -X POST http://localhost:8000/api/v1/assessments/1/reprocess/ \
     -H "Authorization: Bearer <token>"
   ```


---

<a id="backend-configurations-README"></a>
# Arquivo: backend\configurations\README.md

# ConfiguraÃ§Ãµes Administrativas

Este app Django (`configurations`) implementa as funcionalidades F16.1, F16.2, F16.3 e F16.6 do sistema WorkSafety.

## Funcionalidades Implementadas

### F16.1 - Tipos de AvaliaÃ§Ã£o (`AssessmentType`)
- Cadastrar, editar e desativar tipos de avaliaÃ§Ã£o
- Endpoint: `/api/admin/assessment-types/`
- Campos: `name`, `description`, `active`

### F16.2 - Tipos de Ambiente (`EnvironmentType`)
- Cadastrar, editar e desativar tipos de ambiente (canteiro, mina, fÃ¡brica, etc.)
- Endpoint: `/api/admin/environment-types/`
- Campos: `name`, `description`, `active`
- Tipos de ambiente sÃ£o selecionÃ¡veis na criaÃ§Ã£o de avaliaÃ§Ãµes

### F16.3 - Tipos de Risco (`RiskType`)
- Cadastrar, editar e desativar tipos de risco
- Endpoint: `/api/admin/risk-types/`
- Campos: `name`, `description`, `active`
- Tipos de risco sÃ£o utilizados na classificaÃ§Ã£o das inferÃªncias da IA

### F16.6 - Thresholds da IA (`AIThreshold`)
- Configurar o limiar mÃ­nimo de confianÃ§a para classificaÃ§Ãµes automÃ¡ticas
- Endpoint: `/api/admin/ai-thresholds/`
- Valor padrÃ£o: 60%
- AlteraÃ§Ãµes sÃ£o registradas em log de auditoria
- Endpoints especÃ­ficos:
  - `GET /api/admin/ai-thresholds/confidence/current/` - Obter threshold atual
  - `PUT /api/admin/ai-thresholds/confidence/` - Atualizar threshold

### Log de Auditoria (`AuditLog`)
- Registra todas as alteraÃ§Ãµes nas configuraÃ§Ãµes
- Endpoint: `/api/admin/audit-logs/`
- AÃ§Ãµes registradas: CREATE, UPDATE, DELETE, DEACTIVATE, ACTIVATE
- Campos: `entity_type`, `entity_id`, `action`, `previous_value`, `new_value`, `performed_by`, `timestamp`

## PermissÃµes

- **Leitura (GET)**: Qualquer usuÃ¡rio autenticado
- **Escrita (POST, PUT, PATCH, DELETE)**: Apenas administradores (`is_staff=True`)

## Endpoints

### Assessment Types
| MÃ©todo | Endpoint | DescriÃ§Ã£o |
|--------|----------|-----------|
| GET | `/api/admin/assessment-types/` | Listar tipos de avaliaÃ§Ã£o |
| POST | `/api/admin/assessment-types/` | Criar tipo de avaliaÃ§Ã£o |
| GET | `/api/admin/assessment-types/{id}/` | Obter tipo especÃ­fico |
| PATCH | `/api/admin/assessment-types/{id}/` | Atualizar tipo |
| DELETE | `/api/admin/assessment-types/{id}/` | Excluir tipo |
| POST | `/api/admin/assessment-types/{id}/deactivate/` | Desativar tipo |
| POST | `/api/admin/assessment-types/{id}/activate/` | Ativar tipo |

### Environment Types
| MÃ©todo | Endpoint | DescriÃ§Ã£o |
|--------|----------|-----------|
| GET | `/api/admin/environment-types/` | Listar tipos de ambiente |
| POST | `/api/admin/environment-types/` | Criar tipo de ambiente |
| GET | `/api/admin/environment-types/{id}/` | Obter tipo especÃ­fico |
| PATCH | `/api/admin/environment-types/{id}/` | Atualizar tipo |
| DELETE | `/api/admin/environment-types/{id}/` | Excluir tipo |
| POST | `/api/admin/environment-types/{id}/deactivate/` | Desativar tipo |
| POST | `/api/admin/environment-types/{id}/activate/` | Ativar tipo |

### Risk Types
| MÃ©todo | Endpoint | DescriÃ§Ã£o |
|--------|----------|-----------|
| GET | `/api/admin/risk-types/` | Listar tipos de risco |
| POST | `/api/admin/risk-types/` | Criar tipo de risco |
| GET | `/api/admin/risk-types/{id}/` | Obter tipo especÃ­fico |
| PATCH | `/api/admin/risk-types/{id}/` | Atualizar tipo |
| DELETE | `/api/admin/risk-types/{id}/` | Excluir tipo |
| POST | `/api/admin/risk-types/{id}/deactivate/` | Desativar tipo |
| POST | `/api/admin/risk-types/{id}/activate/` | Ativar tipo |

### AI Thresholds
| MÃ©todo | Endpoint | DescriÃ§Ã£o |
|--------|----------|-----------|
| GET | `/api/admin/ai-thresholds/` | Listar thresholds |
| GET | `/api/admin/ai-thresholds/{id}/` | Obter threshold especÃ­fico |
| GET | `/api/admin/ai-thresholds/confidence/current/` | Obter threshold atual |
| PUT | `/api/admin/ai-thresholds/confidence/` | Atualizar threshold |

### Audit Logs
| MÃ©todo | Endpoint | DescriÃ§Ã£o |
|--------|----------|-----------|
| GET | `/api/admin/audit-logs/` | Listar logs de auditoria |
| GET | `/api/admin/audit-logs/{id}/` | Obter log especÃ­fico |

### Filtros
- `?include_inactive=true` - Incluir entidades inativas nas listagens
- `?entity_type=AssessmentType` - Filtrar logs por tipo de entidade
- `?action=create` - Filtrar logs por aÃ§Ã£o

## Exemplos de Uso

### Criar um tipo de avaliaÃ§Ã£o
```bash
curl -X POST http://localhost:8000/api/admin/assessment-types/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Auditoria", "description": "Auditoria completa"}'
```

### Atualizar threshold da IA
```bash
curl -X PUT http://localhost:8000/api/admin/ai-thresholds/confidence/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"threshold_value": 75.00}'
```

### Desativar um tipo
```bash
curl -X POST http://localhost:8000/api/admin/assessment-types/1/deactivate/ \
  -H "Authorization: Bearer <token>"
```

## Testes

Execute os testes com:
```bash
cd backend
python manage.py test configurations.tests
```

## DocumentaÃ§Ã£o da API

Acesse a documentaÃ§Ã£o interativa (Swagger UI) em:
```
http://localhost:8000/api/docs/
```


---

<a id="frontend-PWA"></a>
# Arquivo: frontend\PWA.md

# WorkSafety PWA

Este aplicativo Ã© um Progressive Web App (PWA) que pode ser instalado em dispositivos Android e iOS.

## Funcionalidades do PWA

- âœ… InstalaÃ§Ã£o na tela inicial (Android/iOS)
- âœ… Funcionamento offline com cache de recursos
- âœ… Splash screen personalizada no estilo da aplicaÃ§Ã£o
- âœ… Ãcones adaptÃ¡veis para diferentes dispositivos
- âœ… AtualizaÃ§Ã£o automÃ¡tica em segundo plano
- âœ… Atalhos para aÃ§Ãµes rÃ¡pidas (Nova InspeÃ§Ã£o, Dashboard)

## Como Instalar

### Android (Chrome)
1. Abra o aplicativo no Chrome
2. Toque no menu (â‹®) e selecione "Adicionar Ã  tela inicial"
3. Ou toque no banner de instalaÃ§Ã£o quando aparecer

### iOS (Safari)
1. Abra o aplicativo no Safari
2. Toque no botÃ£o Compartilhar (â–¡â†‘)
3. Role para baixo e selecione "Adicionar Ã  Tela de InÃ­cio"
4. Toque em "Adicionar"

### Desktop (Chrome/Edge)
1. Abra o aplicativo
2. Clique no Ã­cone de instalaÃ§Ã£o na barra de endereÃ§o
3. Ou use o menu (â‹®) â†’ "Instalar WorkSafety"

## Estrutura de Arquivos PWA

```
public/
â”œâ”€â”€ manifest.json          # ConfiguraÃ§Ã£o do PWA
â”œâ”€â”€ icon.svg               # Ãcone fonte SVG
â”œâ”€â”€ pwa-192x192.png        # Ãcone 192x192
â”œâ”€â”€ pwa-512x512.png        # Ãcone 512x512
â”œâ”€â”€ pwa-144x144.png        # Ãcone 144x144
â”œâ”€â”€ apple-touch-icon.png   # Ãcone para iOS
â”œâ”€â”€ favicon.ico            # Favicon
â”œâ”€â”€ mask-icon.png          # Ãcone mascarÃ¡vel
â”œâ”€â”€ screenshot-narrow.png  # Screenshot mobile
â”œâ”€â”€ screenshot-wide.png    # Screenshot desktop
â””â”€â”€ splash/                # Telas de splash iOS
    â”œâ”€â”€ iPhone_16_Pro_Max_portrait.png
    â”œâ”€â”€ iPhone_16_Pro_portrait.png
    â””â”€â”€ ...
```

## Scripts DisponÃ­veis

```bash
# Gerar Ã­cones do PWA
npm run generate-icons

# Build de produÃ§Ã£o (inclui PWA)
npm run build

# Preview do PWA apÃ³s build
npm run pwa:preview

# Limpar build
npm run clean
```

## ConfiguraÃ§Ã£o do Service Worker

O service worker Ã© gerado automaticamente pelo `vite-plugin-pwa` com as seguintes configuraÃ§Ãµes:

- **EstratÃ©gia de Cache**: Cache First para imagens, Network First para API
- **Precache**: Todos os assets da build
- **Runtime Caching**: Imagens externas e chamadas API
- **AtualizaÃ§Ã£o**: Auto-update em segundo plano

## PersonalizaÃ§Ã£o

### Cores
As cores do tema sÃ£o definidas em:
- `index.html`: `theme-color` e `background-color`
- `vite.config.ts`: manifest theme_color e background_color
- `public/manifest.json`: mesmas cores

### Splash Screen
A splash screen Ã© controlada pelo componente `SplashScreen.tsx`:
- Local: `src/features/splash/SplashScreen.tsx`
- DuraÃ§Ã£o: 3 segundos (configurÃ¡vel via prop `duration`)
- Mostrada apenas uma vez por sessÃ£o

### Ãcones
Para regenerar os Ã­cones apÃ³s alteraÃ§Ãµes no SVG:
```bash
npm run generate-icons
```

## Teste do PWA

Para testar as funcionalidades do PWA localmente:

1. FaÃ§a o build: `npm run build`
2. Inicie o preview: `npm run preview`
3. Use as DevTools do Chrome â†’ Application â†’ Service Workers
4. Teste o modo offline nas DevTools

## Requisitos para PublicaÃ§Ã£o

Para que o PWA funcione corretamente em produÃ§Ã£o:

1. Servir em HTTPS (obrigatÃ³rio para PWA)
2. Configurar CORS adequadamente
3. O service worker precisa estar no root do domÃ­nio
4. O manifest.json deve ser acessÃ­vel

## Suporte a Navegadores

| Navegador | InstalaÃ§Ã£o | Offline | NotificaÃ§Ãµes |
|-----------|------------|---------|--------------|
| Chrome    | âœ…         | âœ…      | âœ…           |
| Safari    | âœ… (iOS)   | âœ…      | âŒ           |
| Edge      | âœ…         | âœ…      | âœ…           |
| Firefox   | âœ…         | âœ…      | âš ï¸           |
| Samsung   | âœ…         | âœ…      | âœ…           |

## Recursos Adicionais

- [MDN PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)


---

<a id="frontend-README"></a>
# Arquivo: frontend\README.md

# WorkSafety Mobile App (Frontend)

## Overview
This is the mobile frontend for the WorkSafety application, built with React, Vite, and Tailwind CSS. It focuses on providing a secure and efficient interface for safety inspectors and managers.

## Features (Sprint 1)
- **Authentication**: Login, Forgot Password, Reset Password.
- **Session Management**: Secure token storage, "Keep me signed in", Auto-logout on expiry.
- **Dashboard**: Home screen with inspection status.
- **Admin**: Basic User Management (List/Search).

## Tech Stack
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Routing**: React Router DOM
- **HTTP Client**: Axios
- **Icons**: Lucide React
- **Security**: Crypto-JS (for client-side storage encryption)

## Setup & Run

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Environment Setup**
    Copy `.env.example` to `.env` (optional, defaults are provided in code for dev).
    ```bash
    cp .env.example .env
    ```

3.  **Run Development Server**
    ```bash
    npm run dev
    ```
    Access at `http://localhost:3000` (or port assigned by AI Studio).

## Mock API
The application currently uses a mock implementation in `src/services/auth/authService.ts` and `src/services/user/userService.ts` when running in development mode (`import.meta.env.DEV`).

**Test Credentials:**
- **Email**: `user@worksafety.gov`
- **Password**: `password`

## Project Structure
- `src/app`: App configuration (Router).
- `src/features`: Feature-based modules (Auth, Dashboard, Admin).
- `src/services`: API clients and business logic services.
- `src/store`: Global state management (Zustand).
- `src/ui`: Reusable UI components and layouts.
- `src/utils`: Helper functions.

## Security
See `SECURITY.md` for details on security measures implemented.


---

<a id="frontend-SECURITY"></a>
# Arquivo: frontend\SECURITY.md

# Security Checklist - Frontend Sprint 1

## Authentication & Session Management
- [x] **Secure Storage**: Tokens (JWT/Refresh) are stored using `SecureStorage` (encrypted wrapper around localStorage/sessionStorage) to prevent plain-text exposure.
- [x] **Session Persistence**: "Keep me signed in" flag determines storage mechanism (localStorage vs sessionStorage).
- [x] **Auto-Logout**: 401 Unauthorized responses trigger immediate session cleanup and redirect to login.
- [x] **Route Protection**: `ProtectedRoute` component guards private routes against unauthenticated access.
- [x] **Logout**: Explicit logout clears all storage and redirects to login.

## Data Protection
- [x] **No Sensitive Logs**: Passwords and tokens are not logged to the console.
- [x] **HTTPS**: Application is configured to run over HTTPS in production (enforced by infrastructure/Vite config).
- [x] **Input Validation**: Basic client-side validation prevents empty submissions.

## API Security
- [x] **Interceptors**: Auth tokens are automatically attached to requests via Axios interceptors.
- [x] **Environment Variables**: API URLs are configured via `.env` files, not hardcoded.

## Future Improvements (Sprint 2+)
- [ ] Implement HttpOnly cookies for token storage (requires backend support).
- [ ] Add CSRF protection (if using cookies).
- [ ] Implement comprehensive input sanitization.
- [ ] Add Rate Limiting handling on UI (429 responses).


---

<a id="frontend-docs-RISK_INTEGRATION"></a>
# Arquivo: frontend\docs\RISK_INTEGRATION.md

# IntegraÃ§Ã£o da Tela de Riscos com Backend

DocumentaÃ§Ã£o da integraÃ§Ã£o entre a tela `RisksDetected` e a API backend.

## SumÃ¡rio

- [VisÃ£o Geral](#visÃ£o-geral)
- [Arquitetura](#arquitetura)
- [Tipos TypeScript](#tipos-typescript)
- [ServiÃ§o de API](#serviÃ§o-de-api)
- [Hook de Estado](#hook-de-estado)
- [Tela RisksDetected](#tela-risksdetected)
- [Estados da Tela](#estados-da-tela)
- [IntegraÃ§Ã£o com Ciclo de Vida](#integraÃ§Ã£o-com-ciclo-de-vida)
- [Testes](#testes)

---

## VisÃ£o Geral

A tela de riscos foi integrada com o backend para exibir dados reais da avaliaÃ§Ã£o, incluindo:

- Lista de riscos detectados pela IA
- EvidÃªncias (fotos) associadas a cada risco
- RecomendaÃ§Ãµes de seguranÃ§a
- Score de compliance
- Status do ciclo de vida da avaliaÃ§Ã£o

### Arquivos Criados/Modificados

```
frontend/src/
â”œâ”€â”€ types/risk.ts                          # Tipos TypeScript
â”œâ”€â”€ services/risk/
â”‚   â”œâ”€â”€ riskService.ts                     # ServiÃ§o de API
â”‚   â””â”€â”€ index.ts                           # Exports
â”œâ”€â”€ hooks/risk/
â”‚   â”œâ”€â”€ useRiskAssessment.ts               # Hook de estado
â”‚   â””â”€â”€ index.ts                           # Exports
â”œâ”€â”€ features/inspection/
â”‚   â””â”€â”€ RisksDetected.tsx                  # Tela atualizada
â””â”€â”€ __tests__/risk/
    â”œâ”€â”€ mockAxios.ts                       # Mock do axios
    â”œâ”€â”€ riskService.test.ts                # Testes do serviÃ§o
    â””â”€â”€ useRiskAssessment.test.ts          # Testes do hook

backend/assessments/
â”œâ”€â”€ serializers.py                         # Atualizado
â”œâ”€â”€ views.py                               # Atualizado
â”œâ”€â”€ urls.py                                # Atualizado
â”œâ”€â”€ models.py                              # Atualizado (RiskFinding)
â””â”€â”€ migrations/
    â””â”€â”€ 0010_riskfinding_evidence_riskfinding_location.py
```

---

## Arquitetura

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚   RisksDetected â”‚â”€â”€â”€â”€â–¶â”‚ useRiskAssessmentâ”‚â”€â”€â”€â”€â–¶â”‚  riskService   â”‚
â”‚    (UI Layer)   â”‚â—„â”€â”€â”€â”€â”‚  (State Layer)  â”‚â—„â”€â”€â”€â”€â”‚  (API Layer)   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                                        â”‚
                              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                              â–¼
                        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                        â”‚  /assessments/:id
                        â”‚  (Django API)
                        â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## Tipos TypeScript

### Principais Interfaces

```typescript
// RiskItem - Risco detectado
interface RiskItem {
  id: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  location: string;
  evidence: EvidenceRef | null;
  recommendations: Recommendation[];
  ai_confidence: string;
  risk_status: 'pending' | 'ai_detected' | 'validated' | 'rejected';
  created_at: string;
  updated_at: string;
}

// EvidenceRef - ReferÃªncia a evidÃªncia
interface EvidenceRef {
  id: string;
  thumbnail_url: string;
  captured_at: string | null;
}

// Recommendation - RecomendaÃ§Ã£o de seguranÃ§a
interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

// RiskAssessmentDetail - Detalhes completos
interface RiskAssessmentDetail {
  id: string;
  title: string;
  status: AssessmentStatus;
  risks: RiskItem[];
  evidences: Evidence[];
  compliance_score: number;
  // ... outros campos
}
```

---

## ServiÃ§o de API

### FunÃ§Ãµes DisponÃ­veis

```typescript
// Buscar avaliaÃ§Ã£o por ID
getAssessmentById(assessmentId: string): Promise<RiskAssessmentDetail>

// Listar avaliaÃ§Ãµes
listAssessments(): Promise<RiskAssessmentSummary[]>

// TransiÃ§Ãµes de ciclo de vida
humanValidateAssessment(id: string, reason?: string): Promise<...>
markAIReviewed(id: string, reason?: string): Promise<...>
finalizeAssessment(id: string, reason?: string): Promise<...>
```

### Tratamento de Erros

O serviÃ§o lanÃ§a `RiskServiceError` com cÃ³digos especÃ­ficos:

- `NOT_FOUND` - AvaliaÃ§Ã£o nÃ£o existe (404)
- `FORBIDDEN` - Acesso negado (403)
- `NETWORK_ERROR` - Erro de rede
- `TRANSITION_ERROR` - TransiÃ§Ã£o invÃ¡lida

---

## Hook de Estado

### useRiskAssessment

```typescript
const {
  // Estado
  screenState,        // 'loading' | 'error' | 'empty' | 'data'
  assessment,         // RiskAssessmentDetail | null
  filteredRisks,      // RiskItem[]
  riskCounts,         // Record<string, number>
  
  // Filtros
  filters,            // RiskFilters
  setFilters,         // (filters) => void
  sortOption,         // RiskSortOption
  setSortOption,      // (option) => void
  
  // AÃ§Ãµes
  fetchAssessment,    // () => Promise<void>
  refresh,            // () => Promise<void>
  validateAssessment, // (reason?) => Promise<void>
  
  // Estados
  isValidating,       // boolean
  validationError,    // string | null
} = useRiskAssessment(assessmentId, {
  autoFetch: true,
  refreshInterval: 30000,
});
```

---

## Tela RisksDetected

### Estados da Tela

A tela possui 4 estados principais:

1. **Loading** - Carregando dados da avaliaÃ§Ã£o
   ```
   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   â”‚     â†» Loading...            â”‚
   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
   ```

2. **Error** - Erro ao carregar
   ```
   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   â”‚     âš  Error loading         â”‚
   â”‚     [Try again]             â”‚
   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
   ```

3. **Empty** - Nenhum risco detectado
   ```
   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   â”‚     âœ“ No risks detected     â”‚
   â”‚     Great news!             â”‚
   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
   ```

4. **Data** - Lista de riscos
   ```
   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   â”‚  Total: 03  |  Compliance 75%â”‚
   â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
   â”‚  â˜ Missing Guardrail        â”‚
   â”‚     ðŸ“ Platform L2          â”‚
   â”‚     [CRITICAL]              â”‚
   â”‚     [ðŸ–¼ï¸] Immediate Action   â”‚
   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
   ```

### Funcionalidades

- **Filtros por severidade**: CRITICAL, HIGH, MEDIUM, LOW
- **Busca por texto**: descriÃ§Ã£o ou localizaÃ§Ã£o
- **OrdenaÃ§Ã£o**: por severidade ou data
- **Miniaturas de evidÃªncias**: clicÃ¡veis para visualizaÃ§Ã£o
- **Expandir recomendaÃ§Ãµes**: mostrar/ocultar detalhes

---

## IntegraÃ§Ã£o com Ciclo de Vida

### Status da AvaliaÃ§Ã£o

| Status | Badge | AÃ§Ãµes DisponÃ­veis |
|--------|-------|-------------------|
| draft | Cinza | - |
| captured | Azul | - |
| synced | Roxo | - |
| ai_reviewed | Teal | Validar, Rejeitar |
| human_validated | Verde | Confirmar |
| finalized | Preto | - |
| error | Vermelho | Retry |

### BotÃµes de AÃ§Ã£o

```typescript
// Status = ai_reviewed
<Button>Reject</Button>  <Button>Validate</Button>

// Status = human_validated  
<Button>Reject</Button>  <Button disabled>Confirm</Button>
```

---

## Testes

### Executando Testes

```bash
# Testes manuais (console)
# Abra o console do navegador apÃ³s importar os mÃ³dulos

# Testes com Jest
npm test -- risk/
```

### Cobertura de Testes

| Componente | Testes |
|------------|--------|
| riskService | fetch, erro 404/403, network, helpers |
| useRiskAssessment | estados, filtros, ordenaÃ§Ã£o, aÃ§Ãµes |
| mockAxios | handlers, reset, delays |

### Exemplo de Teste

```typescript
it('deve filtrar por severidade', async () => {
  const { result } = renderHook(() => useRiskAssessment('123'));
  
  await waitFor(() => {
    expect(result.current.screenState.type).toBe('data');
  });
  
  act(() => {
    result.current.setFilters({ severity: ['CRITICAL'] });
  });
  
  expect(result.current.filteredRisks).toHaveLength(1);
  expect(result.current.filteredRisks[0].severity).toBe('CRITICAL');
});
```

---

## API Backend

### Endpoints

| MÃ©todo | Endpoint | DescriÃ§Ã£o |
|--------|----------|-----------|
| GET | `/assessments/` | Lista avaliaÃ§Ãµes |
| GET | `/assessments/:id/` | Detalhes da avaliaÃ§Ã£o |
| POST | `/assessments/:id/human-validate/` | Validar por humano |
| POST | `/assessments/:id/mark-ai-reviewed/` | Marcar revisado por IA |
| POST | `/assessments/:id/finalize/` | Finalizar avaliaÃ§Ã£o |

### Exemplo de Resposta

```json
{
  "id": "123",
  "title": "Construction Site Inspection",
  "status": "ai_reviewed",
  "risks": [
    {
      "id": "1",
      "description": "Missing Guardrail",
      "severity": "CRITICAL",
      "location": "Platform L2",
      "evidence": {
        "id": "1",
        "thumbnail_url": "/media/evidence/2026/03/1_test.jpg"
      },
      "recommendations": [
        {
          "id": "1",
          "title": "Immediate Action Required",
          "description": "Address immediately",
          "priority": "critical"
        }
      ],
      "ai_confidence": "95%",
      "risk_status": "ai_detected"
    }
  ],
  "compliance_score": 75,
  "valid_transitions": [
    {"value": "human_validated", "label": "Validado por Humano"}
  ]
}
```

---

## Checklist de Aceite

- [x] Tipos TypeScript definidos (`RiskItem`, `Recommendation`, `EvidenceRef`)
- [x] ServiÃ§o API criado (`/assessments/:id`)
- [x] Tela com loading, empty, error states
- [x] Lista de riscos renderizada com dados reais
- [x] Miniaturas de evidÃªncias linkadas
- [x] IntegraÃ§Ã£o com ciclo de vida (status)
- [x] BotÃµes de aÃ§Ã£o condicionais ao status
- [x] Filtros e ordenaÃ§Ã£o funcionais
- [x] Testes unitÃ¡rios com mock do axios
- [x] Tratamento de erros robusto

---

## PrÃ³ximos Passos

1. **IntegraÃ§Ã£o com sync**: Atualizar `Syncing.tsx` para passar `assessmentId` via navigation state
2. **Modal de evidÃªncia**: Criar visualizaÃ§Ã£o em tela cheia das fotos
3. **Cache**: Implementar cache local dos dados da avaliaÃ§Ã£o
4. **Offline**: Suporte para visualizaÃ§Ã£o offline apÃ³s primeiro carregamento


---

<a id="frontend-docs-SYNC_SYSTEM"></a>
# Arquivo: frontend\docs\SYNC_SYSTEM.md

# Sistema de Fila de SincronizaÃ§Ã£o - WorkSafety

## VisÃ£o Geral

Sistema robusto de fila local com reenvio automÃ¡tico para garantir tolerÃ¢ncia a falhas de rede no aplicativo WorkSafety.

### CaracterÃ­sticas Principais

- âœ… **PersistÃªncia durÃ¡vel**: IndexedDB via `idb-keyval`
- âœ… **Retry automÃ¡tico**: AtÃ© 3 tentativas com backoff exponencial
- âœ… **Jitter**: PrevenÃ§Ã£o de thundering herd
- âœ… **Worker em background**: SincronizaÃ§Ã£o contÃ­nua mesmo com app em background
- âœ… **Retry manual**: UsuÃ¡rio pode forÃ§ar retry imediato
- âœ… **Dashboard UI**: VisualizaÃ§Ã£o de jobs pendentes/falhos
- âœ… **MigraÃ§Ã£o de dados**: Migra inspeÃ§Ãµes legadas automaticamente

## Arquitetura

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚   Components    â”‚â”€â”€â”€â”€â–¶â”‚    SyncStore     â”‚â”€â”€â”€â”€â–¶â”‚  SyncStorage    â”‚
â”‚  (UI/Buttons)   â”‚     â”‚   (Zustand)      â”‚     â”‚  (IndexedDB)    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                               â”‚
                               â–¼
                       â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                       â”‚   SyncWorker     â”‚
                       â”‚  (Background)    â”‚
                       â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                               â”‚
                               â–¼
                       â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                       â”‚      API         â”‚
                       â”‚   (Backend)      â”‚
                       â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

## Estrutura de Arquivos

```
src/
â”œâ”€â”€ types/
â”‚   â””â”€â”€ sync.ts              # Tipos e interfaces
â”œâ”€â”€ store/
â”‚   â””â”€â”€ syncStore.ts         # Store Zustand
â”œâ”€â”€ services/sync/
â”‚   â”œâ”€â”€ syncStorage.ts       # PersistÃªncia IndexedDB
â”‚   â””â”€â”€ syncWorker.ts        # LÃ³gica de sincronizaÃ§Ã£o
â”œâ”€â”€ hooks/sync/
â”‚   â”œâ”€â”€ useSyncQueue.ts      # Hook para dashboard
â”‚   â””â”€â”€ useSyncStatus.ts     # Hook leve para status
â”œâ”€â”€ utils/
â”‚   â””â”€â”€ syncUtils.ts         # UtilitÃ¡rios (backoff, etc)
â”œâ”€â”€ features/sync/
â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”œâ”€â”€ SyncStatusBadge.tsx    # Badge no header
â”‚   â”‚   â”œâ”€â”€ SyncJobItem.tsx        # Item da lista
â”‚   â”‚   â””â”€â”€ SyncQueueDashboard.tsx # Dashboard completo
â”‚   â””â”€â”€ pages/
â”‚       â””â”€â”€ SyncQueuePage.tsx      # PÃ¡gina /sync-queue
â””â”€â”€ __tests__/sync/
    â”œâ”€â”€ syncUtils.test.ts    # Testes de utilitÃ¡rios
    â”œâ”€â”€ syncStorage.test.ts  # Testes de storage
    â””â”€â”€ backoff.test.ts      # Testes de backoff
```

## Modelo de Dados

### SyncJob

```typescript
interface SyncJob {
  id: string;                    // UUID local
  assessmentDraft: {
    title: string;
    description: string;
    environment: string;
    category: string;
    status: 'draft' | 'pending' | 'completed';
  };
  photos: PhotoData[];           // Array de fotos
  status: 'PENDING' | 'SYNCING' | 'COMPLETED' | 'FAILED' | 'ERROR';
  retryCount: number;            // 0-3
  maxRetries: number;            // padrÃ£o: 3
  nextRetryAt: number | null;    // Timestamp para prÃ³ximo retry
  lastError: string | null;      // Ãšltimo erro
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  assessmentId?: string;         // ID do backend
}
```

## Backoff Exponencial + Jitter

### FÃ³rmula

```
delay = min(base * (2 ^ retryCount) + jitter, maxDelay)

onde:
- base = 2000ms (2 segundos)
- maxDelay = 60000ms (1 minuto)
- jitter = random(0, 1000)ms
```

### Exemplo

| Retry | Base | Expo | Jitter | Total | Quando |
|-------|------|------|--------|-------|--------|
| 1Âª | 2000ms | 2000ms | 0-1000ms | ~2.5s | Imediato |
| 2Âª | 2000ms | 4000ms | 0-1000ms | ~4.5s | ~4s apÃ³s 1Âª |
| 3Âª | 2000ms | 8000ms | 0-1000ms | ~8.5s | ~8s apÃ³s 2Âª |

## Fluxo de Uso

### 1. Criar Nova InspeÃ§Ã£o

```typescript
// ReviewPhotos.tsx
const { addJob } = useSyncStore();

await addJob(
  {
    title: `Inspection - ${environment} - ${category}`,
    description: `Automated inspection...`,
    environment,
    category,
    status: 'draft',
  },
  photos
);
```

### 2. Monitorar Status

```typescript
// Dashboard ou componente
const { jobs, pendingCount, failedCount, isProcessing } = useSyncQueue();
```

### 3. Retry Manual

```typescript
const { retryJob } = useSyncQueue();
await retryJob(jobId);
```

## Eventos do Worker

O `SyncWorker` dispara callbacks em eventos importantes:

```typescript
syncWorker.on({
  onJobStarted: (jobId) => {},
  onJobCompleted: (jobId) => {},
  onJobFailed: (jobId, error) => {},
  onJobError: (jobId, error) => {}, // Max retries
  onSyncStarted: () => {},
  onSyncCompleted: () => {},
});
```

## ConfiguraÃ§Ãµes

```typescript
// src/types/sync.ts
export const SYNC_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY_MS: 2000,
  MAX_DELAY_MS: 60000,
  BACKOFF_MULTIPLIER: 2,
  JITTER_MAX_MS: 1000,
  SYNC_INTERVAL_MS: 30000,        // 30s
  VISIBILITY_SYNC_DELAY_MS: 1000, // 1s
};
```

## Testes

### Executar testes de backoff

```bash
npx tsx src/__tests__/sync/backoff.test.ts
```

### Executar testes de utilitÃ¡rios

```bash
npx tsx src/__tests__/sync/syncUtils.test.ts
```

### Testes de integraÃ§Ã£o (requer fake-indexeddb)

```bash
# Instalar dependÃªncia de teste
npm install -D fake-indexeddb vitest

# Configurar vitest.config.ts
# Rodar testes
npx vitest
```

## MigraÃ§Ã£o de Dados Legadas

O sistema detecta automaticamente inspeÃ§Ãµes antigas no formato legado (`inspection-storage`) e migra para a nova fila na inicializaÃ§Ã£o.

## CenÃ¡rios de Uso

### CenÃ¡rio 1: Offline Completo
1. UsuÃ¡rio captura fotos offline
2. Job Ã© criado com status PENDING
3. Worker detecta offline e aguarda
4. Quando online, sincroniza automaticamente

### CenÃ¡rio 2: Falha Intermitente
1. Job falha na 1Âª tentativa (rede instÃ¡vel)
2. Status muda para FAILED, retryCount = 1
3. nextRetryAt calculado com backoff (~2s + jitter)
4. Worker tenta novamente quando nextRetryAt <= now
5. Processo repete atÃ© sucesso ou max retries

### CenÃ¡rio 3: App Fechado/Reaberto
1. Job salvo no IndexedDB
2. UsuÃ¡rio fecha o app
3. Ao reabrir, SyncStore Ã© inicializado
4. MigraÃ§Ã£o roda se necessÃ¡rio
5. Worker inicia e processa jobs pendentes

### CenÃ¡rio 4: Retry Manual
1. Job atinge max retries (status ERROR)
2. UsuÃ¡rio vÃª no dashboard
3. Clica "Tentar novamente"
4. Status reseta para PENDING
5. Worker processa imediatamente

## Troubleshooting

### Jobs nÃ£o aparecem no dashboard
- Verificar se `useSyncStore().initialize()` foi chamado no App.tsx
- Verificar console por erros de IndexedDB

### SincronizaÃ§Ã£o nÃ£o inicia
- Verificar se estÃ¡ online (`navigator.onLine`)
- Verificar se Worker estÃ¡ rodando (`syncWorker.getStatus()`)

### Fotos duplicadas
- Verificar se assessmentId estÃ¡ sendo salvo apÃ³s criaÃ§Ã£o
- Isso evita recriar assessment em retry

## Roadmap Futuro

- [ ] CompressÃ£o de imagens antes do upload
- [ ] Upload progressivo (chunked upload)
- [ ] Background sync API (Service Worker)
- [ ] NotificaÃ§Ãµes push para jobs completados
- [ ] SincronizaÃ§Ã£o multi-dispositivo


---


