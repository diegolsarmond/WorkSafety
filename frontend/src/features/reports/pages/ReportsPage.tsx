import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Clock,
  ArrowLeft,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/ui/components/Button';
import { SecureStorage } from '@/services/storage/secureStorage';

interface Report {
  id: number;
  assessment_id?: number;
  assessment?: number;
  status: 'generating' | 'ready' | 'failed';
  file_url: string | null;
  created_at: string;
  generated_at: string | null;
  generation_time_seconds: number | null;
  error_message: string;
}

// API base URL - remove trailing slash to avoid duplication
const API_BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/').replace(/\/$/, '');

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchReports = async () => {
    try {
      setError(null);
      const token = SecureStorage.getItem('auth_token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(`${API_BASE}/admin/reports/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          setError('Acesso negado. Você precisa ser administrador.');
          return;
        }
        throw new Error('Falha ao carregar relatórios');
      }

      const data = await response.json();
      setReports(data);
    } catch (err) {
      setError('Não foi possível carregar os relatórios.');
    } finally {
      setLoading(false);
    }
  };

  const regenerateReport = async (assessmentId: number) => {
    try {
      setRegenerating(assessmentId);
      const token = SecureStorage.getItem('auth_token');
      
      const response = await fetch(
        `${API_BASE}/admin/assessments/${assessmentId}/regenerate-report/`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Falha ao regenerar relatório');
      }

      setTimeout(fetchReports, 3000);
    } catch (err) {
      alert('Não foi possível regenerar o relatório.');
    } finally {
      setRegenerating(null);
    }
  };

  const downloadReport = (report: Report) => {
    if (report.file_url) {
      window.open(report.file_url, '_blank');
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'generating':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'ready':
        return 'bg-emerald-100 text-emerald-700';
      case 'generating':
        return 'bg-blue-100 text-blue-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ready':
        return 'Pronto';
      case 'generating':
        return 'Gerando...';
      case 'failed':
        return 'Falhou';
      default:
        return status;
    }
  };

  const handleBack = () => {
    navigate('/home');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button 
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Relatórios</h1>
                <p className="text-sm text-gray-500">
                  Visualize e baixe relatórios PDF das inspeções
                </p>
              </div>
            </div>
            <Button 
              onClick={fetchReports}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {reports.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum relatório encontrado
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Relatórios são gerados automaticamente quando uma inspeção é finalizada,
              ou você pode gerá-los manualmente a partir da página de detalhes da inspeção.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div 
                key={report.id} 
                className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-emerald-50 rounded-lg">
                      <FileText className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {`Inspeção #${report.assessment_id || report.assessment}`}
                      </h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span>
                          Criado em: {new Date(report.created_at).toLocaleString('pt-BR')}
                        </span>
                        {report.generation_time_seconds && (
                          <span>
                            Tempo: {report.generation_time_seconds.toFixed(2)}s
                          </span>
                        )}
                      </div>
                      {report.error_message && (
                        <div className="flex items-center gap-2 mt-2 text-sm text-red-600">
                          <AlertCircle className="w-4 h-4" />
                          {report.error_message}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(report.status)}`}>
                      {getStatusIcon(report.status)}
                      {getStatusText(report.status)}
                    </span>
                    
                    {report.status === 'ready' && report.file_url && (
                      <Button
                        onClick={() => downloadReport(report)}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Baixar PDF
                      </Button>
                    )}
                    
                    {(report.status === 'failed' || report.status === 'ready') && (
                      <Button
                        onClick={() => regenerateReport((report.assessment_id || report.assessment) as number)}
                        variant="outline"
                        disabled={regenerating === (report.assessment_id || report.assessment)}
                        className="flex items-center gap-2"
                      >
                        {regenerating === (report.assessment_id || report.assessment) ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        Regenerar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
