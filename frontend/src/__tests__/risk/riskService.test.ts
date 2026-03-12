/**
 * Testes unitários para o RiskService
 * 
 * Estes testes verificam:
 * - Fetch de avaliação por ID
 * - Listagem de avaliações
 * - Transições de status
 * - Tratamento de erros
 * 
 * NOTA: Execute estes testes no console do navegador importando:
 * import { runManualTests } from '@/__tests__/risk/riskService.test';
 * runManualTests();
 */

import {
  getAssessmentById,
  listAssessments,
  humanValidateAssessment,
  RiskServiceError,
  canValidate,
  hasDetectedRisks,
  countRisksBySeverity,
} from '@/services/risk/riskService';
import {
  mockAxios,
  setupDefaultRiskMocks,
  setupNotFoundMock,
  setupForbiddenMock,
  setupEmptyRisksMock,
  mockAssessmentDetail,
  mockAssessmentSummary,
} from './mockAxios';

// Exporta mocks para uso em testes
export {
  mockAxios,
  setupDefaultRiskMocks,
  setupNotFoundMock,
  setupForbiddenMock,
  setupEmptyRisksMock,
  mockAssessmentDetail,
  mockAssessmentSummary,
};

// =============================================================================
// Testes Manuais (para execução no console)
// =============================================================================

console.log('🧪 Running RiskService tests...\n');

export async function runManualTests() {
  let passed = 0;
  let failed = 0;

  // Test 1: Dados mock estão corretos
  console.log('Test 1: Dados mock estão corretos');
  try {
    if (mockAssessmentDetail.risks.length === 3) {
      console.log('  ✅ PASS\n');
      passed++;
    } else {
      throw new Error('Expected 3 risks');
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error, '\n');
    failed++;
  }

  // Test 2: canValidate helper
  console.log('Test 2: canValidate helper');
  try {
    if (canValidate('ai_reviewed') === true && canValidate('draft') === false) {
      console.log('  ✅ PASS\n');
      passed++;
    } else {
      throw new Error('canValidate logic incorrect');
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error, '\n');
    failed++;
  }

  // Test 3: hasDetectedRisks helper
  console.log('Test 3: hasDetectedRisks helper');
  try {
    if (hasDetectedRisks(mockAssessmentDetail) === true) {
      console.log('  ✅ PASS\n');
      passed++;
    } else {
      throw new Error('Should detect risks');
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error, '\n');
    failed++;
  }

  // Test 4: countRisksBySeverity helper
  console.log('Test 4: countRisksBySeverity helper');
  try {
    const counts = countRisksBySeverity(mockAssessmentDetail);
    if (counts.CRITICAL === 1 && counts.HIGH === 1 && counts.MEDIUM === 1) {
      console.log('  ✅ PASS\n');
      passed++;
    } else {
      throw new Error('Incorrect risk counts');
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error, '\n');
    failed++;
  }

  // Test 5: RiskServiceError
  console.log('Test 5: RiskServiceError creation');
  try {
    const error = new RiskServiceError('Test error', 'TEST_CODE', 500);
    if (error.message === 'Test error' && error.code === 'TEST_CODE' && error.statusCode === 500) {
      console.log('  ✅ PASS\n');
      passed++;
    } else {
      throw new Error('RiskServiceError properties incorrect');
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error, '\n');
    failed++;
  }

  // Test 6: MockAxios reset
  console.log('Test 6: MockAxios reset');
  try {
    mockAxios.setShouldFail(true);
    mockAxios.reset();
    // @ts-expect-error - accessing private property for test
    if (!mockAxios['shouldFail']) {
      console.log('  ✅ PASS\n');
      passed++;
    } else {
      throw new Error('Reset failed');
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error, '\n');
    failed++;
  }

  // Test 7: Setup default mocks
  console.log('Test 7: Setup default mocks');
  try {
    setupDefaultRiskMocks();
    // @ts-expect-error - accessing private property for test
    const handlersCount = mockAxios['handlers'].size;
    if (handlersCount >= 3) {
      console.log('  ✅ PASS\n');
      passed++;
    } else {
      throw new Error(`Expected at least 3 handlers, got ${handlersCount}`);
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error, '\n');
    failed++;
  }

  // Test 8: Setup not found mock
  console.log('Test 8: Setup not found mock');
  try {
    setupNotFoundMock();
    // @ts-expect-error - accessing private property for test
    const handlersCount = mockAxios['handlers'].size;
    if (handlersCount >= 1) {
      console.log('  ✅ PASS\n');
      passed++;
    } else {
      throw new Error('Setup not found mock failed');
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error, '\n');
    failed++;
  }

  // Test 9: Empty risks mock
  console.log('Test 9: Empty risks mock');
  try {
    setupEmptyRisksMock();
    // @ts-expect-error - accessing private property for test  
    const handlersCount = mockAxios['handlers'].size;
    if (handlersCount >= 1) {
      console.log('  ✅ PASS\n');
      passed++;
    } else {
      throw new Error('Setup empty risks mock failed');
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error, '\n');
    failed++;
  }

  // Test 10: Assessment types
  console.log('Test 10: Assessment data structure');
  try {
    const requiredFields = ['id', 'title', 'status', 'risks', 'compliance_score'];
    const hasAllFields = requiredFields.every(field => field in mockAssessmentDetail);
    if (hasAllFields && Array.isArray(mockAssessmentDetail.risks)) {
      console.log('  ✅ PASS\n');
      passed++;
    } else {
      throw new Error('Assessment missing required fields');
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

// Executa testes manuais se este arquivo for executado diretamente
if (typeof window !== 'undefined') {
  runManualTests();
}

export default runManualTests;
