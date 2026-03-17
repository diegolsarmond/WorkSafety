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
      const res = await fetchWithToken('admin/reports/');
      
      // Check if response is successful
      if (!res.ok) {
        console.error(`API Error: ${res.status} ${res.statusText}`);
        setReports([]);
        return;
      }
      
      const data = await res.json();
      
      // Ensure data is an array
      if (Array.isArray(data)) {
        setReports(data);
      } else {
        console.error('Expected array of reports, got:', data);
        setReports([]);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleRegenerate = async (assessmentId: number) => {
    if (confirm(t('Do you want to regenerate the report for this assessment?'))) {
      try {
        await fetchWithToken(`admin/assessments/${assessmentId}/generate-report/`, { method: 'POST' });
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
    { header: t('Assessment ID'), accessor: 'assessment_id' as const },
    { 
      header: 'Status', 
      accessor: (row: Report) => (
        <div className="flex items-center space-x-2">
          {getStatusIcon(row.status)}
          <span className="capitalize font-medium text-slate-700">{row.status}</span>
        </div>
      )
    },
    { 
      header: t('Created At'), 
      accessor: (row: Report) => new Date(row.created_at).toLocaleString('en-US')
    },
  ];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto min-h-screen bg-slate-50/50">
      <div className="flex justify-between items-center mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{t('Reports')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('Manage and download safety reports')}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <RefreshCw className="h-8 w-8 animate-spin text-emerald-500 mb-4" />
          <p className="text-sm font-medium animate-pulse">{t('Loading...')}</p>
        </div>
      ) : (
        <>
          {/* Mobile View */}
          <div className="md:hidden space-y-4">
            {reports.map((row) => (
              <div key={row.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col space-y-4 transition-all hover:shadow-md">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Report #{row.id}</span>
                    <div className="text-base font-semibold text-slate-900">Assessment: {row.assessment_id}</div>
                  </div>
                  <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                    {getStatusIcon(row.status)}
                    <span className="text-xs font-semibold capitalize text-slate-700">{row.status}</span>
                  </div>
                </div>
                
                <div className="text-sm text-slate-500 flex items-center bg-slate-50/50 p-2 rounded-lg">
                  <Clock className="w-4 h-4 mr-2 text-slate-400" />
                  {new Date(row.created_at).toLocaleString('en-US')}
                </div>
                
                <div className="pt-2 flex justify-end">
                  {row.status === 'ready' && (
                    <a
                      href={row.file_url || '#'}
                      className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-bold rounded-xl shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-colors w-full justify-center focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {t('Download')}
                    </a>
                  )}
                  {row.status === 'failed' && (
                    <button
                      onClick={() => handleRegenerate(row.assessment_id)}
                      className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-bold rounded-xl shadow-sm text-white bg-amber-500 hover:bg-amber-600 transition-colors w-full justify-center focus:ring-2 focus:ring-offset-2 focus:ring-amber-400"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {t('Regenerate')}
                    </button>
                  )}
                  {row.status !== 'ready' && row.status !== 'failed' && (
                     <div className="px-4 py-2.5 w-full text-center text-sm font-medium text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                        {t('Processing...')}
                     </div>
                  )}
                </div>
              </div>
            ))}
            {reports.length === 0 && (
              <div className="text-center py-12 px-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
                <div className="bg-slate-50 p-4 rounded-full mb-4">
                  <AlertCircle className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-1">{t('No reports')}</h3>
                <p className="text-sm text-slate-500">{t('There are no safety reports currently available.')}</p>
              </div>
            )}
          </div>

          {/* Desktop View */}
          <div className="hidden md:block">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <Table
                data={reports}
                columns={columns}
                actions={(row) => (
                  <div className="flex justify-end space-x-3">
                    {row.status === 'ready' && (
                      <a
                        href={row.file_url || '#'}
                        className="inline-flex items-center px-3.5 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-all focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                      >
                        <Download className="h-4 w-4 mr-1.5" />
                        {t('Download')}
                      </a>
                    )}
                    {row.status === 'failed' && (
                      <button
                        onClick={() => handleRegenerate(row.assessment_id)}
                        className="inline-flex items-center px-3.5 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-amber-500 hover:bg-amber-600 transition-all focus:ring-2 focus:ring-offset-2 focus:ring-amber-400"
                      >
                        <RefreshCw className="h-4 w-4 mr-1.5" />
                        {t('Regenerate')}
                      </button>
                    )}
                  </div>
                )}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

