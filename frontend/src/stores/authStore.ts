import { create } from 'zustand';
import { useCanvasStore } from './canvasStore';
import { useGraphStore } from './graphStore';
import { useUIStore } from './uiStore';

interface AuthState {
  isSetup: boolean;
  isUnlocked: boolean;
  autoLockMinutes: number;
  setSetup: (val: boolean) => void;
  setUnlocked: (val: boolean) => void;
  setAutoLock: (minutes: number) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isSetup: false,
  isUnlocked: false,
  autoLockMinutes: 15,
  setSetup: (val) => set({ isSetup: val }),
  setUnlocked: (val) => set({ isUnlocked: val }),
  setAutoLock: (minutes) => set({ autoLockMinutes: minutes }),
  logout: () => {
    useCanvasStore.getState().resetCanvasState();
    useGraphStore.getState().resetGraph();
    useUIStore.getState().resetCanvasUI();
    set({ isUnlocked: false });
  },
}));
