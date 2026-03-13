import React, { useEffect, useState } from 'react';
import { Table } from '../components/Table';
import { fetchWithToken } from '../services/api';

interface AuditLog {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  action_display: string;
  performed_by_email: string;
  timestamp: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetchWithToken('/api/admin/audit-logs/');
      const data = await res.json();
      setLogs(data);
    } catch (error) {
      console.error('Failed to fetch', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const columns = [
    { header: 'ID', accessor: 'id' as const },
    { header: 'Entidade', accessor: 'entity_type' as const },
    { header: 'Entidade ID', accessor: 'entity_id' as const },
    { 
      header: 'Ação', 
      accessor: (row: AuditLog) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          row.action === 'create' ? 'bg-emerald-100 text-emerald-800' :
          row.action === 'update' ? 'bg-blue-100 text-blue-800' :
          row.action === 'delete' ? 'bg-red-100 text-red-800' :
          'bg-slate-100 text-slate-800'
        }`}>
          {row.action_display}
        </span>
      )
    },
    { header: 'Usuário', accessor: 'performed_by_email' as const },
    { 
      header: 'Data', 
      accessor: (row: AuditLog) => new Date(row.timestamp).toLocaleString('pt-BR')
    },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Logs/Auditoria</h1>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-500">Carregando...</div>
      ) : (
        <Table data={logs} columns={columns} />
      )}
    </div>
  );
}
