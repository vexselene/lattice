import type { CanvasSummary } from '../types/electron';

export type { CanvasSummary };

export function normalizeError(err: any): any {
  if (err && typeof err === 'object') {
    if ('error' in err) return err;
    if (typeof err.message === 'string') {
      try {
        const parsed = JSON.parse(err.message);
        if (parsed && typeof parsed === 'object' && 'error' in parsed) {
          Object.assign(err, parsed);
          return err;
        }
      } catch {}
    }
  }
  return err;
}

export function formatErrorMessage(err: any): string {
  if (!err) return 'Unknown error';
  const norm = normalizeError(err);
  if (norm.details !== undefined && norm.details !== null) {
    if (typeof norm.details === 'string') {
      return norm.details;
    }
    if (typeof norm.details === 'object') {
      if (norm.details.wait_remaining_ms !== undefined) {
        return `Rate limited: please wait ${Math.ceil(norm.details.wait_remaining_ms / 1000)}s before trying again`;
      }
      if (norm.details.message) {
        return String(norm.details.message);
      }
      try {
        return JSON.stringify(norm.details);
      } catch {}
    }
  }
  if (norm.error === 'InvalidPassword') {
    return 'Invalid password';
  }
  if (norm.error === 'NameAlreadyExists') {
    return 'A canvas with this name already exists';
  }
  if (norm.error === 'CanvasActiveCannotChangePassword') {
    return 'Close the canvas before changing its password';
  }
  if (norm.error === 'CanvasAlreadyActive') {
    return 'A canvas is already open';
  }
  if (norm.error === 'NotUnlocked') {
    return 'Vault is locked';
  }
  if (norm.error === 'NotFound') {
    return 'Canvas not found';
  }
  if (norm.error === 'InvalidBundle') {
    return 'Invalid canvas bundle';
  }
  return norm.error || norm.message || 'Operation failed';
}

function normalizeCanvasSummary(raw: any): CanvasSummary {
  const createdAt = raw.createdAt ?? raw.created_at ?? '';
  const modifiedAt = raw.modifiedAt ?? raw.modified_at ?? '';
  return {
    id: raw.id,
    name: raw.name,
    createdAt,
    modifiedAt,
    created_at: createdAt,
    modified_at: modifiedAt,
  };
}

export const listCanvases = async (): Promise<CanvasSummary[]> => {
  try {
    if (window.api?.cmdListCanvases) {
      const list = await window.api.cmdListCanvases();
      return list.map(normalizeCanvasSummary);
    }
    return [];
  } catch (err) {
    throw normalizeError(err);
  }
};

export const createCanvas = async (name: string, password: string): Promise<CanvasSummary> => {
  try {
    if (window.api?.cmdCreateCanvas) {
      const summary = await window.api.cmdCreateCanvas(name, password);
      return normalizeCanvasSummary(summary);
    }
    throw new Error('API not available');
  } catch (err) {
    throw normalizeError(err);
  }
};

export const openCanvas = async (id: string, password: string): Promise<void> => {
  try {
    if (window.api?.cmdOpenCanvas) {
      await window.api.cmdOpenCanvas(id, password);
    }
  } catch (err) {
    throw normalizeError(err);
  }
};

export const closeCanvas = async (): Promise<void> => {
  try {
    if (window.api?.cmdCloseCanvas) {
      await window.api.cmdCloseCanvas();
    }
  } catch (err) {
    throw normalizeError(err);
  }
};

export const renameCanvas = async (id: string, newName: string): Promise<void> => {
  try {
    if (window.api?.cmdRenameCanvas) {
      await window.api.cmdRenameCanvas(id, newName);
    }
  } catch (err) {
    throw normalizeError(err);
  }
};

export const duplicateCanvas = async (
  id: string,
  originalPassword: string,
  newPassword?: string,
): Promise<CanvasSummary> => {
  try {
    if (window.api?.cmdDuplicateCanvas) {
      const summary = await window.api.cmdDuplicateCanvas(id, originalPassword, newPassword || null);
      return normalizeCanvasSummary(summary);
    }
    throw new Error('API not available');
  } catch (err) {
    throw normalizeError(err);
  }
};

export const changeCanvasPassword = async (
  id: string,
  oldPassword: string,
  newPassword: string,
): Promise<void> => {
  try {
    if (window.api?.cmdChangeCanvasPassword) {
      await window.api.cmdChangeCanvasPassword(id, oldPassword, newPassword);
    }
  } catch (err) {
    throw normalizeError(err);
  }
};

export const deleteCanvas = async (id: string, password: string): Promise<void> => {
  try {
    if (window.api?.cmdDeleteCanvas) {
      await window.api.cmdDeleteCanvas(id, password);
    }
  } catch (err) {
    throw normalizeError(err);
  }
};

export const exportCanvas = async (id: string, name?: string): Promise<boolean> => {
  try {
    let canvasName = name;
    if (!canvasName) {
      const list = await listCanvases();
      const match = list.find((c) => c.id === id);
      canvasName = match ? match.name : 'canvas';
    }
    const defaultFileName = `${canvasName}.lattice`;
    const destinationPath = await window.api?.showSaveDialog(defaultFileName);
    if (!destinationPath) {
      return false; // User cancelled
    }
    if (window.api?.cmdExportCanvas) {
      await window.api.cmdExportCanvas(id, destinationPath);
    }
    return true;
  } catch (err) {
    throw normalizeError(err);
  }
};

export const importCanvas = async (): Promise<CanvasSummary | null> => {
  try {
    const sourcePath = await window.api?.showOpenDialog();
    if (!sourcePath) {
      return null; // User cancelled
    }
    if (window.api?.cmdImportCanvas) {
      const summary = await window.api.cmdImportCanvas(sourcePath);
      return normalizeCanvasSummary(summary);
    }
    return null;
  } catch (err) {
    throw normalizeError(err);
  }
};
