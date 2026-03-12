import { SYNC_CONFIG } from '@/types/sync';

/**
 * Gera um ID único para jobs
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calcula o delay para o próximo retry usando backoff exponencial com jitter
 * 
 * Fórmula: min(base * (2 ^ retryCount) + jitter, maxDelay)
 * 
 * @param retryCount - Número de tentativas já realizadas
 * @returns Delay em milissegundos
 */
export function calculateBackoffDelay(retryCount: number): number {
  // Cálculo exponencial: base * (2 ^ retryCount)
  const exponentialDelay = SYNC_CONFIG.BASE_DELAY_MS * Math.pow(
    SYNC_CONFIG.BACKOFF_MULTIPLIER, 
    retryCount
  );
  
  // Adiciona jitter aleatório para evitar thundering herd
  const jitter = Math.random() * SYNC_CONFIG.JITTER_MAX_MS;
  
  // Aplica o delay máximo
  const delay = Math.min(exponentialDelay + jitter, SYNC_CONFIG.MAX_DELAY_MS);
  
  return Math.round(delay);
}

/**
 * Calcula quando o próximo retry deve ocorrer
 */
export function calculateNextRetryAt(retryCount: number): number {
  return Date.now() + calculateBackoffDelay(retryCount);
}

/**
 * Formata o tempo restante para retry em texto legível
 */
export function formatTimeToRetry(nextRetryAt: number): string {
  const remaining = nextRetryAt - Date.now();
  
  if (remaining <= 0) return 'Pronto para tentar';
  
  const seconds = Math.ceil(remaining / 1000);
  const minutes = Math.ceil(seconds / 60);
  
  if (seconds < 60) {
    return `Tentando em ${seconds}s`;
  }
  if (minutes < 60) {
    return `Tentando em ${minutes}min`;
  }
  return `Tentando em ${Math.ceil(minutes / 60)}h`;
}

/**
 * Converte dataUrl para File
 */
export function dataURLtoFile(dataurl: string, filename: string): File {
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * Verifica se o navegador está online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Verifica se a página está visível
 */
export function isPageVisible(): boolean {
  return document.visibilityState === 'visible';
}

/**
 * Debounce function para limitar chamadas
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Formata data para exibição
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Trunca texto longo
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}
