/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import AppRouter from '@/app/router';
import { useAuthStore } from '@/store/authStore';

export default function App() {
  const { checkAuth, isLoading } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#0B7A90] border-t-transparent"></div>
      </div>
    );
  }

  return <AppRouter />;
}
