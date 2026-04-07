import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Check,
  Loader2,
  AlertCircle,
  RefreshCw,
  List,
  Home,
} from "lucide-react";
import { Button } from '@/ui/components/Button';
import { useSyncQueue } from '@/hooks/sync/useSyncQueue';
import { SyncJob } from '@/types/sync';
import { SyncStorage } from '@/services/sync/syncStorage';
import { useAnalysisStore } from '@/store/analysisStore';
import { cn } from '@/utils/cn';

export function Syncing() {
  const navigate = useNavigate();
  const { jobs, refresh } = useSyncQueue();
  const { setAssessmentId } = useAnalysisStore();

  const [currentJob, setCurrentJob] = useState<SyncJob | null>(null);

  // Intercept back button to avoid navigation loop
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => navigate('/home', { replace: true });
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate]);

  useEffect(() => {
    if (jobs.length > 0 && !currentJob) {
      const mostRecent = jobs.reduce((latest, job) =>
        job.createdAt > latest.createdAt ? job : latest
      );
      setCurrentJob(mostRecent);
    }

    if (currentJob) {
      const updated = jobs.find(j => j.id === currentJob.id);
      if (updated) {
        setCurrentJob(updated);
      } else {
        SyncStorage.getAllJobs().then(allJobs => {
          const found = allJobs.find(j => j.id === currentJob.id);
          if (found) setCurrentJob(found);
        });
      }
    }
  }, [jobs, currentJob]);

  // Store assessmentId when job completes (but no auto-redirect)
  useEffect(() => {
    if (currentJob?.status === 'COMPLETED') {
      const assessmentId = currentJob.assessmentId || currentJob.id;
      setAssessmentId(assessmentId);
    }
  }, [currentJob, setAssessmentId]);

  const handleRetry = () => { if (currentJob) refresh(); };
  const handleGoToQueue = () => {
    const assessmentId = currentJob?.assessmentId || currentJob?.id;
    if (assessmentId) {
      navigate(`/analysis/${assessmentId}`);
    } else {
      navigate('/sync-queue');
    }
  };
  const handleGoHome = () => navigate('/home', { replace: true });

  const isCompleted = currentJob?.status === 'COMPLETED';
  const hasError = currentJob?.status === 'ERROR' || currentJob?.status === 'FAILED';

  if (!currentJob) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
        <Loader2 className="w-12 h-12 animate-spin text-[#0B7A90]" />
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 sm:p-8 relative">
      {/* Error toast */}
      {hasError && (
        <div className="fixed top-4 left-4 right-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-lg z-50 flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold">Sync Error</h3>
            <p className="text-sm mt-1">
              Failed to sync <strong>{currentJob.assessmentDraft.title}</strong>.
              {currentJob.lastError && <span className="block mt-1 text-red-600">{currentJob.lastError}</span>}
            </p>
            <p className="text-sm mt-2">
              Attempt {currentJob.retryCount} of {currentJob.maxRetries}.
              {currentJob.status === 'FAILED' && <span className="block mt-1">Retrying automatically...</span>}
            </p>
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="w-full max-w-sm flex flex-col items-center text-center gap-4">
        {/* Icon */}
        <div className="w-24 h-24 rounded-full bg-emerald-50 border-4 border-emerald-200 flex items-center justify-center mb-2">
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        </div>

        {/* Headings */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Photos submitted!</h2>
          <p className="text-base font-semibold text-[#0B7A90] mt-1 truncate max-w-xs">
            {currentJob.assessmentDraft.title}
          </p>
          <p className="text-sm text-gray-500 mt-3 leading-relaxed">
            Your photos are queued for analysis. You'll be notified when they're ready for review.
          </p>
        </div>

        {/* Status pipeline */}
        <div className="flex items-start gap-2 mt-2 w-full justify-center">
          {/* Uploaded */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-bold text-emerald-600">Uploaded</span>
          </div>

          <div className={cn("flex-1 h-0.5 mt-4 max-w-[40px]", isCompleted ? "bg-emerald-400" : "bg-gray-200")} />

          {/* Processing */}
          <div className="flex flex-col items-center gap-1.5">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              isCompleted ? "bg-emerald-500" : "bg-gray-200"
            )}>
              {isCompleted
                ? <Check className="w-4 h-4 text-white" />
                : <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
              }
            </div>
            <span className={cn("text-xs font-bold", isCompleted ? "text-emerald-600" : "text-gray-400")}>
              Processing
            </span>
          </div>

          <div className="flex-1 h-0.5 mt-4 bg-gray-200 max-w-[40px]" />

          {/* Reviewing */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-gray-300 block" />
            </div>
            <span className="text-xs font-bold text-gray-400">Reviewing</span>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div
        className="fixed bottom-0 left-0 right-0 p-4 sm:p-6 space-y-3"
        style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom) + 1rem))' }}
      >
        <div className="max-w-sm mx-auto space-y-3">
          {hasError && currentJob.status === 'ERROR' && (
            <Button
              onClick={handleRetry}
              className="w-full h-12 text-base rounded-xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" /> Try again
            </Button>
          )}

          <Button
            onClick={handleGoToQueue}
            className="w-full h-12 text-base rounded-xl bg-[#0B7A90] hover:bg-[#096375] text-white flex items-center justify-center gap-2"
          >
            <List className="w-5 h-5" /> Review Analysis Status
          </Button>

          <Button
            onClick={handleGoHome}
            variant="outline"
            className="w-full h-12 text-base rounded-xl flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" /> Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
