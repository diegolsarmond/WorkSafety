import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { env } from '@/config/env';

interface Report {
  id: number;
  assessment: number;
  assessment_title: string;
  status: 'generating' | 'ready' | 'failed';
  file: string | null;
  created_at: string;
  generated_at: string | null;
  generation_time_seconds: number | null;
  error_message: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState<number | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(`${env.API_URL}api/admin/reports/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast({
            title: 'Acesso negado',
            description: 'Você precisa ser administrador para acessar esta página.',
            variant: 'destructive',
          });
          navigate('/home');
          return;
        }
        throw new Error('Falha ao carregar relatórios');
      }

      const data = await response.json();
      setReports(data);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os relatórios.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const regenerateReport = async (assessmentId: number) => {
    try {
      setRegenerating(assessmentId);
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(
        `${env.API_URL}api/admin/assessments/${assessmentId}/regenerate-report/`,
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

      const data = await response.json();
      toast({
        title: 'Sucesso',
        description: 'Geração do relatório iniciada.',
      });
      
      // Recarregar após 3 segundos
      setTimeout(fetchReports, 3000);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível regenerar o relatório.',
        variant: 'destructive',
      });
    } finally {
      setRegenerating(null);
    }
  };

  const downloadReport = (report: Report) => {
    if (report.file) {
      window.open(report.file, '_blank');
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="w-3 h-3 mr-1" />
            Pronto
          </Badge>
        );
      case 'generating':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Gerando...
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <XCircle className="w-3 h-3 mr-1" />
            Falhou
          </Badge>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-600 mt-1">
            Visualize e baixe relatórios PDF das inspeções
          </p>
        </div>
        <Button onClick={fetchReports} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum relatório encontrado
            </h3>
            <p className="text-gray-500 text-center max-w-md">
              Relatórios são gerados automaticamente quando uma inspeção é finalizada,
              ou você pode gerá-los manualmente a partir da página de detalhes da inspeção.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {report.assessment_title || `Inspeção #${report.assessment}`}
                      </h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span>
                          Criado em: {new Date(report.created_at).toLocaleString('pt-BR')}
                        </span>
                        {report.generation_time_seconds && (
                          <span>
                            Tempo de geração: {report.generation_time_seconds.toFixed(2)}s
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

                  <div className="flex items-center gap-4">
                    {getStatusBadge(report.status)}
                    
                    {report.status === 'ready' && report.file && (
                      <Button
                        onClick={() => downloadReport(report)}
                        variant="outline"
                        size="sm"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Baixar PDF
                      </Button>
                    )}
                    
                    {(report.status === 'failed' || report.status === 'ready') && (
                      <Button
                        onClick={() => regenerateReport(report.assessment)}
                        variant="outline"
                        size="sm"
                        disabled={regenerating === report.assessment}
                      >
                        {regenerating === report.assessment ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Regenerar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
