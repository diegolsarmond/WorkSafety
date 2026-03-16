# Pipeline Assíncrono de IA - Instruções de Execução

Este documento descreve como executar o pipeline assíncrono de processamento de IA do WorkSafety.

## Arquitetura

```
┌─────────────┐     ┌─────────┐     ┌─────────────┐
│   Django    │────▶│  Redis  │◀────│   Worker    │
│   Backend   │     │  Queue  │     │   Celery    │
└─────────────┘     └─────────┘     └─────────────┘
       │                                    │
       │                                    │
       ▼                                    ▼
┌─────────────┐                     ┌─────────────┐
│ PostgreSQL  │                     │  AI Service │
│   (dados)   │                     │  (Mock/Real)│
└─────────────┘                     └─────────────┘
```

## Execução com Docker Compose (Recomendado)

### 1. Configurar Ambiente

```bash
# Copiar arquivo de exemplo
cp backend/.env.example backend/.env

# Editar se necessário (valores padrão funcionam para docker-compose)
```

### 2. Subir Todos os Serviços

```bash
cd infra
docker compose up -d
```

Isso inicia:
- **PostgreSQL** (porta 5432)
- **Redis** (porta 6379)
- **Backend Django** (porta 8000)
- **Worker Celery** (processamento assíncrono)

### 3. Aplicar Migrações

```bash
docker compose exec backend python manage.py migrate
```

### 4. Criar Superusuário

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

## Execução Local (Sem Docker)

### Pré-requisitos

- Python 3.12+
- PostgreSQL
- Redis

### 1. Instalar Dependências

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

### 4. Aplicar Migrações

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

### 1. Criar Avaliação

```bash
curl -X POST http://localhost:8000/api/v1/assessments/ \
  -H "Authorization: Bearer <seu_token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Avaliação de Teste", "description": "Teste do pipeline de IA"}'
```

### 2. Fazer Upload de Evidências

```bash
curl -X POST http://localhost:8000/api/v1/assessments/1/evidences/ \
  -H "Authorization: Bearer <seu_token>" \
  -F "images=@foto1.jpg" \
  -F "images=@foto2.jpg"
```

### 3. Capturar Avaliação

```bash
curl -X POST http://localhost:8000/api/v1/assessments/1/capture/ \
  -H "Authorization: Bearer <seu_token>"
```

### 4. Sincronizar (Dispara Processamento Automático)

```bash
curl -X POST http://localhost:8000/api/v1/assessments/1/sync/ \
  -H "Authorization: Bearer <seu_token>"
```

Após este passo, o processamento de IA é enfileirado automaticamente!

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
  "status_display": "Em execução",
  "started_at": "2026-03-12T18:30:00Z",
  ...
}
```

Resposta esperada após sucesso:
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

### 6. Reprocessar (se necessário)

Se o processamento falhar (status=error):

```bash
curl -X POST http://localhost:8000/api/v1/assessments/1/reprocess/ \
  -H "Authorization: Bearer <seu_token>"
```

## Endpoints de IA

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/assessments/<id>/process-ai/` | POST | Força processamento de IA |
| `/assessments/<id>/reprocess/` | POST | Reprocessa avaliação em erro |
| `/assessments/<id>/ai-status/` | GET | Consulta status do processamento |

## Configuração do Cliente de IA

O cliente de IA pode operar em três modos:

### Modo Mock (Desenvolvimento/Testes)

```env
AI_SERVICE_MOCK_MODE=true
AI_SERVICE_ENABLED=true
```

Neste modo, o serviço de IA é simulado, retornando resultados fictícios baseados nas evidências.

### Modo Olímpia - API Dataprev (Produção)

Edite o arquivo `backend/.env`:

```env
AI_SERVICE_MOCK_MODE=false
AI_SERVICE_ENABLED=true

# Configuração da API Olímpia
OLIMPIA_API_ENABLED=true
OLIMPIA_API_TOKEN=seu_token_aqui
# OLIMPIA_API_URL=https://api.olimpia.suia.dataprev.gov.br/v2/seguranca-por-imagem/infer
# OLIMPIA_API_TIMEOUT=60
# OLIMPIA_API_LANGUAGE=en_us
# OLIMPIA_MIN_CONFIDENCE=0.70

# Processamento de imagens
SAFETY_IMAGE_DRAW_BOUNDING_BOXES=true
```

Este modo utiliza a API Olímpia da Dataprev para análise real de segurança por imagem, detectando:
- Uso inadequado de EPI
- Trabalho em altura sem proteção
- Proximidade com máquinas perigosas
- Escavações sem sinalização
- Riscos elétricos
- Espaços confinados

### Modo AI Genérico (Futuro)

```env
AI_SERVICE_MOCK_MODE=false
AI_SERVICE_ENABLED=true
AI_SERVICE_BASE_URL=https://ai-service.seu-dominio.com
AI_SERVICE_API_KEY=sua-api-key
AI_SERVICE_TIMEOUT=30
```

**Nota:** O cliente genérico (`AIClient`) pode ser implementado para outros provedores de IA.

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

### Worker não está processando tasks

1. Verifique se o worker está rodando:
   ```bash
   docker compose ps
   ```

2. Verifique logs do worker:
   ```bash
   docker compose logs -f worker
   ```

3. Verifique conexão com Redis:
   ```bash
   docker compose exec redis redis-cli ping
   # Deve retornar: PONG
   ```

### Tasks estão presas em "running"

Use a task de limpeza:

```bash
docker compose exec backend python manage.py shell -c "
from assessments.tasks import cleanup_stalled_processes
cleanup_stalled_processes()
"
```

### Migrações pendentes

```bash
docker compose exec backend python manage.py migrate
```

## Monitoramento

### Flower (Dashboard Celery) - Opcional

Para monitorar tasks em tempo real, descomente o serviço `flower` no `docker-compose.yml` e acesse:

```
http://localhost:5555
```

## Estrutura de Arquivos

```
backend/
├── assessments/
│   ├── ai_client.py          # Interface e implementações do cliente IA (inclui OlimpiaAIClient)
│   ├── olimpia_service.py    # Serviço de integração com API Olímpia
│   ├── image_processor.py    # Processamento de imagens com bounding boxes
│   ├── tasks.py              # Tasks Celery
│   ├── models.py             # Modelos (AIInferenceResult, OlimpiaDetectionResult)
│   ├── views.py              # Endpoints de IA
│   ├── urls.py               # Rotas de IA
│   └── tests/
│       └── test_ai_pipeline.py  # Testes
├── config/
│   ├── celery.py             # Configuração Celery
│   └── settings/
│       └── base.py           # Configurações de IA (OLIMPIA_API_*)
└── requirements.txt          # Dependências (celery, redis, requests)

infra/
└── docker-compose.yml        # Redis e Worker adicionados
```
