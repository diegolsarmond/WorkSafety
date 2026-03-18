import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
  AlertCircle,
  RefreshCw,
  List,
} from "lucide-react";
import { Button } from '@/ui/components/Button';
import { useSyncQueue } from '@/hooks/sync/useSyncQueue';
import { SyncJob } from '@/types/sync';
import { SyncStorage } from '@/services/sync/syncStorage';
import { useInspectionStore } from '@/store/inspectionStore';

/**
 * Página de sincronização
 * 
 * Monitora o status do job recém-criado e mostra progresso.
 * Redireciona automaticamente quando completo.
 */
export function Syncing() {
  const navigate = useNavigate();
  const { jobs, isProcessing, refresh } = useSyncQueue();
  const { setAssessmentId } = useInspectionStore();
  
  // Encontra o job mais recente (que acabamos de criar)
  const [currentJob, setCurrentJob] = useState<SyncJob | null>(null);
  const [showAllJobs, setShowAllJobs] = useState(false);

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
        navigate("/inspection/risks", {
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

  // Determina o estado atual
  const isCompleted = currentJob?.status === 'COMPLETED';
  const hasError = currentJob?.status === 'ERROR' || currentJob?.status === 'FAILED';
  const isSyncing = currentJob?.status === 'SYNCING' || (isProcessing && !hasError);
  const isPending = currentJob?.status === 'PENDING';

  // Configuração dos steps
  const steps = [
    { 
      label: "Uploading photos...", 
      desc: `Sending ${currentJob?.photos.length || 0} photos to server`,
      condition: isSyncing || isPending || isCompleted
    },
    { 
      label: "Visual Analysis (Perseu AI)", 
      desc: "Detecting PPE & Risks...",
      condition: isSyncing || isCompleted
    },
    { 
      label: "Regulatory Check (Sofia NLP)", 
      desc: "Mapping Bau-Wegweiser...",
      condition: isCompleted
    },
  ];

  // Determina qual step está ativo
  const getActiveStep = () => {
    if (isCompleted) return 3;
    if (isSyncing) return 1;
    if (isPending) return 0;
    return 0;
  };

  const activeStep = getActiveStep();

  if (!currentJob) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
        <Loader2 className="w-12 h-12 animate-spin text-[#0b6b82]" />
        <p className="mt-4 text-gray-600">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8 relative">
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
              Tentativa {currentJob.retryCount} de {currentJob.maxRetries}.
              {currentJob.status === 'FAILED' && (
                <span className="block mt-1">Tentando novamente automaticamente...</span>
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

      {/* Steps */}
      <div className="w-full max-w-sm space-y-6">
        {steps.map((s, i) => (
          <div
            key={i}
            className={`flex items-start gap-4 transition-opacity duration-500 ${
              i < activeStep ? "opacity-100" : 
              i === activeStep ? "opacity-100" : 
              "opacity-30"
            }`}
          >
            <div className="mt-1">
              {i < activeStep && !hasError ? (
                <CheckCircle2 className="w-6 h-6 text-teal-600" />
              ) : i === activeStep && !hasError ? (
                <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
              ) : i === activeStep && hasError ? (
                <AlertCircle className="w-6 h-6 text-red-500" />
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
              )}
            </div>
            <div>
              <h3
                className={`font-bold ${
                  i < activeStep && !hasError ? "text-teal-900" : 
                  i === activeStep && hasError ? "text-red-600" : 
                  i === activeStep ? "text-teal-900" : 
                  "text-gray-400"
                }`}
              >
                {i === activeStep && hasError ? "Sync Failed" : s.label}
              </h3>
              {s.desc && !hasError && (
                <p className="text-sm text-gray-400">{s.desc}</p>
              )}
              {i === activeStep && hasError && (
                <p className="text-sm text-red-400">
                  {currentJob.status === 'ERROR' 
                    ? 'Max retries reached. Please try manually.' 
                    : `Retrying automatically... (${currentJob.retryCount}/${currentJob.maxRetries})`}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Botões de ação */}
      <div className="fixed bottom-8 left-8 right-8 space-y-3">
        {hasError && currentJob.status === 'ERROR' && (
          <Button
            onClick={handleRetry}
            className="w-full h-14 text-lg rounded-xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <RefreshCw className="w-5 h-5" /> Tentar novamente
          </Button>
        )}

        <Button
          onClick={handleGoToQueue}
          variant="outline"
          className="w-full h-14 text-lg rounded-xl flex items-center justify-center gap-2"
        >
          <List className="w-5 h-5" /> View sync queue
        </Button>

        {isCompleted && (
          <Button
            onClick={() => {
              const assessmentId = currentJob?.assessmentId || currentJob?.id;
              setAssessmentId(assessmentId);
              navigate("/inspection/risks", {
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
  );
}
