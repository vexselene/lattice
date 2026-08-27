import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NodeType } from '../types/graph';

interface UIState {
  searchQuery: string;
  typeFilters: NodeType[];
  theme: 'dark' | 'light';
  setSearchQuery: (query: string) => void;
  setTypeFilters: (filters: NodeType[]) => void;
  toggleTypeFilter: (filter: NodeType) => void;
  toggleTheme: () => void;
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
      theme: getSystemTheme(),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setTypeFilters: (filters) => set({ typeFilters: filters }),
      toggleTypeFilter: (filter) => set((state) => ({
        typeFilters: state.typeFilters.includes(filter)
          ? state.typeFilters.filter((f) => f !== filter)
          : [...state.typeFilters, filter]
      })),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({ theme: state.theme }), // Only persist theme
    }
  )
);
