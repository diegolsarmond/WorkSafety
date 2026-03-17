import React, { useEffect, useState } from 'react';
import { Table } from '../components/Table';
import { RefreshCw, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fetchWithToken } from '../services/api';

interface ProcessingJob {
  id: number;
  assessment_id: number;
  assessment_title: string;
  status: string;
  status_display: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
  confidence: string | null;
  model_version: string | null;
}

export default function ProcessingQueue() {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const { t } = useTranslation();

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const url = filter ? `admin/processing-jobs/?status=${filter}` : 'admin/processing-jobs/';
      const res = await fetchWithToken(url);
      const data = await res.json();
      
      // Handle both paginated and non-paginated responses
      const jobsData = Array.isArray(data) ? data : (data.results || []);
      setJobs(jobsData);
    } catch (error) {
      console.error('Failed to fetch', error);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    
    // Auto-refresh a cada 5 segundos
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [filter]);

  const handleReprocess = async (id: number) => {
    if (confirm(t('Deseja reprocessar esta avaliação?'))) {
      try {
        await fetchWithToken(`admin/processing-jobs/${id}/reprocess/`, { method: 'POST' });
        fetchJobs();
      } catch (error) {
        console.error('Failed to reprocess', error);
      }
    }
  };

  const getStatusIcon = (status: string) => {
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case 'pending': return <Clock className="h-4 w-4 text-amber-500" />;
      case 'running': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'succeeded': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  const columns = [
    { header: 'ID', accessor: 'id' as const, className: 'whitespace-nowrap w-16' },
    { header: t('Avaliação'), accessor: 'assessment_title' as const, className: 'min-w-[150px] max-w-xs break-words' },
    { header: 'Av. ID', accessor: 'assessment_id' as const, className: 'whitespace-nowrap w-16' },
    { 
      header: 'Status', 
      className: 'whitespace-nowrap w-24',
      accessor: (row: ProcessingJob) => (
        <div className="flex items-center gap-1">
          {getStatusIcon(row.status)}
          <span className="capitalize text-xs sm:text-sm truncate">{t(row.status_display || row.status)}</span>
        </div>
      )
    },
    { header: t('Confiança'), accessor: 'confidence' as const, className: 'whitespace-nowrap w-24 text-center' },
    { header: t('Erro'), accessor: 'error_message' as const, className: 'min-w-[150px] max-w-sm break-words text-red-600 text-xs' },
    { 
      header: t('Criado'), 
      className: 'whitespace-nowrap w-32',
      accessor: (row: ProcessingJob) => {
        const date = new Date(row.created_at);
        return <span className="text-xs sm:text-sm">{date.toLocaleString('pt-BR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>;
      }
    },
    { 
      header: t('Iniciado'), 
      className: 'whitespace-nowrap w-32',
      accessor: (row: ProcessingJob) => row.started_at ? <span className="text-xs sm:text-sm">{new Date(row.started_at).toLocaleString('pt-BR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span> : '-'
    },
    { 
      header: t('Finalizado'), 
      className: 'whitespace-nowrap w-32',
      accessor: (row: ProcessingJob) => row.finished_at ? <span className="text-xs sm:text-sm">{new Date(row.finished_at).toLocaleString('pt-BR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span> : '-'
    },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto min-h-screen bg-slate-50">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6 mb-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900">{t('Fila de Processamento IA')}</h1>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <label className="text-xs sm:text-sm font-medium text-slate-700 whitespace-nowrap py-2 px-2 sm:px-0">{t('Status:')}</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-md border border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-xs sm:text-sm p-2 bg-white"
            >
              <option value="">{t('Todos')}</option>
              <option value="pending">{t('Pendente')}</option>
              <option value="running">{t('Processando')}</option>
              <option value="succeeded">{t('Sucesso')}</option>
              <option value="failed">{t('Falha')}</option>
            </select>
          </div>
          <button
            onClick={fetchJobs}
            disabled={loading}
            className="p-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1 sm:gap-0"
            title={t('Atualizar')}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="sm:hidden text-xs">{t('Atualizar')}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 sm:py-16 text-slate-500 bg-white rounded-lg border border-slate-200">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin" />
            <span className="text-sm sm:text-base">{t('Carregando...')}</span>
          </div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex items-center justify-center py-12 sm:py-16 text-slate-500 bg-white rounded-lg border border-slate-200">
          <p className="text-sm sm:text-base">{t('Nenhum job de processamento encontrado')}</p>
        </div>
      ) : (
        <Table
          data={jobs}
          columns={columns}
          actions={(row) => (
            row.status === 'failed' ? (
              <button
                onClick={() => handleReprocess(row.id)}
                className="inline-flex items-center px-2 sm:px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-amber-600 hover:bg-amber-700 whitespace-nowrap"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">{t('Reprocessar')}</span>
                <span className="sm:hidden">{t('Rep.')}</span>
              </button>
            ) : null
          )}
        />
      )}
    </div>
  );
}
