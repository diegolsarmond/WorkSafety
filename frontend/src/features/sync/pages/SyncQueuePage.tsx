import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SyncQueueDashboard } from '../components/SyncQueueDashboard';

/**
 * Página de fila de sincronização
 */
export function SyncQueuePage() {
  const navigate = useNavigate();

  return (
    <SyncQueueDashboard 
      onClose={() => navigate('/home')} 
      showBackButton={true}
    />
  );
}
