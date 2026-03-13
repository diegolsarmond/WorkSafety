# Correção do Fluxo de Processamento de IA

## 🐛 Problema Identificado

As imagens estavam sendo enviadas mas **nenhum risco era detectado** porque o fluxo de processamento de IA nunca era iniciado.

### Causa Raiz
O frontend estava:
1. ✅ Criando assessment (status: `draft`)
2. ✅ Fazendo upload das fotos
3. ❌ **Nunca transicionando para `SYNCED`** (que dispara a IA)

O backend só processa a IA quando o assessment está no status `SYNCED`:
```python
# tasks.py
if assessment.status not in [RiskAssessment.STATUS_SYNCED, RiskAssessment.STATUS_ERROR_AI]:
    return {"status": "skipped", "message": f"Invalid status: {assessment.status}"}
```

---

## ✅ Solução Implementada

### 1. Frontend - syncWorker.ts
Adicionadas chamadas aos endpoints de transição após o upload:

```typescript
// Passo 3: Transicionar para CAPTURED
await apiClient.post(`/assessments/${assessmentId}/capture/`, {});

// Passo 4: Transicionar para SYNCED (dispara processamento de IA)
await apiClient.post(`/assessments/${assessmentId}/sync/`, {});
```

### 2. Frontend - useRiskAssessment.ts
Adicionados estados de processamento:
- Detecta quando assessment está em `synced` (IA processando)
- Mostra mensagem "AI is analyzing the images..."
- Polling mais frequente (5s) quando processando
- Detecta erro de IA (`error_ai`)

### 3. Frontend - RisksDetected.tsx
Adicionada tela de "AI Analysis in Progress" com indicador visual.

### 4. Backend - .env
Adicionadas configurações do Celery e AI Service:
```bash
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

AI_SERVICE_ENABLED=true
AI_SERVICE_MOCK_MODE=true
AI_SERVICE_TIMEOUT=30
```

---

## 🚀 Como Executar o Sistema Completo

### Pré-requisitos
1. **Redis** rodando (para o Celery)
2. **PostgreSQL** rodando
3. **Backend** Django
4. **Worker Celery** (processamento assíncrono)
5. **Frontend** React

### Passo a Passo

#### 1. Iniciar Redis
```bash
# Usando Docker
docker run -d -p 6379:6379 redis:alpine

# Ou instalação local
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

# Instalar dependências
pip install -r requirements.txt

# Aplicar migrações
python manage.py migrate

# Criar superusuário (opcional)
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

## 📊 Fluxo Completo Atualizado

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   FRONTEND      │     │    BACKEND      │     │  CELERY WORKER  │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  1. POST /assessments │                       │
         │──────────────────────>│                       │
         │  (cria assessment)    │                       │
         │                       │                       │
         │  2. POST /evidences   │                       │
         │──────────────────────>│                       │
         │  (upload fotos)       │                       │
         │                       │                       │
         │  3. POST /capture     │                       │
         │──────────────────────>│                       │
         │  (status: CAPTURED)   │                       │
         │                       │                       │
         │  4. POST /sync        │                       │
         │──────────────────────>│                       │
         │  (status: SYNCED)     │                       │
         │                       │  5. Dispara task      │
         │                       │──────────────────────>│
         │                       │                       │
         │                       │                       │ 6. MockAIClient
         │                       │                       │    processa imagens
         │                       │                       │
         │                       │  7. Cria RiskFindings │
         │                       │<──────────────────────│
         │                       │                       │
         │                       │  8. Transiciona para  │
         │                       │     AI_REVIEWED       │
         │                       │                       │
         │  9. GET /:id (poll)   │                       │
         │<──────────────────────│                       │
         │  (status: ai_reviewed)│                       │
         │                       │                       │
         ▼                       ▼                       ▼
```

---

## 🧪 Testando o Fluxo

### Verificar se o Worker está rodando:
```bash
# No terminal do Celery, você deve ver:
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

## ⚙️ Configurações

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
  refreshInterval: 30000, // 30s quando não processando
  // Quando processando IA: 5s (automático)
});
```

---

## 🐛 Troubleshooting

### "AI processing failed" na tela
- Verificar se Celery worker está rodando
- Verificar logs do Celery para erros
- Verificar se Redis está acessível

### "No risks detected" (mas deveria ter)
- Verificar se assessment chegou em `ai_reviewed`
- Verificar logs do Celery: quantos riscos foram detectados?
- Verificar se `AI_SERVICE_MOCK_MODE=true` (para testes)

### Job fica "SYNCING" eternamente
- Verificar se backend está respondendo
- Verificar console do navegador para erros de rede
- Verificar se o assessment foi criado no backend

### Erro 500 no sync
- Verificar logs do Django
- Verificar se o usuário está autenticado
- Verificar se o assessment existe

---

## 📁 Arquivos Modificados

- `frontend/src/services/sync/syncWorker.ts` - Adicionado capture e sync
- `frontend/src/hooks/risk/useRiskAssessment.ts` - Estados de processamento
- `frontend/src/features/inspection/RisksDetected.tsx` - Tela de loading da IA
- `frontend/src/types/risk.ts` - Adicionado status `error_ai`
- `backend/.env` - Configurações do Celery e AI
