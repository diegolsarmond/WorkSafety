/**
 * Testes unitários para as funções utilitárias de sincronização
 * 
 * Para executar: npx tsx src/__tests__/sync/syncUtils.test.ts
 */

import { 
  generateId, 
  calculateBackoffDelay, 
  calculateNextRetryAt,
  formatTimeToRetry,
  dataURLtoFile 
} from '@/utils/syncUtils';
import { SYNC_CONFIG } from '@/types/sync';
import * as assert from 'assert';

// Mock para navigator.onLine
Object.defineProperty(global, 'navigator', {
  value: {
    onLine: true,
  },
  writable: true,
  configurable: true,
});

console.log('🧪 Running syncUtils tests...\n');

// Test: generateId
{
  console.log('Test: generateId');
  const id1 = generateId();
  const id2 = generateId();
  
  assert.strictEqual(typeof id1, 'string', 'ID deve ser uma string');
  assert.ok(id1.length > 0, 'ID não deve estar vazio');
  assert.notStrictEqual(id1, id2, 'IDs devem ser únicos');
  assert.ok(id1.includes('-'), 'ID deve conter timestamp e random');
  console.log('✅ generateId tests passed\n');
}

// Test: calculateBackoffDelay
{
  console.log('Test: calculateBackoffDelay');
  
  // Teste 1: Delay base (retry 0)
  const delay0 = calculateBackoffDelay(0);
  assert.ok(delay0 >= SYNC_CONFIG.BASE_DELAY_MS, 'Delay retry 0 deve ser >= base');
  assert.ok(delay0 <= SYNC_CONFIG.BASE_DELAY_MS + SYNC_CONFIG.JITTER_MAX_MS, 'Delay retry 0 deve incluir jitter');
  
  // Teste 2: Crescimento exponencial (retry 1)
  const delay1 = calculateBackoffDelay(1);
  const expectedMin1 = SYNC_CONFIG.BASE_DELAY_MS * 2; // 2^1 = 2
  assert.ok(delay1 >= expectedMin1, `Delay retry 1 deve ser >= ${expectedMin1}`);
  
  // Teste 3: Crescimento exponencial (retry 2)
  const delay2 = calculateBackoffDelay(2);
  const expectedMin2 = SYNC_CONFIG.BASE_DELAY_MS * 4; // 2^2 = 4
  assert.ok(delay2 >= expectedMin2, `Delay retry 2 deve ser >= ${expectedMin2}`);
  
  // Teste 4: Max delay (retry alto)
  const delay10 = calculateBackoffDelay(10);
  assert.ok(delay10 <= SYNC_CONFIG.MAX_DELAY_MS, 'Delay não deve exceder MAX_DELAY_MS');
  
  // Teste 5: Jitter - múltiplas chamadas devem variar
  const delays = Array.from({ length: 20 }, () => calculateBackoffDelay(1));
  const uniqueDelays = new Set(delays);
  assert.ok(uniqueDelays.size > 1, 'Jitter deve causar variação nos delays');
  
  console.log('✅ calculateBackoffDelay tests passed\n');
}

// Test: calculateNextRetryAt
{
  console.log('Test: calculateNextRetryAt');
  
  const before = Date.now();
  const nextRetry = calculateNextRetryAt(0);
  const after = Date.now();
  
  assert.ok(nextRetry >= before + SYNC_CONFIG.BASE_DELAY_MS, 'nextRetryAt deve ser no futuro');
  assert.ok(nextRetry <= after + SYNC_CONFIG.BASE_DELAY_MS + SYNC_CONFIG.JITTER_MAX_MS + 10, 'nextRetryAt deve considerar processamento');
  
  console.log('✅ calculateNextRetryAt tests passed\n');
}

// Test: formatTimeToRetry
{
  console.log('Test: formatTimeToRetry');
  
  // Teste 1: Tempo passado
  const past = Date.now() - 1000;
  assert.strictEqual(formatTimeToRetry(past), 'Pronto para tentar', 'Tempo passado deve indicar pronto');
  
  // Teste 2: Futuro próximo (segundos)
  const soon = Date.now() + 30000; // 30s
  const formattedSoon = formatTimeToRetry(soon);
  assert.ok(formattedSoon.includes('s') || formattedSoon.includes('min'), 'Deve mostrar segundos ou minutos');
  
  // Teste 3: Futuro distante (minutos)
  const later = Date.now() + 5 * 60 * 1000; // 5 min
  const formattedLater = formatTimeToRetry(later);
  assert.ok(formattedLater.includes('min'), 'Deve mostrar minutos');
  
  console.log('✅ formatTimeToRetry tests passed\n');
}

// Test: dataURLtoFile
{
  console.log('Test: dataURLtoFile');
  
  // Cria um dataUrl de teste (1x1 pixel transparente PNG)
  const testDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  const filename = 'test.png';
  
  const file = dataURLtoFile(testDataUrl, filename);
  
  assert.ok(file instanceof File, 'Deve retornar um objeto File');
  assert.strictEqual(file.name, filename, 'Nome do arquivo deve corresponder');
  assert.strictEqual(file.type, 'image/png', 'MIME type deve ser extraído do dataUrl');
  assert.ok(file.size > 0, 'Arquivo deve ter conteúdo');
  
  console.log('✅ dataURLtoFile tests passed\n');
}

// Test: Valores de configuração
{
  console.log('Test: SYNC_CONFIG values');
  
  assert.strictEqual(SYNC_CONFIG.MAX_RETRIES, 3, 'MAX_RETRIES deve ser 3');
  assert.strictEqual(SYNC_CONFIG.BASE_DELAY_MS, 2000, 'BASE_DELAY_MS deve ser 2000ms');
  assert.strictEqual(SYNC_CONFIG.MAX_DELAY_MS, 60000, 'MAX_DELAY_MS deve ser 60000ms');
  assert.strictEqual(SYNC_CONFIG.BACKOFF_MULTIPLIER, 2, 'BACKOFF_MULTIPLIER deve ser 2');
  
  console.log('✅ SYNC_CONFIG tests passed\n');
}

console.log('🎉 All syncUtils tests passed!');
