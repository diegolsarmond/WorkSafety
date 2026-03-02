import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';

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
      storage: createJSONStorage(() => idbStorage),
    }
  )
);
