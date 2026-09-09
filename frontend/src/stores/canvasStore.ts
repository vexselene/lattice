import { create } from 'zustand';
import {
  listCanvases as apiListCanvases,
  createCanvas as apiCreateCanvas,
  openCanvas as apiOpenCanvas,
  closeCanvas as apiCloseCanvas,
  renameCanvas as apiRenameCanvas,
  duplicateCanvas as apiDuplicateCanvas,
  deleteCanvas as apiDeleteCanvas,
  exportCanvas as apiExportCanvas,
  importCanvas as apiImportCanvas,
  formatErrorMessage,
} from '../api/canvas';
import type { CanvasSummary } from '../api/canvas';

export interface CanvasState {
  canvases: CanvasSummary[];
  activeCanvasId: string | null;
  isLoadingCanvases: boolean;
  error: string | null;

  fetchCanvases: () => Promise<void>;
  createCanvas: (name: string, password: string) => Promise<void>;
  openCanvas: (id: string, password: string) => Promise<void>;
  closeCanvas: () => Promise<void>;
  renameCanvas: (id: string, newName: string) => Promise<void>;
  duplicateCanvas: (id: string, originalPassword: string, newPassword?: string) => Promise<void>;
  deleteCanvas: (id: string, password: string) => Promise<void>;
  exportCanvas: (id: string) => Promise<void>;
  importCanvas: () => Promise<void>;
  setError: (error: string | null) => void;
  resetCanvasState: () => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  canvases: [],
  activeCanvasId: null,
  isLoadingCanvases: false,
  error: null,

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
      await apiCreateCanvas(name, password);
      await get().fetchCanvases();
    } catch (err) {
      set({ error: formatErrorMessage(err) });
      throw err;
    }
  },

  openCanvas: async (id: string, password: string) => {
    set({ error: null });
    try {
      await apiOpenCanvas(id, password);
      set({ activeCanvasId: id, error: null });
    } catch (err) {
      set({ error: formatErrorMessage(err) });
    }
  },

  closeCanvas: async () => {
    set({ error: null });
    try {
      await apiCloseCanvas();
      set({ activeCanvasId: null, error: null });
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
      activeCanvasId: null,
      isLoadingCanvases: false,
      error: null,
    });
  },
}));
