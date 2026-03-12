import React, { useEffect, useState } from 'react';
import { Table } from '../components/Table';
import { RefreshCw, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface ProcessingJob {
  id: number;
  assessment_id: number;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export default function ProcessingQueue() {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const url = filter ? `/api/admin/processing-jobs?status=${filter}` : '/api/admin/processing-jobs';
      const res = await fetch(url);
      const data = await res.json();
      setJobs(data);
    } catch (error) {
      console.error('Failed to fetch', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [filter]);

  const handleReprocess = async (id: number) => {
    if (confirm('Deseja reprocessar esta avaliação?')) {
      try {
        await fetch(`/api/admin/processing-jobs/${id}/reprocess`, { method: 'POST' });
        fetchJobs();
      } catch (error) {
        console.error('Failed to reprocess', error);
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-amber-500" />;
      case 'sending': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'succeeded': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  const columns = [
    { header: 'ID', accessor: 'id' as const },
    { header: 'Avaliação ID', accessor: 'assessment_id' as const },
    { 
      header: 'Status', 
      accessor: (row: ProcessingJob) => (
        <div className="flex items-center space-x-2">
          {getStatusIcon(row.status)}
          <span className="capitalize">{row.status}</span>
        </div>
      )
    },
    { header: 'Mensagem de Erro', accessor: 'error_message' as const },
    { 
      header: 'Criado em', 
      accessor: (row: ProcessingJob) => new Date(row.created_at).toLocaleString('pt-BR')
    },
    { 
      header: 'Atualizado em', 
      accessor: (row: ProcessingJob) => new Date(row.updated_at).toLocaleString('pt-BR')
    },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Fila de Processamento IA</h1>
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-slate-700">Filtrar por Status:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2 border"
          >
            <option value="">Todos</option>
            <option value="pending">Pendente</option>
            <option value="sending">Enviando</option>
            <option value="succeeded">Concluído</option>
            <option value="failed">Falha</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-500">Carregando...</div>
      ) : (
        <Table
          data={jobs}
          columns={columns}
          actions={(row) => (
            row.status === 'failed' ? (
              <button
                onClick={() => handleReprocess(row.id)}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-amber-600 hover:bg-amber-700"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Reprocessar
              </button>
            ) : null
          )}
        />
      )}
    </div>
  );
}
