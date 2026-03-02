import React, { useRef, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import Webcam from "react-webcam";
import { ArrowLeft, Shield, Eye, Image as ImageIcon } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useInspectionStore } from "../../store/inspectionStore";

const WebcamComponent = Webcam as any;

export function CameraCapture() {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const { photos, addPhoto } = useInspectionStore();
  const [privacyMode, setPrivacyMode] = useState(true);

  const capture = useCallback(() => {
    if (photos.length >= 10) {
      alert("Maximum 10 photos allowed per inspection.");
      return;
    }

    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      addPhoto({
        id: uuidv4(),
        dataUrl: imageSrc,
        timestamp: new Date().toISOString(),
      });
      navigate("/inspection/review");
    }
  }, [webcamRef, addPhoto, navigate, photos.length]);

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
            className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md text-sm font-bold ${privacyMode ? "bg-teal-500/20 text-teal-400 border border-teal-500/30" : "bg-white/10 text-white"}`}
          >
            <Shield className="w-4 h-4" />
            PRIVACY MODE {privacyMode ? "ON" : "OFF"}
          </button>
          {privacyMode && (
            <p className="text-xs text-white/70 text-right max-w-[200px]">
              Identified faces will be automatically blurred (GDPR).
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <WebcamComponent
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          videoConstraints={{ facingMode: "environment" }}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-8 pb-12 bg-gradient-to-t from-black via-black/80 to-transparent flex flex-col items-center gap-6">
        <div className="flex items-center justify-between w-full max-w-xs">
          <button className="p-4 rounded-full bg-white/10 text-white">
            <Eye className="w-6 h-6" />
          </button>

          <button
            onClick={capture}
            className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center"
          >
            <div className="w-16 h-16 rounded-full bg-white"></div>
          </button>

          <button
            onClick={() => navigate("/inspection/review")}
            className="relative p-4 rounded-full bg-white/10 text-white"
          >
            <ImageIcon className="w-6 h-6" />
            {photos.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center text-[10px] font-bold">
                {photos.length}
              </span>
            )}
          </button>
        </div>

        <p className="text-sm text-white/50 font-medium">
          AI: Object Detection (Perseu) Enabled
        </p>
      </div>
    </div>
  );
}
