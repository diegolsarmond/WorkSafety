import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, ChevronRight, X } from 'lucide-react';
import { Button } from '@/ui/components/Button';
import { useAnalysisStore } from '@/store/analysisStore';

export function ReviewValidation() {
  const navigate = useNavigate();
  const { photos, setStatus, assessmentId } = useAnalysisStore();
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const handleSave = () => {
    setStatus('HUMAN_VALIDATED');
    navigate('/home');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="flex items-center justify-between p-4 bg-white shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 mr-8">Review</h1>
      </header>

      <main className="flex-1 p-4 overflow-y-auto pb-24">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#0b6b82]">Case</h2>
          <span className="text-2xl font-black text-gray-900">
            #{assessmentId || 'N/A'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          {photos.map((photo, index) => (
            <div 
              key={photo.id} 
              onClick={() => setExpandedImage(photo.dataUrl)}
              className="relative aspect-square rounded-2xl overflow-hidden bg-gray-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
            >
              <img src={photo.dataUrl} alt={`Captured ${index + 1}`} className="w-full h-full object-cover" />
              <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-md">
                #{index + 1}
              </div>
            </div>
          ))}
        </div>

        <div className="mb-4">
          <h2 className="text-sm font-bold text-gray-500 tracking-wider mb-4">ANALYSIS RESULT</h2>

          <button
            onClick={() => navigate('/analysis/risks', {
              state: { assessmentId }
            })}
            className="w-full bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <span className="text-xl font-bold text-gray-900">View Risks</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
              <ChevronRight className="w-6 h-6 text-gray-400" />
            </div>
          </button>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
        <Button
          onClick={handleSave}
          className="w-full h-14 text-lg rounded-xl bg-[#0b6b82] hover:bg-[#09586b]"
        >
          Save Validation
        </Button>
      </div>

      {expandedImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <button 
            onClick={() => setExpandedImage(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
          <img 
            src={expandedImage} 
            alt="Expanded preview" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" 
          />
        </div>
      )}
    </div>
  );
}
