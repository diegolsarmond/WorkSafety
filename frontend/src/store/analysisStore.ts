import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';

export interface Photo {
  id: string;
  dataUrl: string;
  timestamp: string;
}

export interface AnalysisState {
  title: string;
  description: string;
  environment: string;
  category: string;
  photos: Photo[];
  status: 'DRAFT' | 'CAPTURED' | 'SYNCING' | 'SYNCED' | 'ERROR' | 'AI_REVIEWED' | 'HUMAN_VALIDATED' | 'FINALIZED';
  assessmentId: string | null;
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setEnvironment: (env: string) => void;
  setCategory: (cat: string) => void;
  addPhoto: (photo: Photo) => void;
  removePhoto: (id: string) => void;
  setStatus: (status: AnalysisState['status']) => void;
  setAssessmentId: (id: string | null) => void;
  reset: () => void;
}

// Custom storage object for idb-keyval
const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

export const useAnalysisStore = create<AnalysisState>()(
  persist(
    (set) => ({
      title: '',
      description: '',
      environment: '',
      category: 'General Safety',
      photos: [],
      status: 'DRAFT',
      assessmentId: null,
      setTitle: (title) => set({ title }),
      setDescription: (description) => set({ description }),
      setEnvironment: (env) => set({ environment: env }),
      setCategory: (cat) => set({ category: cat }),
      addPhoto: (photo) => set((state) => ({ photos: [...state.photos, photo] })),
      removePhoto: (id) => set((state) => ({ photos: state.photos.filter((p) => p.id !== id) })),
      setStatus: (status) => set({ status }),
      setAssessmentId: (id) => set({ assessmentId: id }),
      reset: () => set({ title: '', description: '', environment: '', category: 'General Safety', photos: [], status: 'DRAFT', assessmentId: null }),
    }),
    {
      name: 'analysis-storage',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);
