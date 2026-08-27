import { create } from 'zustand';
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

export const useUIStore = create<UIState>()((set) => ({
  searchQuery: '',
  typeFilters: [],
  theme: 'dark',
  setSearchQuery: (query) => set({ searchQuery: query }),
  setTypeFilters: (filters) => set({ typeFilters: filters }),
  toggleTypeFilter: (filter) => set((state) => ({
    typeFilters: state.typeFilters.includes(filter)
      ? state.typeFilters.filter((f) => f !== filter)
      : [...state.typeFilters, filter]
  })),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
}));
