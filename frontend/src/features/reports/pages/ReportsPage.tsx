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
const API_BASE = (import.meta.env.VITE_API_URL || 'http://200.152.38.136:8000/api/').replace(/\/$/, '');

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
          setError('Access denied. You need administrator permissions.');
          return;
        }
        throw new Error('Failed to load reports');
      }

      const data = await response.json();
      setReports(data);
    } catch (err) {
      setError('Unable to load reports. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const regenerateReport = async (assessmentId: number) => {
    try {
      setRegenerating(assessmentId);
      const token = SecureStorage.getItem('auth_token');
      
      // Remove old failed report for this assessment before regenerating
      setReports((prev) => prev.filter((r) => !(r.assessment_id === assessmentId && r.status === 'failed')));
      
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
        throw new Error('Failed to regenerate report');
      }

      setTimeout(fetchReports, 3000);
    } catch (err) {
      alert('Unable to regenerate report. Please try again.');
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
        return 'Ready';
      case 'generating':
        return 'Generating...';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  };

  const formatDuration = (seconds: number | null): string => {
    if (seconds === null || seconds === undefined) return '';
    if (seconds < 1) {
      return `${(seconds * 1000).toFixed(0)}ms`;
    }
    return `${seconds.toFixed(2)}s`;
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
      {/* Header - Responsive */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button 
                onClick={handleBack}
                className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
              </button>
              <div className="min-w-0 overflow-hidden">
                <h1 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 truncate">
                  Reports
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block truncate">
                  View and download PDF inspection reports
                </p>
              </div>
            </div>
            <Button 
              onClick={fetchReports}
              variant="outline"
              className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-2.5 sm:px-4 py-1.5 sm:py-2 flex-shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Refresh</span>
              <span className="sm:hidden">Update</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content - Responsive */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        {error && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 sm:gap-3">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {reports.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border p-6 sm:p-8 lg:p-12 text-center">
            <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-1 sm:mb-2">
              No reports found
            </h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Reports are automatically generated when an inspection is completed,
              or you can generate them manually from the inspection details page.
            </p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {reports.map((report) => (
              <div 
                key={report.id} 
                className="bg-white rounded-lg shadow-sm border p-3 sm:p-4 lg:p-6 hover:shadow-md transition-shadow"
              >
                {/* Mobile Layout */}
                <div className="flex flex-col gap-3 sm:hidden">
                  {/* Top Row: Icon + Title + Status */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-50 rounded-lg flex-shrink-0">
                      <FileText className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm truncate">
                        Inspection #{report.assessment_id || report.assessment}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(report.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(report.status)}`}>
                      {getStatusIcon(report.status)}
                      {getStatusText(report.status)}
                    </span>
                  </div>

                  {/* Error Message */}
                  {report.error_message && (
                    <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span className="break-words">{report.error_message}</span>
                    </div>
                  )}

                  {/* Generation Time */}
                  {report.generation_time_seconds !== null && report.generation_time_seconds !== undefined && (
                    <p className="text-xs text-gray-500">
                      Duration: {formatDuration(report.generation_time_seconds)}
                    </p>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-1">
                    {report.status === 'ready' && report.file_url && (
                      <Button
                        onClick={() => downloadReport(report)}
                        variant="outline"
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download PDF
                      </Button>
                    )}
                    
                    {report.status === 'failed' && (
                      <Button
                        onClick={() => regenerateReport((report.assessment_id || report.assessment) as number)}
                        variant="outline"
                        disabled={regenerating === (report.assessment_id || report.assessment)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2"
                      >
                        {regenerating === (report.assessment_id || report.assessment) ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        Regenerate
                      </Button>
                    )}
                  </div>
                </div>

                {/* Tablet & Desktop Layout */}
                <div className="hidden sm:flex sm:items-start sm:justify-between gap-4">
                  <div className="flex items-start gap-3 lg:gap-4 flex-1 min-w-0">
                    <div className="p-2.5 lg:p-3 bg-emerald-50 rounded-lg flex-shrink-0">
                      <FileText className="w-5 h-5 lg:w-6 lg:h-6 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm lg:text-base">
                        Inspection #{report.assessment_id || report.assessment}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs lg:text-sm text-gray-500">
                        <span>
                          Created: {new Date(report.created_at).toLocaleString('en-US')}
                        </span>
                        {report.generation_time_seconds !== null && report.generation_time_seconds !== undefined && (
                          <span>
                            Duration: {formatDuration(report.generation_time_seconds)}
                          </span>
                        )}
                      </div>
                      {report.error_message && (
                        <div className="flex items-start gap-2 mt-2 text-xs lg:text-sm text-red-600 bg-red-50 p-2 rounded">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span className="break-words">{report.error_message}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-1 rounded-full text-xs lg:text-sm font-medium ${getStatusBadgeClass(report.status)}`}>
                      {getStatusIcon(report.status)}
                      {getStatusText(report.status)}
                    </span>
                    
                    <div className="flex gap-2">
                      {report.status === 'ready' && report.file_url && (
                        <Button
                          onClick={() => downloadReport(report)}
                          variant="outline"
                          className="flex items-center gap-1.5 text-xs lg:text-sm"
                        >
                          <Download className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                          <span className="hidden lg:inline">Download PDF</span>
                          <span className="lg:hidden">Download</span>
                        </Button>
                      )}
                      
                      {report.status === 'failed' && (
                        <Button
                          onClick={() => regenerateReport((report.assessment_id || report.assessment) as number)}
                          variant="outline"
                          disabled={regenerating === (report.assessment_id || report.assessment)}
                          className="flex items-center gap-1.5 text-xs lg:text-sm"
                        >
                          {regenerating === (report.assessment_id || report.assessment) ? (
                            <Loader2 className="w-3.5 h-3.5 lg:w-4 lg:h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                          )}
                          <span className="hidden lg:inline">Regenerate</span>
                          <span className="lg:hidden">Retry</span>
                        </Button>
                      )}
                    </div>
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
