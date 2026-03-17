/**
 * Gerenciador de Sincronização
 * Monitora conexão e sincroniza dados quando online
 */

import { getUserPreferences } from '../storage/settingsStorage';
import {
  getNextPendingItem,
  updateQueueItem,
  removeFromQueue,
  listOfflineInspections,
  updateOfflineInspection,
  markInspectionAsSynced,
  addToSyncQueue,
} from '../storage/syncQueue';
import { markImageAsSynced } from '../storage/imageStorage';
import type { SyncQueueItem, OfflineInspection } from '../storage/types';

type SyncStatus = 'idle' | 'syncing' | 'error';
type ConnectionStatus = 'online' | 'offline';

interface SyncState {
  status: SyncStatus;
  connection: ConnectionStatus;
  pendingCount: number;
  lastSync?: string;
  error?: string;
}

type SyncStateListener = (state: SyncState) => void;

class SyncManager {
  private state: SyncState = {
    status: 'idle',
    connection: navigator.onLine ? 'online' : 'offline',
    pendingCount: 0,
  };
  
  private listeners: SyncStateListener[] = [];
  private syncInterval?: number;
  private isProcessing = false;

  constructor() {
    this.setupListeners();
    this.startPeriodicSync();
  }

  // ========== STATE MANAGEMENT ==========

  private setState(updates: Partial<SyncState>) {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('Erro em listener de sync:', error);
      }
    });
  }

  subscribe(listener: SyncStateListener): () => void {
    this.listeners.push(listener);
    listener(this.state); // Notifica estado inicial
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  getState(): SyncState {
    return { ...this.state };
  }

  // ========== EVENT LISTENERS ==========

  private setupListeners() {
    window.addEventListener('online', () => {
      this.setState({ connection: 'online' });
      this.triggerSync();
    });

    window.addEventListener('offline', () => {
      this.setState({ connection: 'offline' });
    });

    // Sincroniza quando a aba volta a ficar visível
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        this.updatePendingCount();
        this.triggerSync();
      }
    });
  }

  // ========== PERIODIC SYNC ==========

  private startPeriodicSync() {
    // Verifica a cada 30 segundos se há coisas para sincronizar
    this.syncInterval = window.setInterval(() => {
      if (navigator.onLine && this.state.status === 'idle') {
        this.updatePendingCount();
        if (this.state.pendingCount > 0) {
          this.triggerSync();
        }
      }
    }, 30000);
  }

  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }

  // ========== SYNC LOGIC ==========

  async updatePendingCount() {
    const inspections = await listOfflineInspections({ status: 'pending' });
    this.setState({ pendingCount: inspections.length });
  }

  async triggerSync(): Promise<void> {
    if (this.isProcessing || !navigator.onLine) return;

    const prefs = await getUserPreferences();
    
    // Verifica se deve sincronizar apenas no WiFi
    if (prefs.syncOnWifiOnly) {
      const connection = (navigator as { connection?: { type?: string } }).connection;
      if (connection && connection.type && connection.type !== 'wifi') {
        console.log('SyncManager: Aguardando WiFi para sincronizar');
        return;
      }
    }

    this.isProcessing = true;
    this.setState({ status: 'syncing', error: undefined });

    try {
      // Processa fila de sync primeiro
      await this.processSyncQueue();
      
      // Depois sincroniza inspeções pendentes
      await this.syncPendingInspections();
      
      this.setState({
        status: 'idle',
        lastSync: new Date().toISOString(),
      });
    } catch (error) {
      console.error('SyncManager: Erro na sincronização:', error);
      this.setState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    } finally {
      this.isProcessing = false;
      await this.updatePendingCount();
    }
  }

  private async processSyncQueue(): Promise<void> {
    let item = await getNextPendingItem();
    
    while (item && navigator.onLine) {
      try {
        await updateQueueItem(item.id, { status: 'processing' });
        
        // Processa baseado no tipo
        await this.processQueueItem(item);
        
        await updateQueueItem(item.id, { status: 'completed' });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Erro ao processar';
        await updateQueueItem(item.id, { 
          status: 'failed', 
          error: errorMsg 
        });
        
        // Se falhou muitas vezes, para de tentar
        if (item.metadata.attempts >= 3) {
          console.warn(`SyncManager: Item ${item.id} falhou 3 vezes, pulando`);
        }
      }
      
      item = await getNextPendingItem();
    }
  }

  private async processQueueItem(item: SyncQueueItem): Promise<void> {
    switch (item.type) {
      case 'inspection':
        await this.syncInspectionToServer(item.data as OfflineInspection);
        break;
      case 'image':
        await this.syncImageToServer(item.data as { imageId: string; url: string });
        break;
      case 'settings':
        // Sincroniza configurações se necessário
        break;
      default:
        console.warn('SyncManager: Tipo desconhecido', item.type);
    }
  }

  private async syncPendingInspections(): Promise<void> {
    const pending = await listOfflineInspections({ status: 'pending' });
    
    for (const inspection of pending) {
      if (!navigator.onLine) break;
      
      try {
        await updateOfflineInspection(inspection.localId, { status: 'syncing' });
        await this.syncInspectionToServer(inspection);
      } catch (error) {
        await updateOfflineInspection(inspection.localId, {
          status: 'error',
          lastError: error instanceof Error ? error.message : 'Erro ao sincronizar',
        });
      }
    }
  }

  private async syncInspectionToServer(inspection: OfflineInspection): Promise<void> {
    // TODO: Implementar integração com API real
    // Por enquanto simula o envio
    console.log('SyncManager: Enviando inspeção', inspection.localId);
    
    // Simula delay de rede
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Marca como sincronizado
    const serverId = `server_${Date.now()}`;
    await markInspectionAsSynced(inspection.localId, serverId);
    
    // Marca imagens como sincronizadas
    for (const imageId of inspection.data.images) {
      await markImageAsSynced(imageId);
    }
  }

  private async syncImageToServer(data: { imageId: string; url: string }): Promise<void> {
    console.log('SyncManager: Enviando imagem', data.imageId);
    
    // Simula upload
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await markImageAsSynced(data.imageId);
  }

  // ========== PUBLIC API ==========

  /**
   * Adiciona inspeção para sincronização
   */
  async queueInspection(inspection: OfflineInspection): Promise<void> {
    await addToSyncQueue('inspection', 'create', inspection, 'high');
    await this.updatePendingCount();
    
    // Tenta sincronizar imediatamente se online
    if (navigator.onLine) {
      this.triggerSync();
    }
  }

  /**
   * Força sincronização manual
   */
  async forceSync(): Promise<void> {
    await this.updatePendingCount();
    await this.triggerSync();
  }
}

// Singleton
export const syncManager = new SyncManager();
