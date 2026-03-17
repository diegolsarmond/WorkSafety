# Guia de Teste - Integração API Olímpia com Confiança

## Mudanças Implementadas

### 1. Backend - MockAIClient agora retorna confiança

**Arquivo:** `backend/assessments/ai_client.py`

O MockAIClient foi atualizado para retornar `confidence` individual em cada finding:

```python
findings.append({
    "description": risk_type["description"],
    "severity": risk_type["severity"],
    "location": f"Area {i+1}",
    "confidence": individual_confidence,  # ← NOVO
    "category": "GENERAL",  # ← NOVO
})
```

Valores gerados: **0.70 a 0.95**

### 2. Backend - Task de Processamento atualizada

**Arquivo:** `backend/assessments/tasks.py`

A função `_update_risk_findings` foi atualizada para **ler e armazenar** a confiança:

```python
confidence = finding_data.get("confidence", None)
# ... conversão de string para float se necessário ...

finding = RiskFinding.objects.create(
    # ... outros campos ...
    ai_confidence=confidence,  # ← NOVO: preenche com confiança individual
)
```

### 3. Frontend - Serializer retorna confiança formatada

**Arquivo:** `backend/assessments/serializers.py`

O serializer foi atualizado para converter decimal em percentual:

```python
def get_ai_confidence(self, obj: RiskFinding) -> str:
    if obj.ai_confidence:
        return f"{obj.ai_confidence * 100:.0f}%"  # 0.92 → "92%"
    return ""
```

## ✅ Steps para Testar

### Passo 1: Aplicar Migração
```bash
cd backend
python manage.py migrate assessments
```

### Passo 2: Forçar Reprocessamento

Acesse o shell Django e reprocesse uma avaliação:

```bash
python manage.py shell
```

```python
from assessments.models import RiskAssessment
from assessments.tasks import process_assessment

# Buscar uma avaliação em status AI_REVIEWED
assessment = RiskAssessment.objects.filter(
    status='synced'  # ou 'error_ai' para reprocessar
).first()

if assessment:
    print(f"Processando avaliação {assessment.id}...")
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

## 🔍 Fluxo Completo (Atualizado)

```
MockAIClient.analyze_assessment()
  │
  ├─ finding = { "confidence": 0.92, "description": "...", ... }
  │
  └─ AIInferenceResult(findings=[finding])
      │
      └─ process_assessment() task
          │
          ├─ _update_risk_findings()
          │  │
          │  ├─ confidence = finding_data.get("confidence")  # 0.92
          │  │
          │  └─ RiskFinding.objects.create(ai_confidence=0.92)
          │
          └─ API JSON Response
              │
              ├─ RiskItemSerializer.get_ai_confidence()
              │  │
              │  └─ return "92%"
              │
              └─ Frontend recebe:
                  {
                    "ai_confidence": "92%",
                    "description": "...",
                    "severity": "HIGH"
                  }
                  └─ Exibe: Badge teal "92% confidence"
```

## 📊 Dados Esperados

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

## 🐛 Troubleshooting

### Confiança ainda não aparece?

1. **Limpar cache do navegador:**
   ```bash
   Ctrl+Shift+Delete
   ```

2. **Verificar se a migração foi aplicada:**
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

### Ainda vendo "Area 1" em português?

Isso significa que o MockAIClient está sendo usado. Para usar a API real do Olímpia:

```env
# backend/.env
AI_SERVICE_MOCK_MODE=false
OLIMPIA_API_ENABLED=true
OLIMPIA_API_TOKEN=seu_token_aqui
```

## ✨ Resumo das Mudanças

| Arquivo | Mudança | Impacto |
|---------|---------|--------|
| `ai_client.py` | MockAIClient retorna "confidence" | Dados mockados têm confiança |
| `tasks.py` | `_update_risk_findings` lê "confidence" | RiskFinding armazena confiança |
| `serializers.py` | `get_ai_confidence` formata em % | API retorna "92%" |
| `models.py` | Campo `ai_confidence` adicionado | BD persiste confiança |
| `RisksDetected.tsx` | Badge visual melhorado | UI mostra confiança bonita |

---

**Status:** ✅ Todas as mudanças implementadas e prontas para teste!
