import { create } from 'zustand';
import {
  listCanvases as apiListCanvases,
  createCanvas as apiCreateCanvas,
  openCanvas as apiOpenCanvas,
  closeCanvas as apiCloseCanvas,
  renameCanvas as apiRenameCanvas,
  duplicateCanvas as apiDuplicateCanvas,
  changeCanvasPassword as apiChangeCanvasPassword,
  deleteCanvas as apiDeleteCanvas,
  exportCanvas as apiExportCanvas,
  importCanvas as apiImportCanvas,
  formatErrorMessage,
} from '../api/canvas';
import type { CanvasSummary } from '../api/canvas';

export interface CanvasState {
  canvases: CanvasSummary[];
  unlockingCanvas: CanvasSummary | null;
  activeCanvasId: string | null;
  closingCanvasId: string | null;
  isLoadingCanvases: boolean;
  error: string | null;

  fetchCanvases: () => Promise<void>;
  createCanvas: (name: string, password: string) => Promise<CanvasSummary>;
  openCanvas: (id: string, password: string) => Promise<void>;
  closeCanvas: () => Promise<void>;
  setUnlockingCanvas: (canvas: CanvasSummary | null) => void;
  setClosingCanvasId: (id: string | null) => void;
  renameCanvas: (id: string, newName: string) => Promise<void>;
  duplicateCanvas: (id: string, originalPassword: string, newPassword?: string) => Promise<void>;
  changeCanvasPassword: (id: string, oldPassword: string, newPassword: string) => Promise<void>;
  deleteCanvas: (id: string, password: string) => Promise<void>;
  exportCanvas: (id: string) => Promise<void>;
  importCanvas: () => Promise<void>;
  setError: (error: string | null) => void;
  resetCanvasState: () => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  canvases: [],
  unlockingCanvas: null,
  activeCanvasId: null,
  closingCanvasId: null,
  isLoadingCanvases: false,
  error: null,

  setUnlockingCanvas: (canvas) => set({ unlockingCanvas: canvas }),
  setClosingCanvasId: (id) => set({ closingCanvasId: id }),

  fetchCanvases: async () => {
    set({ isLoadingCanvases: true, error: null });
    try {
      const canvases = await apiListCanvases();
      set({ canvases, isLoadingCanvases: false });
    } catch (err) {
      set({ error: formatErrorMessage(err), isLoadingCanvases: false });
    }
  },

  createCanvas: async (name: string, password: string) => {
    set({ error: null });
    try {
      const summary = await apiCreateCanvas(name, password);
      await get().fetchCanvases();
      return summary;
    } catch (err) {
      set({ error: formatErrorMessage(err) });
      throw err;
    }
  },

  openCanvas: async (id: string, password: string) => {
    set({ error: null });
    try {
      await apiOpenCanvas(id, password);
      set({ activeCanvasId: id, closingCanvasId: null, error: null });
    } catch (err) {
      set({ error: formatErrorMessage(err) });
    }
  },

  closeCanvas: async () => {
    const currentId = get().activeCanvasId;
    set({ error: null });
    try {
      await apiCloseCanvas();
      set({ activeCanvasId: null, closingCanvasId: currentId, error: null });
      setTimeout(() => {
        if (get().closingCanvasId === currentId) {
          set({ closingCanvasId: null });
        }
      }, 400);
    } catch (err) {
      set({ error: formatErrorMessage(err) });
      throw err;
    }
  },

  renameCanvas: async (id: string, newName: string) => {
    set({ error: null });
    try {
      await apiRenameCanvas(id, newName);
      await get().fetchCanvases();
    } catch (err) {
      set({ error: formatErrorMessage(err) });
      throw err;
    }
  },

  duplicateCanvas: async (id: string, originalPassword: string, newPassword?: string) => {
    set({ error: null });
    try {
      await apiDuplicateCanvas(id, originalPassword, newPassword);
      await get().fetchCanvases();
    } catch (err) {
      set({ error: formatErrorMessage(err) });
      throw err;
    }
  },

  changeCanvasPassword: async (id: string, oldPassword: string, newPassword: string) => {
    set({ error: null });
    try {
      await apiChangeCanvasPassword(id, oldPassword, newPassword);
      await get().fetchCanvases();
    } catch (err) {
      set({ error: formatErrorMessage(err) });
      throw err;
    }
  },

  deleteCanvas: async (id: string, password: string) => {
    set({ error: null });
    try {
      await apiDeleteCanvas(id, password);
      if (get().activeCanvasId === id) {
        set({ activeCanvasId: null });
      }
      await get().fetchCanvases();
    } catch (err) {
      set({ error: formatErrorMessage(err) });
      throw err;
    }
  },

  exportCanvas: async (id: string) => {
    set({ error: null });
    try {
      await apiExportCanvas(id);
    } catch (err) {
      set({ error: formatErrorMessage(err) });
      throw err;
    }
  },

  importCanvas: async () => {
    set({ error: null });
    try {
      const summary = await apiImportCanvas();
      if (summary) {
        await get().fetchCanvases();
      }
    } catch (err) {
      set({ error: formatErrorMessage(err) });
      throw err;
    }
  },

  setError: (error: string | null) => set({ error }),

  resetCanvasState: () => {
    set({
      canvases: [],
      unlockingCanvas: null,
      activeCanvasId: null,
      closingCanvasId: null,
      isLoadingCanvases: false,
      error: null,
    });
  },
}));
