/**
 * Testes específicos para a lógica de Backoff Exponencial + Jitter
 * 
 * Estes testes verificam:
 * 1. Crescimento exponencial correto
 * 2. Limites mínimo e máximo
 * 3. Distribuição do jitter
 * 4. Prevenção de thundering herd
 */

import { calculateBackoffDelay } from '@/utils/syncUtils';
import { SYNC_CONFIG } from '@/types/sync';

console.log('🧪 Running Backoff Exponential + Jitter tests...\n');

// Helper para assertions
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`❌ Assertion failed: ${message}`);
  }
}

function assertApprox(actual: number, expected: number, tolerance: number, message: string): void {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(`❌ ${message}: expected ~${expected}, got ${actual} (diff: ${diff})`);
  }
}

// Test 1: Verifica crescimento exponencial
{
  console.log('Test 1: Exponential growth pattern');
  
  // Removendo jitter para testar crescimento puro
  const delays: number[] = [];
  for (let i = 0; i <= 5; i++) {
    // Calcula múltiplas vezes e pega a mínima (sem jitter ou jitter mínimo)
    const samples = Array.from({ length: 100 }, () => calculateBackoffDelay(i));
    delays.push(Math.min(...samples));
  }
  
  console.log('  Delays (mínimos observados):');
  delays.forEach((d, i) => {
    const expected = SYNC_CONFIG.BASE_DELAY_MS * Math.pow(2, i);
    console.log(`    Retry ${i}: ${d}ms (expected >= ${expected}ms)`);
  });
  
  // Verifica crescimento exponencial
  for (let i = 1; i < delays.length; i++) {
    const ratio = delays[i] / delays[i - 1];
    assert(ratio >= 1.5, `Retry ${i} deve ser ~2x maior que retry ${i-1} (ratio: ${ratio.toFixed(2)})`);
  }
  
  console.log('✅ Exponential growth verified\n');
}

// Test 2: Limites mínimo e máximo
{
  console.log('Test 2: Min and max delay bounds');
  
  // Testa 1000 chamadas para garantir que sempre respeita limites
  for (let i = 0; i < 1000; i++) {
    const delay0 = calculateBackoffDelay(0);
    const delay5 = calculateBackoffDelay(5);
    const delay10 = calculateBackoffDelay(10);
    
    // Mínimo: deve ser pelo menos BASE_DELAY_MS
    assert(delay0 >= SYNC_CONFIG.BASE_DELAY_MS, 
      `Delay deve ser >= ${SYNC_CONFIG.BASE_DELAY_MS}ms`);
    
    // Máximo: não deve exceder MAX_DELAY_MS
    assert(delay5 <= SYNC_CONFIG.MAX_DELAY_MS, 
      `Delay deve ser <= ${SYNC_CONFIG.MAX_DELAY_MS}ms`);
    assert(delay10 <= SYNC_CONFIG.MAX_DELAY_MS, 
      `Delay deve ser <= ${SYNC_CONFIG.MAX_DELAY_MS}ms mesmo com retry alto`);
  }
  
  console.log('✅ Min/max bounds respected over 1000 iterations\n');
}

// Test 3: Jitter distribuição
{
  console.log('Test 3: Jitter distribution');
  
  const retryCount = 2;
  const samples = 1000;
  const delays = Array.from({ length: samples }, () => calculateBackoffDelay(retryCount));
  
  const min = Math.min(...delays);
  const max = Math.max(...delays);
  const avg = delays.reduce((a, b) => a + b, 0) / samples;
  
  const expectedBase = SYNC_CONFIG.BASE_DELAY_MS * Math.pow(2, retryCount);
  
  console.log(`  Retry ${retryCount} statistics over ${samples} samples:`);
  console.log(`    Min: ${min}ms`);
  console.log(`    Max: ${max}ms`);
  console.log(`    Avg: ${Math.round(avg)}ms`);
  console.log(`    Expected base: ${expectedBase}ms`);
  console.log(`    Jitter range: 0-${SYNC_CONFIG.JITTER_MAX_MS}ms`);
  
  // Verifica que há variação (jitter está funcionando)
  assert(max > min, 'Deve haver variação nos delays (jitter)');
  
  // Verifica que todos os delays estão dentro do range esperado
  assert(min >= expectedBase, 'Delay mínimo deve ser >= base sem jitter');
  assert(max <= expectedBase + SYNC_CONFIG.JITTER_MAX_MS, 
    `Delay máximo deve ser <= base + jitter max (${expectedBase + SYNC_CONFIG.JITTER_MAX_MS})`);
  
  // Verifica que a média está próxima do esperado (base + metade do jitter)
  const expectedAvg = expectedBase + (SYNC_CONFIG.JITTER_MAX_MS / 2);
  assertApprox(avg, expectedAvg, SYNC_CONFIG.JITTER_MAX_MS / 2, 
    'Média deve estar próxima do esperado');
  
  console.log('✅ Jitter distribution is correct\n');
}

// Test 4: Prevenção de thundering herd
{
  console.log('Test 4: Thundering herd prevention');
  
  // Simula 100 clientes fazendo retry ao mesmo tempo
  const clientCount = 100;
  const retryCount = 1;
  
  const delays = Array.from({ length: clientCount }, () => 
    calculateBackoffDelay(retryCount)
  );
  
  // Conta quantos delays únicos existem
  const uniqueDelays = new Set(delays);
  const uniquenessRatio = uniqueDelays.size / clientCount;
  
  console.log(`  Simulated ${clientCount} clients retrying simultaneously:`);
  console.log(`    Unique delays: ${uniqueDelays.size}`);
  console.log(`    Uniqueness ratio: ${(uniquenessRatio * 100).toFixed(1)}%`);
  
  // Com jitter de 1000ms, esperamos ~100% de unicidade
  assert(uniquenessRatio > 0.8, 
    `Deve haver alta variação para prevenir thundering herd (${(uniquenessRatio * 100).toFixed(1)}% unique)`);
  
  console.log('✅ Thundering herd prevention verified\n');
}

// Test 5: Consistência com MAX_RETRIES
{
  console.log('Test 5: Consistency with MAX_RETRIES config');
  
  // Verifica que com MAX_RETRIES=3, o delay máximo é razoável
  const maxRetryDelay = calculateBackoffDelay(SYNC_CONFIG.MAX_RETRIES - 1);
  
  console.log(`  MAX_RETRIES: ${SYNC_CONFIG.MAX_RETRIES}`);
  console.log(`  Delay at retry ${SYNC_CONFIG.MAX_RETRIES - 1}: ~${maxRetryDelay}ms`);
  console.log(`  Max possible delay: ${SYNC_CONFIG.MAX_DELAY_MS}ms`);
  
  // O delay na última tentativa deve ser significativo mas não absurdo
  assert(maxRetryDelay >= SYNC_CONFIG.BASE_DELAY_MS * 4, 
    'Delay na última tentativa deve ser pelo menos 4x o base');
  
  console.log('✅ Backoff consistent with MAX_RETRIES\n');
}

// Test 6: Estabilidade (mesmo retryCount = delays similares)
{
  console.log('Test 6: Stability across multiple calls');
  
  const retryCount = 2;
  const iterations = 100;
  
  const delays = Array.from({ length: iterations }, () => 
    calculateBackoffDelay(retryCount)
  );
  
  // Calcula desvio padrão
  const mean = delays.reduce((a, b) => a + b, 0) / delays.length;
  const variance = delays.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / delays.length;
  const stdDev = Math.sqrt(variance);
  
  console.log(`  Retry ${retryCount} over ${iterations} calls:`);
  console.log(`    Mean: ${Math.round(mean)}ms`);
  console.log(`    StdDev: ${Math.round(stdDev)}ms`);
  console.log(`    Coefficient of variation: ${((stdDev / mean) * 100).toFixed(1)}%`);
  
  // O desvio padrão deve ser controlado (devido ao jitter limitado)
  assert(stdDev < SYNC_CONFIG.JITTER_MAX_MS, 
    'Desvio padrão deve ser menor que o jitter máximo');
  
  console.log('✅ Stability verified\n');
}

console.log('🎉 All Backoff tests passed!');
console.log('\n📊 Summary:');
console.log('  • Exponential growth: 2^n pattern verified');
console.log('  • Jitter: Prevents thundering herd');
console.log('  • Bounds: Respects min/max limits');
console.log('  • Distribution: Random but controlled');
