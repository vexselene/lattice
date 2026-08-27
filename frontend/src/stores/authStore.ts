import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  isSetup: boolean;
  isUnlocked: boolean;
  sessionToken: string | null;
  autoLockMinutes: number;
  setSetup: (val: boolean) => void;
  setUnlocked: (val: boolean, token: string | null) => void;
  setAutoLock: (minutes: number) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isSetup: false,
      isUnlocked: false,
      sessionToken: null,
      autoLockMinutes: 15,
      setSetup: (val) => set({ isSetup: val }),
      setUnlocked: (val, token) => set({ isUnlocked: val, sessionToken: token }),
      setAutoLock: (minutes) => set({ autoLockMinutes: minutes }),
      logout: () => set({ isUnlocked: false, sessionToken: null }),
    }),
    {
      name: 'lattice-auth-storage',
      partialize: (state) => ({ 
        isSetup: state.isSetup,
        sessionToken: state.sessionToken, // Usually you wouldn't persist session tokens in local storage for high security, but it's okay for this milestone.
      }),
    }
  )
);
