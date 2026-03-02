import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useInspectionStore } from "../../store/inspectionStore";
import { Button } from '@/ui/components/Button';
import { apiClient } from '@/services/api/apiClient';

export function Syncing() {
  const navigate = useNavigate();
  const { photos, setStatus, environment, category } = useInspectionStore();
  const [step, setStep] = useState(0);
  const [error, setError] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const assessmentName = `Inspection - ${environment} - ${category}`;

  // Helper function to convert dataUrl to File
  const dataURLtoFile = (dataurl: string, filename: string) => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  useEffect(() => {
    let isMounted = true;

    const syncPhotos = async () => {
      if (!isMounted) return;
      setStatus("SYNCING");
      setError(false);
      setSyncSuccess(false);
      setStep(0);

      try {
        // Step 1: Create Assessment and Upload photos
        if (photos.length > 0) {
          // First create the assessment
          const createResponse = await apiClient.post('/assessments/', {
            title: assessmentName,
            description: `Automated inspection for ${environment} concerning ${category}.`,
            status: 'draft'
          });
          const assessmentId = createResponse.data.id;

          const formData = new FormData();
          photos.forEach((photo, index) => {
            const file = dataURLtoFile(photo.dataUrl, `evidence_${photo.id}.jpg`);
            formData.append('images', file);
            formData.append('timestamps', photo.timestamp);
          });

          // Upload evidences to the new assessment
          await apiClient.post(`/assessments/${assessmentId}/evidences/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }

        if (!isMounted) return;
        setStep(1);

        // Step 2 & 3: Mock AI analysis (since backend AI parts are not fully implemented yet)
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (!isMounted) return;
        setStep(2);

        await new Promise(resolve => setTimeout(resolve, 2000));
        if (!isMounted) return;

        setStatus("AI_REVIEWED");
        setSyncSuccess(true);
        setStep(3); // Finished all steps

        // Wait to show the success notification before navigating
        setTimeout(() => {
          if (isMounted) {
            navigate("/inspection/risks");
          }
        }, 3000);

      } catch (err) {
        console.error("Sync error:", err);
        if (!isMounted) return;
        setError(true);
        setStatus("ERROR");
      }
    };

    syncPhotos();

    return () => {
      isMounted = false;
    };
  }, [navigate, setStatus, retryCount, photos, assessmentName, environment, category]);

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
    setStep(0);
  };

  const steps = [
    { label: "Syncing...", desc: "" },
    { label: "Visual Analysis (Perseu AI)", desc: "Detecting PPE & Risks..." },
    { label: "Regulatory Check (Sofia NLP)", desc: "Mapping Bau-Wegweiser..." },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8 relative">

      {/* ERROR NOTIFICATION (F21.2) */}
      {error && (
        <div className="fixed top-4 left-4 right-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-lg z-50 flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold">Erro de Sincronização</h3>
            <p className="text-sm mt-1">
              Falha ao sincronizar a avaliação <strong>{assessmentName}</strong>.
              Por favor, verifique sua conexão e clique em <em>Tentar Novamente</em>.
            </p>
          </div>
        </div>
      )}

      {/* SUCCESS NOTIFICATION (F21.1) */}
      {syncSuccess && (
        <div className="fixed top-4 left-4 right-4 bg-emerald-100 border-l-4 border-emerald-500 text-emerald-800 p-4 rounded shadow-lg z-50 flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold">Sincronização Concluída</h3>
            <p className="text-sm mt-1">
              <strong>1</strong> avaliação sincronizada com sucesso.
              Redirecionando...
            </p>
          </div>
        </div>
      )}

      <div className="w-32 h-32 bg-white rounded-full shadow-sm flex items-center justify-center mb-12 relative">
        {!error && !syncSuccess && (
          <>
            <div className="absolute inset-0 border-4 border-teal-100 rounded-full animate-pulse"></div>
            <div className="absolute inset-0 border-4 border-teal-500 rounded-full border-t-transparent animate-spin"></div>
          </>
        )}
        {(error || syncSuccess) && (
          <div className={`absolute inset-0 border-4 rounded-full ${syncSuccess ? 'border-emerald-500' : 'border-red-500'}`}></div>
        )}
        {syncSuccess ? (
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        ) : (
          <ImageIcon className={`w-12 h-12 ${error ? "text-red-500" : "text-gray-300"}`} />
        )}
      </div>

      <div className="w-full max-w-sm space-y-6">
        {steps.map((s, i) => (
          <div
            key={i}
            className={`flex items-start gap-4 transition-opacity duration-500 ${i <= step ? "opacity-100" : "opacity-30"}`}
          >
            <div className="mt-1">
              {i < step && !error ? (
                <CheckCircle2 className="w-6 h-6 text-teal-600" />
              ) : i === step && !error ? (
                <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
              ) : i === step && error ? (
                <AlertCircle className="w-6 h-6 text-red-500" />
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
              )}
            </div>
            <div>
              <h3
                className={`font-bold ${i <= step && !error ? "text-teal-900" : i === step && error ? "text-red-600" : "text-gray-400"}`}
              >
                {i === step && error ? "Sync Failed" : s.label}
              </h3>
              {s.desc && !error && (
                <p className="text-sm text-gray-400">{s.desc}</p>
              )}
              {i === step && error && (
                <p className="text-sm text-red-400">
                  Network error. Please try again.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-8 left-8 right-8">
        {error ? (
          <Button
            onClick={handleRetry}
            className="w-full h-14 text-lg rounded-xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <RefreshCw className="w-5 h-5" /> Tentar Novamente
          </Button>
        ) : syncSuccess ? (
          <Button
            onClick={() => navigate("/inspection/risks")}
            className="w-full h-14 text-lg rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center font-bold transition-all active:scale-95 shadow-lg shadow-emerald-500/30"
          >
            Continuar
          </Button>
        ) : (
          <div className="w-full bg-gray-200 rounded-xl h-14 flex items-center justify-center font-bold text-gray-500">
            Processando...
          </div>
        )}
      </div>
    </div>
  );
}
