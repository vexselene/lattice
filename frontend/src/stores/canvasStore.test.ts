import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCanvasStore } from './canvasStore';
import * as canvasApi from '../api/canvas';

vi.mock('../api/canvas', () => ({
  listCanvases: vi.fn(),
  createCanvas: vi.fn(),
  openCanvas: vi.fn(),
  closeCanvas: vi.fn(),
  renameCanvas: vi.fn(),
  duplicateCanvas: vi.fn(),
  deleteCanvas: vi.fn(),
  exportCanvas: vi.fn(),
  importCanvas: vi.fn(),
  formatErrorMessage: vi.fn((err: any) => err?.message || 'Error occurred'),
}));

describe('canvasStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCanvasStore.setState({
      canvases: [],
      activeCanvasId: null,
      closingCanvasId: null,
      isLoadingCanvases: false,
      error: null,
    });
  });

  it('fetchCanvases populates state', async () => {
    const mockCanvases = [
      { id: 'c1', name: 'Canvas 1', createdAt: '2026-01-01', modifiedAt: '2026-01-02' },
      { id: 'c2', name: 'Canvas 2', createdAt: '2026-01-03', modifiedAt: '2026-01-04' },
    ];
    vi.mocked(canvasApi.listCanvases).mockResolvedValue(mockCanvases);

    await useCanvasStore.getState().fetchCanvases();

    expect(useCanvasStore.getState().canvases).toEqual(mockCanvases);
    expect(useCanvasStore.getState().isLoadingCanvases).toBe(false);
    expect(useCanvasStore.getState().error).toBeNull();
  });

  it('openCanvas success sets activeCanvasId', async () => {
    vi.mocked(canvasApi.openCanvas).mockResolvedValue(undefined);

    await useCanvasStore.getState().openCanvas('c1', 'correct-pwd');

    expect(useCanvasStore.getState().activeCanvasId).toBe('c1');
    expect(useCanvasStore.getState().error).toBeNull();
    expect(canvasApi.openCanvas).toHaveBeenCalledWith('c1', 'correct-pwd');
  });

  it('openCanvas failure sets error and leaves activeCanvasId null', async () => {
    vi.mocked(canvasApi.openCanvas).mockRejectedValue(new Error('Invalid password'));

    await useCanvasStore.getState().openCanvas('c1', 'wrong-pwd');

    expect(useCanvasStore.getState().activeCanvasId).toBeNull();
    expect(useCanvasStore.getState().error).toBe('Invalid password');
  });

  it('closeCanvas resets activeCanvasId', async () => {
    useCanvasStore.setState({ activeCanvasId: 'c1' });
    vi.mocked(canvasApi.closeCanvas).mockResolvedValue(undefined);

    await useCanvasStore.getState().closeCanvas();

    expect(useCanvasStore.getState().activeCanvasId).toBeNull();
    expect(useCanvasStore.getState().closingCanvasId).toBe('c1');
    expect(useCanvasStore.getState().error).toBeNull();
    expect(canvasApi.closeCanvas).toHaveBeenCalledTimes(1);
  });

  it('resetCanvasState clears activeCanvasId, canvases, and error', () => {
    useCanvasStore.setState({
      activeCanvasId: 'c1',
      closingCanvasId: 'c1',
      canvases: [{ id: 'c1', name: 'Test Canvas', createdAt: '2026-01-01', modifiedAt: '2026-01-02' }],
      isLoadingCanvases: true,
      error: 'Some error',
    });

    useCanvasStore.getState().resetCanvasState();

    expect(useCanvasStore.getState().activeCanvasId).toBeNull();
    expect(useCanvasStore.getState().closingCanvasId).toBeNull();
    expect(useCanvasStore.getState().canvases).toEqual([]);
    expect(useCanvasStore.getState().error).toBeNull();
    expect(useCanvasStore.getState().isLoadingCanvases).toBe(false);
  });
});
