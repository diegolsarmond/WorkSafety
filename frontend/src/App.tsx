/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import AppRouter from '@/app/router';
import { useAuthStore } from '@/store/authStore';
import { useSplashScreen } from '@/hooks/useSplashScreen';
import { SplashScreen } from '@/features/splash';

export default function App() {
  const { checkAuth, isInitializing } = useAuthStore();
  const { showSplash, isReady, handleSplashComplete } = useSplashScreen();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Show splash screen first
  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} duration={5000} />;
  }

  // Then show loading spinner while auth is initializing
  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#0B7A90] border-t-transparent"></div>
      </div>
    );
  }

  return <AppRouter />;
}
