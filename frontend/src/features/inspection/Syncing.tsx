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
import { Button } from "../../ui/Button";

export function Syncing() {
  const navigate = useNavigate();
  const { setStatus } = useInspectionStore();
  const [step, setStep] = useState(0);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setStatus("SYNCING");
    setError(false);

    const timer1 = setTimeout(() => setStep(1), 2000);

    // Simulate network error on first try
    const timer2 = setTimeout(() => {
      if (retryCount === 0) {
        setError(true);
        setStatus("ERROR");
      } else {
        setStep(2);
      }
    }, 4000);

    let timer3: NodeJS.Timeout;
    if (retryCount > 0) {
      timer3 = setTimeout(() => {
        setStatus("AI_REVIEWED");
        navigate("/inspection/risks");
      }, 6000);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      if (timer3) clearTimeout(timer3);
    };
  }, [navigate, setStatus, retryCount]);

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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="w-32 h-32 bg-white rounded-full shadow-sm flex items-center justify-center mb-12 relative">
        {!error && (
          <>
            <div className="absolute inset-0 border-4 border-teal-100 rounded-full animate-pulse"></div>
            <div className="absolute inset-0 border-4 border-teal-500 rounded-full border-t-transparent animate-spin"></div>
          </>
        )}
        {error && (
          <div className="absolute inset-0 border-4 border-red-500 rounded-full"></div>
        )}
        <ImageIcon
          className={`w-12 h-12 ${error ? "text-red-500" : "text-gray-300"}`}
        />
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
            className="w-full h-14 text-lg rounded-xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" /> Retry Sync
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
