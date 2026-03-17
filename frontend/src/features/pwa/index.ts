// Components
export {
  InstallPrompt,
  OfflineIndicator,
  ConnectionBadge,
  OfflineFallback,
  OfflineGuard,
} from './components';

// Provider
export { PWAProvider } from './PWAProvider';

// Hooks
export { useNetworkStatus, usePWAInstall } from './hooks';

// Re-exports do sync service
export { useSyncManager, useOnlineStatus } from '@/services/sync';

// Re-exports do storage service
export {
  usePreferences,
  useAppConfig,
  useImages,
  useStorageStats,
} from '@/services/storage';
