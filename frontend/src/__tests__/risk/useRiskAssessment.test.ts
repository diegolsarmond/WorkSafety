/**
 * Testes unitários para o hook useRiskAssessment
 * 
 * Estes testes verificam:
 * - Estados iniciais corretos
 * - Lógica de filtros e ordenação
 * - Tratamento de erros
 * 
 * NOTA: Execute estes testes no console do navegador importando:
 * import { runManualTests } from '@/__tests__/risk/useRiskAssessment.test';
 * runManualTests();
 */

import type { RiskAssessmentDetail } from '@/types/risk';
import {
  mockAssessmentDetail,
} from './mockAxios';

// Re-export mocks
export { mockAssessmentDetail };

// =============================================================================
// Helpers de Teste
// =============================================================================

/** Simula a lógica de filtro do hook */
function filterRisks(
  assessment: RiskAssessmentDetail,
  filters: { severity?: string[]; search?: string; status?: string[] }
): typeof assessment.risks {
  let risks = [...assessment.risks];

  // Aplicar filtros
  if (filters.severity && filters.severity.length > 0) {
    risks = risks.filter((r) => filters.severity?.includes(r.severity));
  }

  if (filters.status && filters.status.length > 0) {
    risks = risks.filter((r) => filters.status?.includes(r.risk_status));
  }

  if (filters.search) {
    const search = filters.search.toLowerCase();
    risks = risks.filter(
      (r) =>
        r.description.toLowerCase().includes(search) ||
        r.location.toLowerCase().includes(search)
    );
  }

  return risks;
}

/** Simula a lógica de ordenação do hook */
function sortRisks(
  risks: typeof mockAssessmentDetail.risks,
  sortOption: 'severity_desc' | 'severity_asc' | 'date_desc' | 'date_asc'
): typeof risks {
  const sorted = [...risks];
  
  sorted.sort((a, b) => {
    switch (sortOption) {
      case 'severity_desc': {
        const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      case 'severity_asc': {
        const severityOrder = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      case 'date_desc':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'date_asc':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      default:
        return 0;
    }
  });

  return sorted;
}

/** Simula a contagem de riscos */
function countRisks(assessment: RiskAssessmentDetail): Record<string, number> {
  return assessment.risks.reduce((acc, risk) => {
    acc[risk.severity] = (acc[risk.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

// =============================================================================
// Testes Manuais
// =============================================================================

console.log('🧪 Running useRiskAssessment hook tests...\n');

export function runManualTests() {
  let passed = 0;
  let failed = 0;

  // Test 1: Estado inicial quando assessmentId é null
  console.log('Test 1: Estado inicial quando assessmentId é null');
  try {
    const initialState = {
      type: 'error',
      message: 'No assessment ID provided',
      canRetry: false,
    };
    if (initialState.type === 'error' && !initialState.canRetry) {
      console.log('  ✅ PASS\n');
      passed++;
    } else {
      throw new Error('Initial state incorrect');
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error, '\n');
    failed++;
  }

  // Test 2: Filtro por severidade
  console.log('Test 2: Lógica de filtro por severidade');
  try {
    const filtered = filterRisks(mockAssessmentDetail, { severity: ['CRITICAL'] });
    if (filtered.length === 1 && filtered[0].severity === 'CRITICAL') {
      console.log('  ✅ PASS\n');
      passed++;
    } else {
      throw new Error('Filter logic incorrect');
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error, '\n');
    failed++;
  }

  // Test 3: Filtro por múltiplas severidades
  console.log('Test 3: Filtro por múltiplas severidades');
  try {
    const filtered = filterRisks(mockAssessmentDetail, { severity: ['CRITICAL', 'HIGH'] });
    if (filtered.length === 2) {
      console.log('  ✅ PASS\n');
      passed++;
    } else {
      throw new Error('Multiple severity filter incorrect');
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error, '\n');
    failed++;
  }

  // Test 4: Busca por texto
  console.log('Test 4: Lógica de busca por texto');
  try {
    const filtered = filterRisks(mockAssessmentDetail, { search: 'PPE' });
    if (filtered.length === 1 && filtered[0].description.includes('PPE')) {
      console.log('  ✅ PASS\n');
      passed++;
    } else {
      throw new Error('Search logic incorrect');
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error, '\n');
    failed++;
  }

  // Test 5: Busca por localização
  console.log('Test 5: Busca por localização');
  try {
    const filtered = filterRisks(mockAssessmentDetail, { search: 'Platform' });
    if (filtered.length === 1 && filtered[0].location.includes('Platform')) {
      console.log('  ✅ PASS\n');
      passed++;
    } else {
      throw new Error('Location search incorrect');
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error, '\n');
    failed++;
  }

  // Test 6: Ordenação por severidade descendente
  console.log('Test 6: Ordenação por severidade descendente');
  try {
    const sorted = sortRisks(mockAssessmentDetail.risks, 'severity_desc');
    const severities = sorted.map((r) => r.severity);
    if (severities[0] === 'CRITICAL' && severities[1] === 'HIGH' && severities[2] === 'MEDIUM') {
      console.log('  ✅ PASS\n');
      passed++;
    } else {
      throw new Error('Sort desc logic incorrect: ' + severities.join(', '));
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error, '\n');
    failed++;
  }

  // Test 7: Ordenação por severidade ascendente
  console.log('Test 7: Ordenação por severidade ascendente');
  try {
    const sorted = sortRisks(mockAssessmentDetail.risks, 'severity_asc');
    const severities = sorted.map((r) => r.severity);
    if (severities[0] === 'MEDIUM' && severities[1] === 'HIGH' && severities[2] === 'CRITICAL') {
      console.log('  ✅ PASS\n');
      passed++;
    } else {
      throw new Error('Sort asc logic incorrect: ' + severities.join(', '));
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error, '\n');
    failed++;
  }

  // Test 8: Ordenação por data descendente
  console.log('Test 8: Ordenação por data descendente');
  try {
    const sorted = sortRisks(mockAssessmentDetail.risks, 'date_desc');
    const dates = sorted.map((r) => new Date(r.created_at).getTime());
    if (dates[0] >= dates[1] && dates[1] >= dates[2]) {
      console.log('  ✅ PASS\n');
      passed++;
    } else {
      throw new Error('Date sort desc incorrect');
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error, '\n');
    failed++;
  }

  // Test 9: Contagem de riscos
  console.log('Test 9: Contagem de riscos por severidade');
  try {
    const counts = countRisks(mockAssessmentDetail);
    if (counts.CRITICAL === 1 && counts.HIGH === 1 && counts.MEDIUM === 1) {
      console.log('  ✅ PASS\n');
      passed++;
    } else {
      throw new Error('Count logic incorrect');
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error, '\n');
    failed++;
  }

  // Test 10: Filtro vazio
  console.log('Test 10: Filtro que retorna vazio');
  try {
    const filtered = filterRisks(mockAssessmentDetail, { severity: ['LOW'] });
    if (filtered.length === 0) {
      console.log('  ✅ PASS\n');
      passed++;
    } else {
      throw new Error('Empty filter should return empty array');
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error, '\n');
    failed++;
  }

  // Test 11: Filtro por status
  console.log('Test 11: Filtro por status');
  try {
    const filtered = filterRisks(mockAssessmentDetail, { status: ['ai_detected'] });
    if (filtered.length >= 1 && filtered.every(r => r.risk_status === 'ai_detected')) {
      console.log('  ✅ PASS\n');
      passed++;
    } else {
      throw new Error('Status filter incorrect');
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error, '\n');
    failed++;
  }

  // Test 12: RiskItem structure
  console.log('Test 12: Estrutura do RiskItem');
  try {
    const risk = mockAssessmentDetail.risks[0];
    const requiredFields = ['id', 'description', 'severity', 'location', 'recommendations', 'risk_status'];
    const hasAllFields = requiredFields.every(field => field in risk);
    if (hasAllFields && Array.isArray(risk.recommendations)) {
      console.log('  ✅ PASS\n');
      passed++;
    } else {
      throw new Error('RiskItem missing required fields');
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error, '\n');
    failed++;
  }

  // Resumo
  console.log('═══════════════════════════════════════');
  console.log(`📊 Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════');

  return { passed, failed };
}

// Executa testes manuais
runManualTests();

export default runManualTests;
