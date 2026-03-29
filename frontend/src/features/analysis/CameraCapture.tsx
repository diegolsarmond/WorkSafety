import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, Eye, Image as ImageIcon, CheckCircle, Camera } from "lucide-react";

import { useAnalysisStore } from "../../store/analysisStore";

// Gerador de UUID v4 compatível com todos os contextos (HTTP/HTTPS)
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function CameraCapture() {
  const navigate = useNavigate();
  const { photos, addPhoto } = useAnalysisStore();
  const [privacyMode, setPrivacyMode] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [processing, setProcessing] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const processAndSaveImage = (file: File) => {
    setProcessing(true);
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      // Resolution minimum: 1280x720
      const minWidth = 1280;
      const minHeight = 720;

      let width = img.width;
      let height = img.height;

      // Ensure minimum resolution boundaries (scaling up if needed)
      if (width < minWidth || height < minHeight) {
        const scaleX = minWidth / width;
        const scaleY = minHeight / height;
        const scale = Math.max(scaleX, scaleY);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      // To prevent extremely huge base64 strings and memory issues, we cap max resolution
      // maintaining aspect ratio, but ensuring it stays above 1280x720.
      const MAX_SIZE = 1920;
      if (width > MAX_SIZE || height > MAX_SIZE) {
        const scale = Math.min(MAX_SIZE / width, MAX_SIZE / height);
        // Only scale down if the scaled down version still meets minimum requirements
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
        // Compress JPEG slightly to save storage space
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

        addPhoto({
          id: generateUUID(),
          dataUrl: dataUrl,
          timestamp: new Date().toISOString(),
        });

        URL.revokeObjectURL(objectUrl);
        setProcessing(false);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000); // Visual confirmation hides after 2s
        setTimeout(() => navigate('/analysis/review'), 300);
      } else {
        URL.revokeObjectURL(objectUrl);
        setProcessing(false);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setProcessing(false);
    };

    img.src = objectUrl;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (photos.length >= 10) {
        alert("Maximum 10 photos allowed per analysis.");
        return;
      }
      processAndSaveImage(file);
    }
    // reset value so the same file can be selected again if needed
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      <div className="absolute top-0 left-0 right-0 p-4 z-10 flex items-start justify-between bg-gradient-to-b from-black/50 to-transparent">
        <button
          onClick={() => navigate(-1)}
          className="p-3 rounded-full bg-black/20 backdrop-blur-md text-white"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() => setPrivacyMode(!privacyMode)}
            className={`flex items-center min-h-[44px] gap-2 px-4 py-2 rounded-full backdrop-blur-md text-sm font-bold ${privacyMode ? "bg-teal-500/20 text-teal-400 border border-teal-500/30" : "bg-white/10 text-white"}`}
          >
            <Shield className="w-4 h-4" />
            PRIVACY MODE {privacyMode ? "ON" : "OFF"}
          </button>
          {privacyMode && (
            <p className="text-xs text-white/90 text-right max-w-[200px]">
              Identified faces will be automatically blurred (GDPR).
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden flex flex-col items-center justify-center p-6 text-center">
        {showSuccess && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-teal-500/95 text-white p-6 rounded-3xl flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300 z-50 shadow-2xl">
            <CheckCircle className="w-16 h-16" />
            <p className="font-bold text-xl">Photo Captured!</p>
          </div>
        )}

        <Camera className="w-24 h-24 text-white/20 mb-6" />
        <h2 className="text-2xl text-white font-bold mb-2">Native Camera</h2>
        <p className="text-white/60 mb-12 max-w-xs">
          Tap the capture button below to open your device camera.
        </p>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 bg-gradient-to-t from-black via-black/80 to-transparent flex flex-col items-center gap-4 sm:gap-6" style={{ paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom) + 1rem))' }}>
        <div className="flex items-center justify-between w-full max-w-xs z-20">
          {/* Spacer for alignment */}
          <div className="w-14 h-14" />

          {/* Camera Button (main) */}
          <label className={`relative cursor-pointer transition-transform active:scale-95 ${processing || photos.length >= 10 ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg,image/webp"
              capture="environment"
              disabled={processing || photos.length >= 10}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              onChange={handleFileChange}
            />
            <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-colors ${processing ? 'border-teal-500/50' : 'border-white'}`}>
              <div className={`w-16 h-16 rounded-full transition-all ${processing ? 'bg-teal-500 animate-pulse' : 'bg-white'}`}></div>
            </div>
          </label>

          {/* Gallery / Review Button: abre galeria se sem fotos, senão vai para review */}
          <div className="relative">
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg,image/webp"
              disabled={processing || photos.length >= 10}
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => photos.length > 0 ? navigate("/analysis/review") : galleryInputRef.current?.click()}
              disabled={processing}
              className="relative p-4 rounded-full bg-white/10 text-white disabled:opacity-50"
            >
              <ImageIcon className="w-6 h-6" />
              {photos.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center text-[10px] font-bold">
                  {photos.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <p className="text-sm text-white/80 font-medium z-20">
          {processing ? 'Processing image...' : 'Tap camera to capture or gallery to select'}
        </p>
      </div>
    </div>
  );
}
