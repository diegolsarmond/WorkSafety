import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Plus, Eye, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/ui/components/Button';
import { useInspectionStore } from '../../store/inspectionStore';
import { useSyncStore } from '@/store/syncStore';

export function ReviewPhotos() {
  const navigate = useNavigate();
  const { photos, removePhoto, environment, category, reset } = useInspectionStore();
  const { addJob } = useSyncStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (photos.length === 0) return;

    setIsSubmitting(true);

    try {
      // Adiciona à fila de sincronização
      await addJob(
        {
          title: `Inspection - ${environment} - ${category}`,
          description: `Automated inspection for ${environment} concerning ${category}.`,
          environment,
          category,
          status: 'draft',
        },
        photos
      );

      // Limpa o estado atual (fotos já estão salvas no job)
      reset();

      // Navega para a página de sincronização
      navigate('/inspection/syncing');
    } catch (error) {
      console.error('Error submitting inspection:', error);
      alert('Erro ao enviar inspeção. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="flex items-center justify-between p-4 bg-white shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Review Photos ({photos.length})</h1>
        <button
          onClick={() => navigate('/inspection/camera')}
          className="flex items-center gap-1 text-[#0b6b82] font-bold"
        >
          <Plus className="w-5 h-5" /> Add
        </button>
      </header>

      <main className="flex-1 p-4 overflow-y-auto pb-24">
        <div className="grid grid-cols-2 gap-4">
          {photos.map((photo, index) => (
            <div key={photo.id} className="relative aspect-square rounded-2xl overflow-hidden bg-gray-200 shadow-sm group">
              <img src={photo.dataUrl} alt={`Captured ${index + 1}`} className="w-full h-full object-cover" />

              <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-md">
                #{index + 1}
              </div>

              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                <button className="p-3 bg-white/20 rounded-full backdrop-blur-sm hover:bg-white/30 transition-colors">
                  <Eye className="w-6 h-6 text-white" />
                </button>
                <button
                  onClick={() => removePhoto(photo.id)}
                  className="p-3 bg-red-500/80 rounded-full backdrop-blur-sm hover:bg-red-500 transition-colors"
                >
                  <Trash2 className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>
          ))}

          {photos.length < 10 && (
            <button
              onClick={() => navigate('/inspection/camera')}
              className="aspect-square rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 text-gray-500 hover:bg-gray-50 hover:border-[#0b6b82] hover:text-[#0b6b82] transition-colors"
            >
              <Plus className="w-8 h-8" />
              <span className="font-bold">Add Photo</span>
            </button>
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
        <Button
          onClick={handleSubmit}
          disabled={photos.length === 0 || isSubmitting}
          className="w-full h-14 text-lg rounded-xl bg-[#0b6b82] hover:bg-[#09586b] flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Enviando...
            </>
          ) : (
            <>
              Submit for Analysis <CheckCircle2 className="w-5 h-5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
