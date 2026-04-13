import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  X,
  ShieldCheck,
  Info,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/ui/components/Button";
import { useAnalysisStore } from "../../store/analysisStore";
import { apiClient } from "@/services/api/apiClient";
import { dataURLtoFile } from "@/utils/syncUtils";

const TIPS_KEY = "worksafety:camera_tips_shown";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const TIPS = [
  "Ensure the area is well-lit and clearly visible.",
  "Include the full hazard zone in the frame.",
  "Hold the camera steady and avoid blur.",
  "Multiple photos improve analysis accuracy.",
];

export function CameraCapture() {
  const navigate = useNavigate();
  const { photos, addPhoto, removePhoto, environment, category, title, description, reset } = useAnalysisStore();

  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [showTipsModal, setShowTipsModal] = useState(false);
  const [pendingCameraOpen, setPendingCameraOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleCameraButtonClick = () => {
    if (processing || photos.length >= 10) return;
    const shown = localStorage.getItem(TIPS_KEY);
    if (!shown) {
      setShowTipsModal(true);
      setPendingCameraOpen(true);
    } else {
      cameraInputRef.current?.click();
    }
  };

  const handleTipsDismiss = () => {
    localStorage.setItem(TIPS_KEY, "true");
    setShowTipsModal(false);
    if (pendingCameraOpen) {
      setPendingCameraOpen(false);
      // Small delay so modal unmounts before triggering file input (iOS Safari)
      setTimeout(() => cameraInputRef.current?.click(), 100);
    }
  };

  const processAndSaveImage = (file: File) => {
    setProcessing(true);
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      if (img.width < 10 || img.height < 10) {
        URL.revokeObjectURL(objectUrl);
        setProcessing(false);
        showToast("This image does not meet the app's usage policies. Please try a different photo.");
        return;
      }

      const minWidth = 1280;
      const minHeight = 720;
      let width = img.width;
      let height = img.height;

      if (width < minWidth || height < minHeight) {
        const scale = Math.max(minWidth / width, minHeight / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const MAX_SIZE = 1920;
      if (width > MAX_SIZE || height > MAX_SIZE) {
        const scale = Math.min(MAX_SIZE / width, MAX_SIZE / height);
        if (width * scale >= minWidth && height * scale >= minHeight) {
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        addPhoto({ id: generateUUID(), dataUrl, timestamp: new Date().toISOString() });
        URL.revokeObjectURL(objectUrl);
        setProcessing(false);
      } else {
        URL.revokeObjectURL(objectUrl);
        setProcessing(false);
        showToast("Failed to process image. Please try again.");
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setProcessing(false);
      showToast("This image does not meet the app's usage policies. Please try a different photo.");
    };

    img.src = objectUrl;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (photos.length >= 10) {
        showToast("Maximum 10 photos allowed per analysis.");
        return;
      }
      processAndSaveImage(file);
    }
    e.target.value = "";
  };

  const handleSubmit = async () => {
    if (photos.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const computedTitle = title.trim() || `Analysis - ${environment} - ${category}`;

      // Step 1: Create the assessment
      const createResponse = await apiClient.post("assessments/", {
        title: computedTitle,
        description: description.trim() || `Automated analysis for ${environment} concerning ${category}.`,
        status: "draft",
      });
      const assessmentId = createResponse.data.id;

      // Step 2: Upload photos as evidences
      const formData = new FormData();
      photos.forEach((photo) => {
        const file = dataURLtoFile(photo.dataUrl, `evidence_${photo.id}.jpg`);
        formData.append("images", file);
        formData.append("timestamps", photo.timestamp);
      });
      await apiClient.post(`assessments/${assessmentId}/evidences/`, formData, {
        timeout: 60000,
        headers: { "Content-Type": undefined },
      });

      // Step 3: Transition to CAPTURED
      await apiClient.post(`assessments/${assessmentId}/capture/`, {});

      // Step 4: Transition to SYNCED (triggers AI analysis)
      await apiClient.post(`assessments/${assessmentId}/sync/`, {});

      reset();
      // Navigate to syncing screen — assessment ID is passed via state so
      // "Review Analysis Status" can go directly to /analysis/{id}
      navigate("/analysis/syncing", {
        replace: true,
        state: { assessmentId, title: computedTitle },
      });
    } catch (error) {
      console.error("Error submitting analysis:", error);
      showToast("Failed to submit photos. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-red-600 text-white px-4 py-3 rounded-2xl shadow-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold">Image not accepted</p>
            <p className="text-xs mt-0.5 text-white/90">{toastMessage}</p>
          </div>
          <button onClick={() => setToastMessage(null)} className="ml-auto flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tips Modal */}
      {showTipsModal && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4"
          onClick={() => setShowTipsModal(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-sm p-6 flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center">
                <Info className="w-6 h-6 text-[#0B7A90]" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Tips for good photos</h2>
              <p className="text-sm text-gray-500">Better photos lead to more accurate results.</p>
            </div>

            <ul className="space-y-3">
              {TIPS.map((tip) => (
                <li key={tip} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#0B7A90] flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">{tip}</span>
                </li>
              ))}
            </ul>

            <Button
              onClick={handleTipsDismiss}
              className="w-full h-12 bg-[#0B7A90] hover:bg-[#096375] text-white rounded-2xl"
            >
              Got it, continue
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center p-4 bg-white shadow-sm gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2.5 -ml-2 rounded-full hover:bg-gray-100 flex items-center justify-center min-w-[44px] min-h-[44px]"
        >
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 font-medium">Select Photos</p>
          <h1 className="text-base font-bold text-gray-900 truncate">{title || "New Analysis"}</h1>
        </div>
        <button className="p-2 rounded-full hover:bg-gray-100 min-w-[44px] min-h-[44px] flex items-center justify-center">
          <Info className="w-5 h-5 text-gray-400" />
        </button>
      </header>

      {/* Stepper bar */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-400 text-xs font-bold flex items-center justify-center">1</div>
        <div className="w-6 h-6 rounded-full bg-[#0B7A90] text-white text-xs font-bold flex items-center justify-center">2</div>
        <span className="text-sm text-gray-500 ml-1">Step 2 of 2 — Select Photos</span>
      </div>

      {/* Hidden file input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/jpg,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Main content */}
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto pb-28 max-w-lg sm:max-w-xl lg:max-w-2xl mx-auto w-full">
        <p className="text-xs font-bold text-gray-500 tracking-wider mb-3 uppercase flex items-center gap-2">
          Recent Photos
        </p>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {/* Camera cell */}
          {photos.length < 10 && (
            <button
              onClick={handleCameraButtonClick}
              disabled={processing}
              className="aspect-square rounded-2xl bg-white border-2 border-dashed border-[#0B7A90]/40 flex flex-col items-center justify-center gap-1.5 text-[#0B7A90] active:scale-95 transition-transform disabled:opacity-50 shadow-sm"
            >
              {processing ? (
                <Loader2 className="w-7 h-7 animate-spin" />
              ) : (
                <>
                  <Camera className="w-7 h-7" />
                  <span className="text-xs font-bold">Camera</span>
                </>
              )}
            </button>
          )}

          {/* Photo thumbnails */}
          {photos.map((photo) => (
            <div key={photo.id} className="relative aspect-square rounded-2xl overflow-hidden bg-gray-200 shadow-sm">
              <img src={photo.dataUrl} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removePhoto(photo.id)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center active:scale-95"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          ))}
        </div>

        {/* Privacy notice */}
        <div className="mt-4 flex items-start gap-2 bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#0B7A90]" />
          <p className="text-xs text-gray-500 leading-relaxed">
            <span className="font-semibold text-gray-700">Privacy protected.</span>{" "}
            Faces in photos are automatically anonymized before any processing.
          </p>
        </div>
      </main>

      {/* Footer CTA */}
      <div
        className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-lg sm:max-w-xl lg:max-w-2xl mx-auto">
          <Button
            onClick={handleSubmit}
            disabled={photos.length === 0 || isSubmitting}
            className={`w-full h-12 sm:h-14 text-base sm:text-lg rounded-xl transition-all flex items-center justify-center gap-2 ${
              photos.length === 0
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-[#0B7A90] hover:bg-[#096375] text-white"
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Submitting...
              </>
            ) : photos.length === 0 ? (
              "Select at least 1 photo"
            ) : (
              `Analyze Photos (${photos.length}) →`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
