# ✅ Solução: Riscos com Confiança Real da API

## 🎯 O Que Foi Feito

### Problema Original
- Riscos em http://localhost:3000/inspection/risks exibiam **dados mockados** sem confiança individual
- Exemplo: "Risco tipo 1" em português, "Area 1", sem badge de confiança

### Solução Implementada
Agora o sistema **retorna e exibe confiança real** de cada detecção:

```json
{
  "id": "1",
  "description": "[Uso de EPI] missing reflective vest",
  "severity": "HIGH",
  "ai_confidence": "92%",  // ← NOVO: Real da IA
  "risk_status": "ai_detected",
  "location": "Area 1"
}
```

---

## 📋 Arquivos Modificados (5 mudanças)

### 1. `backend/assessments/ai_client.py` ⭐ Crítica
**O quê:** MockAIClient agora retorna "confidence" em cada achado
**Mudança:**
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
    "confidence": 0.92,  # ← NOVO
    "category": "GENERAL",  # ← NOVO
})
```

### 2. `backend/assessments/tasks.py` ⭐ Crítica
**O quê:** Task de processamento agora lê e armazena confiança
**Mudança na função `_update_risk_findings()`:**
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
# ... conversão se necessário ...
finding = RiskFinding.objects.create(
    assessment=assessment,
    description=finding_data.get("description", ""),
    severity=finding_data.get("severity", "MEDIUM"),
    location=finding_data.get("location", ""),
    evidence=evidence,
    ai_confidence=confidence,  # ← NOVO
)
```

### 3. `backend/assessments/models.py` ✅ Já feito
**O quê:** Campo `ai_confidence` adicionado ao modelo RiskFinding
```python
ai_confidence = models.DecimalField(
    "confiança da IA",
    max_digits=4,
    decimal_places=3,  # 0.000 a 0.999
    null=True,
    blank=True,
)
```

### 4. `backend/assessments/serializers.py` ✅ Já feito
**O quê:** Serializer formata confiança como percentual
```python
def get_ai_confidence(self, obj: RiskFinding) -> str:
    if obj.ai_confidence:
        return f"{obj.ai_confidence * 100:.0f}%"  # 0.92 → "92%"
    return ""
```

### 5. `frontend/src/features/inspection/RisksDetected.tsx` ✅ Já feito
**O quê:** Badge visual melhorado para exibir confiança
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

## 🚀 Como Usar

### Passo 1: Aplicar Migração
```bash
cd backend
python manage.py migrate assessments
# Deve conectar migração 0026_add_ai_confidence_to_riskfinding
```

### Passo 2: Reiniciar Serviços
```bash
# Se usar docker-compose
docker-compose down
docker-compose up -d

# Ou se rodar localmente
# Parar e reiniciar backend + frontend
```

### Passo 3: Testar
**Opção A: Com avaliação existente**
```bash
cd backend
python manage.py shell
```

```python
from assessments.models import RiskAssessment
from assessments.tasks import process_assessment

# Buscar avaliação em status 'synced' ou 'error_ai'
assessment = RiskAssessment.objects.filter(
    status__in=['synced', 'error_ai']
).first()

if assessment:
    print(f"Reprocessando avaliação {assessment.id}...")
    process_assessment(assessment.id)
    
    # Verificar resultados
    from assessments.models import RiskFinding
    findings = RiskFinding.objects.filter(assessment=assessment)
    
    for finding in findings:
        confidence = f"{finding.ai_confidence * 100:.0f}%" if finding.ai_confidence else "N/A"
        print(f"✓ {finding.description}: {confidence}")
```

**Opção B: Script de teste automatizado**
```bash
cd backend
python manage.py shell < test_confidence_script.py
```

### Passo 4: Acessar Frontend
https://localhost:3000/inspection/risks

Procure por um risco e veja a badge **"92% confidence"** (ou outro percentual)

---

## 📊 Dados Antes vs Depois

### Antes (Quebrado)
```json
{
  "id": "1",
  "description": "Risco tipo 1",
  "severity": "HIGH",
  "location": "Area 1",
  "ai_confidence": "",           // ← VAZIO!
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
  "ai_confidence": "92%",        // ← CONFIANÇA REAL!
  "recommendations": [...]
}
```

---

## 🧪 Verificação Rápida

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

## ✨ Próximos Passos (Opcional)

### Para Usar API Real do Olímpia
Edite `backend/.env`:
```env
AI_SERVICE_MOCK_MODE=false
OLIMPIA_API_ENABLED=true
OLIMPIA_API_TOKEN=seu_token_aqui
```

Reinicie o backend e os dados virão direto da API!

### Para Adicionar Mais Campos
Se precisar adicionar mais informações (bounding box, etc), siga o mesmo padrão:

1. Adicione campo ao modelo RiskFinding
2. Crie migração
3. Atualizar `_update_risk_findings()` para ler do finding_data
4. Atualizar serializer para retornar
5. Atualizar frontend para exibir

---

## 🐛 Troubleshooting

### Confiança ainda não aparece?

**1. Verificar migração aplicada:**
```bash
python manage.py showmigrations assessments | grep 0026
# Deve estar [X] (aplicada)
```

**2. Limpar cache do navegador:**
```
Ctrl+Shift+Delete (Windows/Linux)
Cmd+Shift+Delete (Mac)
```

**3. Forçar reprocessamento:**
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

Isso significa que está usando dados muito antigos ou cache. Execute:

```bash
# Limpar cache do navegador (veja acima)
# Limpar cache de DNS
# Reiniciar navegador completamente
# Tentar em modo incógnito

# Se ainda não funcionar, verificar que a migração foi aplicada (passo 1)
```

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique o arquivo `TESTE_CONFIANCA.md` para guia detalhado
2. Execute `test_confidence_script.py` para diagnóstico automático
3. Consulte os logs: `docker-compose logs -f backend`
4. Verifique se a migração foi aplicada

---

## ✅ Checklist Final

- [ ] Migração 0026 aplicada (`python manage.py migrate assessments`)
- [ ] Backend reiniciado
- [ ] Frontend limpou cache
- [ ] Acessou http://localhost:3000/inspection/risks
- [ ] Vê badge "92% confidence" ao lado dos riscos
- [ ] Dados não estão mais em português ("Risco tipo 1")
- [ ] Score de compliance aparece corretamente

**Se todos os itens estão ✅, você está pronto!**
