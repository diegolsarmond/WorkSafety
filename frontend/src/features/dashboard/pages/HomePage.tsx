import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck, AlertTriangle, Brain, Loader2, Clock, CheckCircle2, ChevronRight, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiClient } from '@/services/api/apiClient';
import { SyncStatusBadge } from '@/features/sync';
import { ConnectionBadge } from '@/features/pwa';
import { AIQueueCounts } from '@/features/ai-queue/hooks/useAIQueue';

export default function HomePage() {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const [pendingAssessments, setPendingAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiQueueCounts, setAiQueueCounts] = useState<AIQueueCounts | null>(null);
  const [loadingAIQueue, setLoadingAIQueue] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const assessmentsRes = await apiClient.get('assessments/');
        setPendingAssessments(assessmentsRes.data);
      } catch (error) {
        console.error('Failed to fetch assessments:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchAIQueue = async () => {
      try {
        const response = await apiClient.get('assessments/ai-queue/');
        setAiQueueCounts(response.data.counts);
      } catch (error) {
        console.error('Failed to fetch AI queue:', error);
      } finally {
        setLoadingAIQueue(false);
      }
    };
    fetchAIQueue();
    const interval = setInterval(fetchAIQueue, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const pendingReviewsCount = pendingAssessments.filter(a => a.status === 'ai_reviewed').length;
  const validatedCount = pendingAssessments.filter(a => a.status === 'human_validated' || a.status === 'finalized').length;
  const syncingCount = pendingAssessments.filter(a => a.status === 'synced' || a.status === 'captured').length;
  const processingCount = !loadingAIQueue && aiQueueCounts ? aiQueueCounts.total : syncingCount;

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* Header */}
      <header className="bg-white px-4 py-3 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gradient-to-br from-[#1BC5BD] to-[#0B7A90] rounded-xl flex items-center justify-center shadow-sm">
            <ShieldCheck className="text-white w-5 h-5" strokeWidth={2} />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-[#111827]">
            Work<span className="text-[#0B7A90]">Safety</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <SyncStatusBadge onClick={() => navigate('/sync-queue')} />
          <ConnectionBadge />
          <button
            onClick={handleLogout}
            className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-5 max-w-lg mx-auto">
        {/* Hero Card */}
        <div
          className="relative overflow-hidden rounded-3xl bg-[#0B7A90] text-white shadow-xl shadow-[#0B7A90]/20 mb-4 cursor-pointer"
          onClick={() => navigate('/analysis/new')}
        >
          <div className="px-8 pt-10 pb-6 flex flex-col items-center text-center">
            <h2 className="text-4xl font-bold mb-8">New Analysis</h2>
            <button
              className="w-full bg-[#0A6678] hover:bg-[#085A6B] active:bg-[#074F5E] rounded-2xl py-4 px-6 text-white font-semibold text-base flex items-center justify-center gap-2 transition-colors"
              onClick={e => { e.stopPropagation(); navigate('/analysis/new'); }}
            >
              Start Now <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="space-y-3">
          {/* Pending Reviews */}
          <div
            onClick={() => navigate('/assessments?tab=pending')}
            className="bg-white rounded-2xl p-4 border border-amber-100 shadow-sm cursor-pointer hover:bg-amber-50/30 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-[#111827] text-base">Pending Reviews</h3>
                <p className="text-gray-600 text-sm">
                  {loading ? '...' : `${pendingReviewsCount} items awaiting your validation`}
                </p>
                {!loading && syncingCount > 0 && (
                  <p className="text-gray-400 text-xs flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {syncingCount} more in queue or syncing
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!loading && pendingReviewsCount > 0 && (
                  <span className="w-8 h-8 rounded-full bg-amber-500 text-white text-sm font-bold flex items-center justify-center">
                    {pendingReviewsCount}
                  </span>
                )}
                <ChevronRight className="w-5 h-5 text-amber-400" />
              </div>
            </div>
          </div>

          {/* Validated Analyses */}
          <div
            onClick={() => navigate('/assessments?tab=done')}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-[#111827] text-base">Validated Analyses</h3>
                <p className="text-gray-600 text-sm">
                  {loading ? '...' : `${validatedCount} reports ready to view`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 text-sm font-bold flex items-center justify-center">
                  {loading ? '–' : validatedCount}
                </span>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Processing Queue */}
          <div
            onClick={() => navigate('/ai-queue')}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center shrink-0">
                {!loadingAIQueue && aiQueueCounts && aiQueueCounts.processing > 0 ? (
                  <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
                ) : (
                  <Timer className="w-6 h-6 text-gray-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-[#111827] text-base">Processing Queue</h3>
                <p className="text-gray-600 text-sm">
                  {loadingAIQueue ? '...' : `${processingCount} ${processingCount === 1 ? 'item' : 'items'} in queue`}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
