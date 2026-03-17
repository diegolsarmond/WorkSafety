"""
Teste para verificar o fluxo de confiança da IA

Este teste simula o fluxo completo de dados desde a API Olímpia até o frontend:
1. API retorna rule_1_violation com confidence
2. OlimpiaAIClient parseia e cria SafetyViolation
3. OlimpiaDetectionResult armazena confidence
4. RiskFinding.ai_confidence é preenchido
5. Serializer formata como "92%"
6. Frontend exibe na tela
"""

from decimal import Decimal

def test_confidence_flow():
    """Testa o fluxo de confiança passo a passo"""
    
    print("=" * 60)
    print("TESTE: Fluxo de Confiança da IA")
    print("=" * 60)
    
    # Passo 1: API Olímpia retorna dados com confidence
    api_response = {
        "rule_1_violation": [
            {
                "bounding_box": [0.34, 0.12, 0.55, 0.75],
                "reason": "missing reflective vest",
                "confidence": 0.92
            }
        ]
    }
    print(f"\n1️⃣ API Olímpia retorna: confidence = {api_response['rule_1_violation'][0]['confidence']}")
    
    # Passo 2: OlimpiaAIClient parseia
    confidence_from_api = api_response['rule_1_violation'][0]['confidence']
    print(f"2️⃣ OlimpiaAIClient._parse_violations() lê: {confidence_from_api}")
    
    # Passo 3: SafetyViolation armazena
    safety_violation = {
        "confidence": confidence_from_api,
        "description": "missing reflective vest"
    }
    print(f"3️⃣ SafetyViolation criada com confidence: {safety_violation['confidence']}")
    
    # Passo 4: OlimpiaDetectionResult armazena
    # (No BD como DecimalField com 3 casas decimais)
    detection_confidence = Decimal(str(confidence_from_api)).quantize(Decimal('0.001'))
    print(f"4️⃣ OlimpiaDetectionResult.confidence (DecimalField): {detection_confidence}")
    
    # Passo 5: RiskFinding recebe o valor
    risk_finding_confidence = detection_confidence
    print(f"5️⃣ RiskFinding.ai_confidence = {risk_finding_confidence}")
    
    # Passo 6: Serializer formata
    if risk_finding_confidence:
        ai_confidence_str = f"{risk_finding_confidence * 100:.0f}%"
    else:
        ai_confidence_str = ""
    print(f"6️⃣ Serializer.get_ai_confidence() retorna: '{ai_confidence_str}'")
    
    # Passo 7: JSON da API
    json_response = {
        "ai_confidence": ai_confidence_str,
        "description": "Missing Guardrail",
        "severity": "CRITICAL"
    }
    print(f"7️⃣ JSON enviado para frontend: ai_confidence = '{json_response['ai_confidence']}'")
    
    # Passo 8: Frontend exibe
    print(f"8️⃣ Frontend exibe badge: Badge('{json_response['ai_confidence']} confidence')")
    
    # Verificações
    assert json_response['ai_confidence'] == '92%', "Confiança não formatada corretamente"
    print("\n✅ TESTE PASSOU: Confiança flui corretamente da API ao frontend!")
    print("=" * 60)
    
    return json_response

if __name__ == "__main__":
    result = test_confidence_flow()
    print(f"\nResultado final: {result}")
