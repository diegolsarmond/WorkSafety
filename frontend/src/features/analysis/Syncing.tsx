import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
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

/**
 * Página de sincronização
 * 
 * Monitora o status do job recém-criado e mostra progresso.
 * Redireciona automaticamente quando completo.
 */
export function Syncing() {
  const navigate = useNavigate();
  const { jobs, refresh } = useSyncQueue();
  const { setAssessmentId } = useAnalysisStore();
  
  // Encontra o job mais recente (que acabamos de criar)
  const [currentJob, setCurrentJob] = useState<SyncJob | null>(null);
  const [showAllJobs, setShowAllJobs] = useState(false);

  // Intercepta o botão voltar do dispositivo para evitar loop de navegação
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      navigate('/home', { replace: true });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate]);

  useEffect(() => {
    // Pega o job mais recente
    if (jobs.length > 0 && !currentJob) {
      const mostRecent = jobs.reduce((latest, job) => 
        job.createdAt > latest.createdAt ? job : latest
      );
      setCurrentJob(mostRecent);
    }

    // Atualiza o job atual se ele ainda existir na lista
    if (currentJob) {
      const updated = jobs.find(j => j.id === currentJob.id);
      if (updated) {
        setCurrentJob(updated);
      } else {
        // Job desapareceu da lista filtrada - busca diretamente no storage
        // Isso acontece quando o job transita para COMPLETED
        SyncStorage.getAllJobs().then(allJobs => {
          const found = allJobs.find(j => j.id === currentJob.id);
          if (found) {
            setCurrentJob(found);
          }
        });
      }
    }
  }, [jobs, currentJob]);

  // Redireciona quando completado
  useEffect(() => {
    if (currentJob?.status === 'COMPLETED') {
      const timer = setTimeout(() => {
        // Armazena o assessmentId no store para uso posterior
        const assessmentId = currentJob.assessmentId || currentJob.id;
        setAssessmentId(assessmentId);
        
        // Passa o assessmentId para a tela de riscos
        // replace: true para evitar loop no botão voltar
        navigate("/analysis/risks", {
          replace: true,
          state: { 
            assessmentId: assessmentId
          }
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentJob, navigate, setAssessmentId]);

  const handleRetry = () => {
    if (currentJob) {
      refresh();
    }
  };

  const handleGoToQueue = () => {
    navigate('/sync-queue');
  };

  const handleGoHome = () => {
    navigate('/home', { replace: true });
  };

  // Determina o estado atual
  const isCompleted = currentJob?.status === 'COMPLETED';
  const hasError = currentJob?.status === 'ERROR' || currentJob?.status === 'FAILED';

  if (!currentJob) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
        <Loader2 className="w-12 h-12 animate-spin text-[#0b6b82]" />
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 sm:p-8 relative">
      {/* ERROR NOTIFICATION */}
      {hasError && (
        <div className="fixed top-4 left-4 right-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-lg z-50 flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold">Sync Error</h3>
            <p className="text-sm mt-1">
              Failed to sync <strong>{currentJob.assessmentDraft.title}</strong>.
              {currentJob.lastError && (
                <span className="block mt-1 text-red-600">{currentJob.lastError}</span>
              )}
            </p>
            <p className="text-sm mt-2">
              Attempt {currentJob.retryCount} of {currentJob.maxRetries}.
              {currentJob.status === 'FAILED' && (
                <span className="block mt-1">Retrying automatically...</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* SUCCESS NOTIFICATION */}
      {isCompleted && (
        <div className="fixed top-4 left-4 right-4 bg-emerald-100 border-l-4 border-emerald-500 text-emerald-800 p-4 rounded shadow-lg z-50 flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold">Sync Completed</h3>
            <p className="text-sm mt-1">
              <strong>{currentJob.assessmentDraft.title}</strong> successfully synced.
              Redirecting...
            </p>
          </div>
        </div>
      )}

      {/* Ícone principal */}
      <div className="w-32 h-32 bg-white rounded-full shadow-sm flex items-center justify-center mb-12 relative">
        {!hasError && !isCompleted && (
          <>
            <div className="absolute inset-0 border-4 border-teal-100 rounded-full animate-pulse"></div>
            <div className="absolute inset-0 border-4 border-teal-500 rounded-full border-t-transparent animate-spin"></div>
          </>
        )}
        {(hasError || isCompleted) && (
          <div className={`absolute inset-0 border-4 rounded-full ${isCompleted ? 'border-emerald-500' : 'border-red-500'}`}></div>
        )}
        {isCompleted ? (
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        ) : (
          <ImageIcon className={`w-12 h-12 ${hasError ? "text-red-500" : "text-gray-300"}`} />
        )}
      </div>

      {/* Mensagem principal */}
      <div className="w-full max-w-sm text-center space-y-3">
        {hasError ? (
          <>
            <h2 className="text-xl font-bold text-red-600">Sync Failed</h2>
            <p className="text-sm text-red-400">
              {currentJob.status === 'ERROR'
                ? 'Max retries reached. Please try manually.'
                : `Retrying automatically... (${currentJob.retryCount}/${currentJob.maxRetries})`}
            </p>
          </>
        ) : isCompleted ? (
          <>
            <h2 className="text-xl font-bold text-emerald-700">Upload completed</h2>
            <p className="text-sm text-gray-500">Your assessment is ready. Redirecting...</p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-teal-900">Thank you for uploading your photos.</h2>
            <p className="text-sm text-gray-500">This assessment analysis will be completed shortly.</p>
          </>
        )}
      </div>

      {/* Botões de ação */}
      <div className="fixed bottom-0 left-0 right-0 p-4 sm:p-8 space-y-3" style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom) + 1rem))' }}>
        <div className="max-w-sm mx-auto space-y-3">
        {hasError && currentJob.status === 'ERROR' && (
          <Button
            onClick={handleRetry}
            className="w-full h-14 text-lg rounded-xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <RefreshCw className="w-5 h-5" /> Try again
          </Button>
        )}

        <Button
          onClick={handleGoToQueue}
          variant="outline"
          className="w-full h-14 text-lg rounded-xl flex items-center justify-center gap-2"
        >
          <List className="w-5 h-5" /> View sync queue
        </Button>

        <Button
          onClick={handleGoHome}
          variant="outline"
          className="w-full h-14 text-lg rounded-xl flex items-center justify-center gap-2"
        >
          <Home className="w-5 h-5" /> Back to Home
        </Button>

        {isCompleted && (
          <Button
            onClick={() => {
              const assessmentId = currentJob?.assessmentId || currentJob?.id;
              setAssessmentId(assessmentId);
              navigate("/analysis/risks", {
                replace: true,
                state: { 
                  assessmentId: assessmentId
                }
              });
            }}
            className="w-full h-14 text-lg rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center font-bold transition-all active:scale-95 shadow-lg shadow-emerald-500/30"
          >
            Continue
          </Button>
        )}
        </div>
      </div>
    </div>
  );
}
