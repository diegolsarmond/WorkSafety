// Clear corrupted storage and service workers
(() => {
  console.log('[Cleanup] Starting cleanup...');
  
  // Clear all storage
  localStorage.clear();
  sessionStorage.clear();
  console.log('[Cleanup] Storage cleared');
  
  // Clear service workers
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.unregister();
        console.log('[Cleanup] Service worker unregistered:', registration.scope);
      }
    });
  }
  
  // Clear cache storage
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => {
        caches.delete(name);
        console.log('[Cleanup] Cleared cache:', name);
      });
    });
  }
  
  console.log('[Cleanup] Done! Reload the page.');
})();
