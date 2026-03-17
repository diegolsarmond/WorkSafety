/**
 * Serviço de Sincronização PWA
 * 
 * NOTA: Este é um serviço adicional para casos específicos.
 * Para sincronização de inspeções, prefira o syncStore existente (@/store/syncStore).
 */

export { syncManager } from './SyncManager';
export { useSyncManager, useOnlineStatus } from './hooks';
