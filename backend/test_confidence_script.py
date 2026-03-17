#!/usr/bin/env python
"""
Script de teste para verificar o fluxo de confiança da IA

Execute com:
  python manage.py shell < test_confidence_flow.py
  
ou manualmente no shell:
  python manage.py shell
  exec(open('test_confidence_flow.py').read())
"""

from decimal import Decimal
from assessments.ai_client import MockAIClient, AIInferenceRequest
from assessments.serializers import RiskItemSerializer
from assessments.models import RiskAssessment, RiskFinding

print("\n" + "="*70)
print("TESTE: Fluxo de Confiança da IA")
print("="*70)

# Passo 1: Testar MockAIClient
print("\n1️⃣ Testando MockAIClient.analyze_assessment()...")
client = MockAIClient()
request = AIInferenceRequest(
    assessment_id=1,
    evidence_urls=["http://example.com/image1.jpg", "http://example.com/image2.jpg"],
    title="Test",
    description="Test assessment"
)
result = client.analyze_assessment(request)

print(f"   ✓ Sucesso: {result.success}")
print(f"   ✓ Findings encontrados: {len(result.findings)}")

if result.findings:
    for i, finding in enumerate(result.findings):
        confidence = finding.get("confidence", "N/A")
        print(f"     [{i+1}] confidence = {confidence}")
        print(f"         description = {finding.get('description', 'N/A')[:40]}...")
        
    # Validação
    has_confidence = all("confidence" in f for f in result.findings)
    if has_confidence:
        print("   ✅ PASS: Todos os findings têm 'confidence'")
    else:
        print("   ❌ FAIL: Alguns findings não têm 'confidence'")

# Passo 2: Testar conversão de confiança em RiskFinding
print("\n2️⃣ Testando armazenamento em RiskFinding...")
assessment = RiskAssessment.objects.first()
if assessment:
    # Verificar se há findings com confiança
    findings = RiskFinding.objects.filter(
        assessment=assessment, 
        ai_confidence__isnull=False
    ).order_by('-ai_confidence')
    
    if findings.exists():
        print(f"   ✓ Encontrados {findings.count()} findings com confiança")
        for finding in findings[:3]:  # Mostrar os 3 primeiros
            confidence_percent = f"{finding.ai_confidence * 100:.0f}%" if finding.ai_confidence else "N/A"
            print(f"     - {finding.description[:40]}...")
            print(f"       ai_confidence (DB) = {finding.ai_confidence}")
            print(f"       ai_confidence (%) = {confidence_percent}")
        print("   ✅ PASS: Confiança armazenada no BD")
    else:
        print("   ⚠️ WARN: Nenhum finding com confiança encontrado")
        print("      (Pode ser que precisar reprocessar uma avaliação)")
else:
    print("   ⚠️ WARN: Nenhuma avaliação encontrada no BD")

# Passo 3: Testar Serializer
print("\n3️⃣ Testando RiskItemSerializer.get_ai_confidence()...")
if findings.exists():
    finding = findings.first()
    serializer = RiskItemSerializer(finding)
    data = serializer.data
    
    ai_confidence_formatted = data.get('ai_confidence', '')
    print(f"   ✓ Serializer output: ai_confidence = '{ai_confidence_formatted}'")
    
    # Validação
    if ai_confidence_formatted and '%' in ai_confidence_formatted:
        print(f"   ✅ PASS: Confiança formatada corretamente como '{ai_confidence_formatted}'")
    else:
        print(f"   ❌ FAIL: Confiança não formatada (obtido: '{ai_confidence_formatted}')")
else:
    print("   ⚠️ WARN: Sem findings para testar serializer")

# Resumo
print("\n" + "="*70)
print("RESUMO DO TESTE")
print("="*70)
print("""
✅ Se todos os testes passarem:
   1. MockAIClient retorna "confidence" em cada finding
   2. RiskFinding.ai_confidence é populado no BD
   3. Serializer formata como "92%"
   4. Frontend deve exibir a badge "92% confidence"

❌ Se algum teste falhar:
   1. Verifique o arquivo TESTE_CONFIANCA.md para troubleshooting
   2. Execute: python manage.py migrate assessments
   3. Reprocesse uma avaliação em status 'synced'

Para reprocessar manualmente:
   from assessments.models import RiskAssessment
   from assessments.tasks import process_assessment
   
   assessment = RiskAssessment.objects.filter(status='synced').first()
   if assessment:
       process_assessment(assessment.id)
""")
print("="*70 + "\n")
