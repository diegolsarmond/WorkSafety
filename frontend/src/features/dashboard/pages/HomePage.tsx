import { Button } from '@/ui/components/Button';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck, Plus, CloudOff, AlertTriangle, Building2, Factory, Box, Brain, Loader2, Clock, CheckCircle2, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiClient } from '@/services/api/apiClient';
import { SyncStatusBadge } from '@/features/sync';
import { ConnectionBadge } from '@/features/pwa';
import { environmentService, assessmentService, EnvironmentType, AssessmentType } from '@/services/environment/environmentService';
import { AIQueueCounts } from '@/features/ai-queue/hooks/useAIQueue';
export default function HomePage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [pendingAssessments, setPendingAssessments] = useState<any[]>([]);
  const [environments, setEnvironments] = useState<EnvironmentType[]>([]);
  const [assessmentTypes, setAssessmentTypes] = useState<AssessmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiQueueCounts, setAiQueueCounts] = useState<AIQueueCounts | null>(null);
  const [loadingAIQueue, setLoadingAIQueue] = useState(true);
  const [readyReportsCount, setReadyReportsCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [assessmentsRes, envs, types] = await Promise.all([
          apiClient.get('assessments/'),
          environmentService.getAll(),
          assessmentService.getAll()
        ]);
        // Show all assessments (not just drafts) - they will be grouped by status
        setPendingAssessments(assessmentsRes.data);
        setEnvironments(envs);
        setAssessmentTypes(types);
      } catch (error) {
        console.error("Failed to fetch assessments or types:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch AI Queue counts
  useEffect(() => {
    const fetchAIQueue = async () => {
      try {
        const response = await apiClient.get('assessments/ai-queue/');
        setAiQueueCounts(response.data.counts);
      } catch (error) {
        console.error("Failed to fetch AI queue:", error);
      } finally {
        setLoadingAIQueue(false);
      }
    };
    fetchAIQueue();
    
    // Poll every 10 seconds
    const interval = setInterval(fetchAIQueue, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch ready reports count
  useEffect(() => {
    const fetchReadyReports = async () => {
      try {
        const response = await apiClient.get('admin/reports/?status=ready');
        const readyReports = Array.isArray(response.data) ? response.data.filter((r: any) => r.status === 'ready').length : 0;
        setReadyReportsCount(readyReports);
      } catch (error) {
        console.error("Failed to fetch reports:", error);
      }
    };
    fetchReadyReports();
    
    // Poll every 15 seconds
    const interval = setInterval(fetchReadyReports, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header - responsive */}
      <header className="bg-white px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-[#1BC5BD] to-[#0B7A90] rounded-lg flex items-center justify-center shadow-sm">
              <ShieldCheck className="text-white w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2} />
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#111827]">
              Work<span className="text-[#0B7A90]">Safety</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap justify-end">
          <SyncStatusBadge onClick={() => navigate('/sync-queue')} />
          <ConnectionBadge />
          <button
            onClick={handleLogout}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 w-full max-w-lg sm:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto">
        {/* Hero Card - responsive */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-[32px] bg-[#0B7A90] p-6 sm:p-8 lg:p-10 text-white shadow-xl shadow-[#0B7A90]/20 mb-6 sm:mb-8">
          <div className="absolute right-0 top-0 opacity-20 pointer-events-none">
            <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M140 40H160V60" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M160 140V160H140" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M60 160H40V140" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M40 60V40H60" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M120 80C120 80 110 100 100 100C90 100 80 80 80 80" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="85" cy="70" r="4" fill="white" />
              <circle cx="115" cy="70" r="4" fill="white" />
              <path d="M170 30L175 25M175 25L180 30M175 25V35" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-8">
            <div>
              <button
                onClick={() => navigate('/inspection/new')}
                className="w-11 h-11 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6 hover:bg-white/30 transition-colors"
              >
                <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </button>
              <h2 className="text-2xl sm:text-[32px] leading-tight font-bold mb-2 sm:mb-3">
                New<br className="sm:hidden" /><span className="hidden sm:inline"> </span>Analysis
              </h2>
              <p className="text-[#85D1DF] text-sm sm:text-[15px] mb-4 sm:mb-8 max-w-[250px] leading-relaxed">
                Start an AI risk analysis.
              </p>
            </div>
            <Button
              onClick={() => navigate('/inspection/new')}
              className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-none rounded-xl sm:rounded-2xl px-6 py-3 h-auto font-semibold w-full sm:w-auto"
            >
              Start Now <span className="ml-2">›</span>
            </Button>
          </div>
        </div>

        {/* Info Cards Row - responsive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {/* AI Processing Queue Card */}
          {!loadingAIQueue && aiQueueCounts && aiQueueCounts.total > 0 && (
            <div 
              onClick={() => navigate('/ai-queue')}
              className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 text-gray-700 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                    <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[13px] sm:text-[14px] text-gray-900">AI Processing Queue</h3>
                    <p className="text-gray-500 text-[11px] sm:text-[12px]">
                      {aiQueueCounts.processing > 0 ? (
                        <span className="flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                          {aiQueueCounts.processing} processing
                        </span>
                      ) : aiQueueCounts.pending > 0 ? (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-yellow-500" />
                          {aiQueueCounts.pending} pending
                        </span>
                      ) : (
                        <span>{aiQueueCounts.total} in queue</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Ready Reports Card */}
          {readyReportsCount > 0 && (
            <div 
              onClick={() => navigate('/admin/reports')}
              className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 text-gray-700 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[13px] sm:text-[14px] text-gray-900">Reports Ready</h3>
                    <p className="text-gray-500 text-[11px] sm:text-[12px]">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        {readyReportsCount} ready for download
                      </span>
                    </p>
                  </div>
                </div>
                <div className="text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Assessments by Status */}
        <div>
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-base sm:text-[19px] font-bold text-[#111827]">My Assessments</h3>
            <span className="px-2.5 sm:px-3 py-1 bg-gray-100 text-[#4B5563] text-[10px] sm:text-[11px] font-bold rounded-full tracking-wider">
              {loading ? "..." : `${pendingAssessments.length} TOTAL`}
            </span>
          </div>

          {loading ? (
            <p className="text-gray-500 text-sm text-center py-8">Loading assessments...</p>
          ) : pendingAssessments.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No assessments yet.</p>
          ) : (
            <div className="space-y-6">
              {/* Group assessments by status */}
              {(() => {
                const statusGroups: Record<string, any[]> = {
                  draft: [],
                  captured: [],
                  synced: [],
                  ai_reviewed: [],
                  human_validated: [],
                  finalized: [],
                  error_ai: [],
                };
                
                pendingAssessments.forEach((a: any) => {
                  if (statusGroups[a.status]) {
                    statusGroups[a.status].push(a);
                  }
                });

                const statusLabels = {
                  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-600', icon: '📝' },
                  captured: { label: 'Captured', color: 'bg-blue-100 text-blue-600', icon: '📸' },
                  synced: { label: 'Synced', color: 'bg-purple-100 text-purple-600', icon: '☁️' },
                  ai_reviewed: { label: 'AI Reviewed', color: 'bg-indigo-100 text-indigo-600', icon: '🤖' },
                  human_validated: { label: 'Validated', color: 'bg-green-100 text-green-600', icon: '✅' },
                  finalized: { label: 'Finalized', color: 'bg-gray-800 text-white', icon: '🎯' },
                  error_ai: { label: 'Error', color: 'bg-red-100 text-red-600', icon: '⚠️' },
                };

                return Object.entries(statusGroups).map(([status, assessments]) => 
                  assessments.length > 0 && (
                    <div key={status}>
                      <div className="flex items-center gap-2 mb-3 px-1">
                        <span className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold ${statusLabels[status as keyof typeof statusLabels]?.color || 'bg-gray-100'}`}>
                          {statusLabels[status as keyof typeof statusLabels]?.label || status}
                        </span>
                        <span className="text-[11px] sm:text-xs text-gray-500">
                          {assessments.length} {assessments.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                      {/* Responsive assessment cards grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {assessments.map((assessment) => {
                          // Parse 'Inspection - Environment - Category'
                          const parts = assessment.title.split(' - ');
                          const environmentId = parts[1] || 'Unknown';
                          const categoryRaw = parts[2] || 'Unknown';

                          const envObj = environments.find(e => e.id.toString() === environmentId);
                          const environmentName = envObj ? envObj.name : environmentId;

                          const typeObj = assessmentTypes.find(t => t.id.toString() === categoryRaw);
                          const categoryName = typeObj ? typeObj.name : categoryRaw;

                          const dateObj = new Date(assessment.created_at);
                          const day = String(dateObj.getDate()).padStart(2, '0');
                          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                          const formattedDate = `${day}/${month}`;

                          let Icon = Building2;
                          let bgClass = "bg-[#FFF3E0]";
                          let textClass = "text-[#F57C00]";

                          if (environmentName.toLowerCase().includes('construction') || environmentName.toLowerCase().includes('obra')) {
                            Icon = Building2;
                            bgClass = "bg-[#FFF3E0]";
                            textClass = "text-[#F57C00]";
                          } else if (environmentName.toLowerCase().includes('industry') || environmentName.toLowerCase().includes('indústria')) {
                            Icon = Factory;
                            bgClass = "bg-[#E3F2FD]";
                            textClass = "text-[#1976D2]";
                          } else {
                            Icon = Box;
                            bgClass = "bg-[#F3F4F6]";
                            textClass = "text-[#4B5563]";
                          }

                          return (
                            <div 
                              key={assessment.id} 
                              onClick={() => navigate(`/inspection/${assessment.id}`)}
                              className="bg-white rounded-2xl sm:rounded-[24px] p-4 sm:p-5 shadow-sm border border-gray-100 flex items-center justify-between transition-transform active:scale-[0.97] cursor-pointer hover:shadow-md hover:border-gray-200"
                            >
                              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                <div className={`w-11 h-11 sm:w-[52px] sm:h-[52px] rounded-xl sm:rounded-2xl ${bgClass} flex items-center justify-center ${textClass} shrink-0`}>
                                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-bold text-[#111827] text-[14px] sm:text-[16px] capitalize truncate">{environmentName}</h4>
                                  <p className="text-[12px] sm:text-[13px] text-[#4B5563] font-medium truncate">{categoryName}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[12px] sm:text-[13px] text-gray-500 flex items-center gap-1.5">
                                      <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                      {formattedDate}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <div className={`w-2 h-2 rounded-full ${status === 'finalized' || status === 'human_validated' ? 'bg-green-500' : status === 'error_ai' ? 'bg-red-500' : status === 'ai_reviewed' ? 'bg-indigo-500' : status === 'synced' ? 'bg-purple-500' : 'bg-gray-300'}`}></div>
                                    <span className={`text-[12px] sm:text-[13px] font-semibold ${status === 'finalized' || status === 'human_validated' ? 'text-green-600' : status === 'error_ai' ? 'text-red-600' : status === 'ai_reviewed' ? 'text-indigo-600' : status === 'synced' ? 'text-purple-600' : 'text-gray-500'}`}>
                                      {statusLabels[status as keyof typeof statusLabels]?.label || status}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-[#F5A623] shrink-0 ml-2">
                                {status === 'draft' && <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />}
                                {status === 'error_ai' && <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />}
                                {(status === 'captured' || status === 'synced') && <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />}
                                {status === 'ai_reviewed' && <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />}
                                {(status === 'human_validated' || status === 'finalized') && <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )
                );
              })()}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
