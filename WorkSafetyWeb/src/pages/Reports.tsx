import React, { useEffect, useState } from 'react';
import { Table } from '../components/Table';
import { Download, RefreshCw, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fetchWithToken } from '../services/api';

interface Report {
  id: number;
  assessment_id: number;
  status: string;
  file_url: string | null;
  created_at: string;
}

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetchWithToken('/api/admin/reports/');
      const data = await res.json();
      setReports(data);
    } catch (error) {
      console.error('Failed to fetch', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleRegenerate = async (assessmentId: number) => {
    if (confirm(t('Deseja regenerar o relatório para esta avaliação?'))) {
      try {
        await fetchWithToken(`/api/admin/assessments/${assessmentId}/generate-report/`, { method: 'POST' });
        fetchReports();
      } catch (error) {
        console.error('Failed to regenerate', error);
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'generating': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'ready': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  const columns = [
    { header: 'ID', accessor: 'id' as const },
    { header: t('Avaliação ID'), accessor: 'assessment_id' as const },
    { 
      header: 'Status', 
      accessor: (row: Report) => (
        <div className="flex items-center space-x-2">
          {getStatusIcon(row.status)}
          <span className="capitalize">{row.status}</span>
        </div>
      )
    },
    { 
      header: t('Criado em'), 
      accessor: (row: Report) => new Date(row.created_at).toLocaleString('pt-BR')
    },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{t('Relatórios')}</h1>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-500">{t('Carregando...')}</div>
      ) : (
        <Table
          data={reports}
          columns={columns}
          actions={(row) => (
            <div className="flex justify-end space-x-2">
              {row.status === 'ready' && (
                <a
                  href={row.file_url || '#'}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-emerald-600 hover:bg-emerald-700"
                >
                  <Download className="h-3 w-3 mr-1" />
                  {t('Download')}
                </a>
              )}
              {row.status === 'failed' && (
                <button
                  onClick={() => handleRegenerate(row.assessment_id)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-amber-600 hover:bg-amber-700"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {t('Regenerar')}
                </button>
              )}
            </div>
          )}
        />
      )}
    </div>
  );
}
