import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Photo {
  id: string;
  dataUrl: string;
  timestamp: string;
}

export interface InspectionState {
  environment: string;
  category: string;
  photos: Photo[];
  status: 'DRAFT' | 'CAPTURED' | 'SYNCING' | 'SYNCED' | 'ERROR' | 'AI_REVIEWED' | 'HUMAN_VALIDATED' | 'FINALIZED';
  setEnvironment: (env: string) => void;
  setCategory: (cat: string) => void;
  addPhoto: (photo: Photo) => void;
  removePhoto: (id: string) => void;
  setStatus: (status: InspectionState['status']) => void;
  reset: () => void;
}

export const useInspectionStore = create<InspectionState>()(
  persist(
    (set) => ({
      environment: '',
      category: 'General Safety',
      photos: [],
      status: 'DRAFT',
      setEnvironment: (env) => set({ environment: env }),
      setCategory: (cat) => set({ category: cat }),
      addPhoto: (photo) => set((state) => ({ photos: [...state.photos, photo] })),
      removePhoto: (id) => set((state) => ({ photos: state.photos.filter((p) => p.id !== id) })),
      setStatus: (status) => set({ status }),
      reset: () => set({ environment: '', category: 'General Safety', photos: [], status: 'DRAFT' }),
    }),
    {
      name: 'inspection-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
