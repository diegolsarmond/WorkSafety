# Integração com API Olímpia (Dataprev)

Documentação da integração do WorkSafety com a API Olímpia para análise de segurança por imagem.

## 📋 Visão Geral

A integração permite análise automática de imagens de inspeções utilizando a API Olímpia da Dataprev, detectando violações de segurança ocupacional com bounding boxes e classificações de risco.

## 🔗 Endpoint

```
POST https://api.olimpia.suia.dataprev.gov.br/v2/seguranca-por-imagem/infer?lang=en_us
```

## 🔐 Autenticação

Autenticação via Bearer Token no header:
```
Authorization: Bearer <TOKEN_OLIMPIA>
```

## ⚙️ Configuração

Todas as configurações da API Olímpia estão centralizadas no arquivo `backend/.env`.

### Para Desenvolvimento/Testes (Mock)

```bash
# No arquivo backend/.env
AI_SERVICE_MOCK_MODE=true
OLIMPIA_API_ENABLED=false
```

### Para Produção (API Real)

```bash
# No arquivo backend/.env
AI_SERVICE_MOCK_MODE=false
OLIMPIA_API_ENABLED=true
OLIMPIA_API_TOKEN=seu_token_aqui

# Opcionais (valores padrão são usados se não informados)
# OLIMPIA_API_URL=https://api.olimpia.suia.dataprev.gov.br/v2/seguranca-por-imagem/infer
# OLIMPIA_API_TIMEOUT=60
# OLIMPIA_API_LANGUAGE=en_us
# OLIMPIA_MIN_CONFIDENCE=0.70
# SAFETY_IMAGE_DRAW_BOUNDING_BOXES=true
```

## 📦 Estrutura da Resposta

A API retorna violações organizadas por regras:

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

## 🏷️ Mapeamento de Regras

| Regra | Nome | Categoria | Severidade |
|-------|------|-----------|------------|
| rule_1_violation | Uso de EPI | EPI | HIGH |
| rule_2_violation | Trabalho em Altura | QUEDA | CRITICAL |
| rule_3_violation | Abertura de Valas | ESCAVACAO | HIGH |
| rule_4_violation | Proximidade com Máquinas | MAQUINARIO | CRITICAL |
| rule_5_violation | Espaço Confinado | ESPACO_CONFINADO | CRITICAL |
| rule_6_violation | Proteção Elétrica | ELETRICO | HIGH |

## 🖼️ Processamento de Imagens

As imagens são processadas automaticamente com:

1. **Detecção de violações** via API Olímpia
2. **Bounding boxes** desenhadas nas áreas de risco
3. **Cores por severidade**:
   - 🔴 Crítica: Crimson (#DC143C)
   - 🟠 Alta: Vermelho (#FF0000)
   - 🟡 Média: Laranja (#FFA500)
   - 🟢 Baixa: Amarelo (#FFFF00)

4. **Legenda** com número da detecção e confiança

## 📊 Cálculo de Compliance

O score de compliance é calculado como:

```
Score = 100 - Σ(count_severity × weight_severity)
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

## 🔄 Fluxo de Processamento

```
1. Upload de evidência (imagem)
      ↓
2. Task Celery process_assessment
      ↓
3. OlimpiaAIClient.analyze_assessment()
      ↓
4. Para cada imagem:
   a. POST /v2/seguranca-por-imagem/infer
   b. Parse das violações
   c. Desenhar bounding boxes
   d. Salvar OlimpiaDetectionResult
      ↓
5. Criar RiskFinding para cada detecção
      ↓
6. Atualizar AIInferenceResult
      ↓
7. Transicionar assessment para AI_REVIEWED
```

## 🧪 Testes

Para testar a integração em modo de desenvolvimento:

```bash
# Usar modo mock (não chama API real)
AI_SERVICE_MOCK_MODE=true

# Ou usar cliente Olímpia com token de teste
AI_SERVICE_MOCK_MODE=false
OLIMPIA_API_ENABLED=true
OLIMPIA_API_TOKEN=test_token
```

## 📝 Exemplo de Uso

```python
from assessments.olimpia_service import get_olimpia_service
from assessments.models import RiskAssessment

# Obter serviço
service = get_olimpia_service()

# Buscar avaliação
assessment = RiskAssessment.objects.get(id=1)

# Processar
result = service.process_assessment_with_detections(
    assessment,
    assessment.inferences.first()
)

print(f"Detecções: {result['detections_count']}")
print(f"Score: {result['compliance_score']}")
```

## 🔧 Troubleshooting

### Timeout na API
Aumente `OLIMPIA_API_TIMEOUT` (padrão: 60s)

### Detecções com confiança baixa
Ajuste `OLIMPIA_MIN_CONFIDENCE` (padrão: 0.70)

### Erro de autenticação
Verifique se o token está válido e não expirado

### Imagens não processadas
Verifique se `SAFETY_IMAGE_DRAW_BOUNDING_BOXES=true`

## 📚 Arquivos Relacionados

- `backend/assessments/ai_client.py` - Cliente HTTP da API Olímpia
- `backend/assessments/image_processor.py` - Processamento de imagens
- `backend/assessments/olimpia_service.py` - Serviço de integração
- `backend/assessments/models.py` - Modelos OlimpiaDetectionResult
- `backend/config/settings/base.py` - Configurações

## 📞 Suporte

Para obter acesso à API Olímpia, entre em contato com:
- Equipe Dataprev/Olímpia
- Gestão do projeto WorkSafety
