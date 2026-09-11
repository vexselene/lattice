import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NodeType } from '../types/graph';

interface UIState {
  searchQuery: string;
  typeFilters: NodeType[];
  tagFilters: string[];
  serviceFilters: string[];
  theme: 'dark' | 'light';
  isEditMode: boolean;
  setSearchQuery: (query: string) => void;
  setTypeFilters: (filters: NodeType[]) => void;
  toggleTagFilter: (tag: string) => void;
  clearTagFilters: () => void;
  toggleServiceFilter: (service: string) => void;
  clearServiceFilters: () => void;
  toggleTypeFilter: (filter: NodeType) => void;
  toggleTheme: () => void;
  toggleEditMode: () => void;
  resetCanvasUI: () => void;
}

const getSystemTheme = (): 'dark' | 'light' => {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      searchQuery: '',
      typeFilters: [],
      tagFilters: [],
      serviceFilters: [],
      theme: getSystemTheme(),
      isEditMode: false,
      setSearchQuery: (query) => set({ searchQuery: query }),
      setTypeFilters: (filters) => set({ typeFilters: filters }),
      toggleTagFilter: (tag) => set((state) => ({
        tagFilters: state.tagFilters.includes(tag)
          ? state.tagFilters.filter((t) => t !== tag)
          : [...state.tagFilters, tag]
      })),
      clearTagFilters: () => set({ tagFilters: [] }),
      toggleServiceFilter: (service) => set((state) => ({
        serviceFilters: state.serviceFilters.includes(service)
          ? state.serviceFilters.filter((s) => s !== service)
          : [...state.serviceFilters, service]
      })),
      clearServiceFilters: () => set({ serviceFilters: [] }),
      toggleTypeFilter: (filter) => set((state) => ({
        typeFilters: state.typeFilters.includes(filter)
          ? state.typeFilters.filter((f) => f !== filter)
          : [...state.typeFilters, filter]
      })),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      toggleEditMode: () => set((state) => ({ isEditMode: !state.isEditMode })),
      resetCanvasUI: () => set({
        searchQuery: '',
        typeFilters: [],
        tagFilters: [],
        serviceFilters: [],
        isEditMode: false,
      }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({ theme: state.theme }), // Only persist theme
    }
  )
);
