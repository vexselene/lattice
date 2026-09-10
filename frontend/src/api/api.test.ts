import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getGraph,
  createNode,
  updateNode,
  deleteNode,
  getNodePassword,
  updateNodePosition,
} from './nodes';
import { createEdge, deleteEdge, getEdges, updateEdge } from './edges';
import { search, generatePassword } from './search';

const mockApi = {
  cmdGetGraph: vi.fn(),
  cmdCreateNode: vi.fn(),
  cmdUpdateNode: vi.fn(),
  cmdDeleteNode: vi.fn(),
  cmdGetNodePassword: vi.fn(),
  cmdUpdateNodePosition: vi.fn(),
  cmdCreateEdge: vi.fn(),
  cmdGetEdges: vi.fn(),
  cmdUpdateEdge: vi.fn(),
  cmdDeleteEdge: vi.fn(),
  cmdSearch: vi.fn(),
  cmdGeneratePassword: vi.fn(),
};

(globalThis as any).window = {
  api: mockApi,
};

describe('Frontend Electron IPC API Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('nodes api', () => {
    it('getGraph invokes cmdGetGraph', async () => {
      const mockGraph = { nodes: [], edges: [] };
      mockApi.cmdGetGraph.mockResolvedValueOnce(mockGraph);

      const result = await getGraph();
      expect(mockApi.cmdGetGraph).toHaveBeenCalledWith();
      expect(result).toEqual(mockGraph);
    });

    it('createNode unwraps node.data', async () => {
      mockApi.cmdCreateNode.mockResolvedValueOnce({
        type: 'email',
        data: { id: 'email-123', address: 'test@example.com' },
      });

      const result = await createNode('email', { address: 'test@example.com' });
      expect(mockApi.cmdCreateNode).toHaveBeenCalledWith('email', { address: 'test@example.com' });
      expect(result).toEqual({ id: 'email-123', address: 'test@example.com' });
    });

    it('updateNode unwraps node.data', async () => {
      mockApi.cmdUpdateNode.mockResolvedValueOnce({
        type: 'service',
        data: { id: 'srv-1', name: 'GitHub' },
      });

      const result = await updateNode('service', 'srv-1', { name: 'GitHub' });
      expect(mockApi.cmdUpdateNode).toHaveBeenCalledWith('service', 'srv-1', { name: 'GitHub' });
      expect(result).toEqual({ id: 'srv-1', name: 'GitHub' });
    });

    it('deleteNode invokes cmdDeleteNode', async () => {
      mockApi.cmdDeleteNode.mockResolvedValueOnce(undefined);

      const result = await deleteNode('account', 'acc-1');
      expect(mockApi.cmdDeleteNode).toHaveBeenCalledWith('account', 'acc-1');
      expect(result).toEqual({ success: true });
    });

    it('getNodePassword invokes cmdGetNodePassword and wraps password', async () => {
      mockApi.cmdGetNodePassword.mockResolvedValueOnce('secretPass');

      const result = await getNodePassword('email', 'eml-1');
      expect(mockApi.cmdGetNodePassword).toHaveBeenCalledWith('email', 'eml-1');
      expect(result).toEqual({ password: 'secretPass' });
    });

    it('updateNodePosition invokes cmdUpdateNodePosition', async () => {
      mockApi.cmdUpdateNodePosition.mockResolvedValueOnce(undefined);

      await updateNodePosition('phone', 'ph-1', 150.5, 220.0);
      expect(mockApi.cmdUpdateNodePosition).toHaveBeenCalledWith('phone', 'ph-1', 150.5, 220.0);
    });
  });

  describe('edges api', () => {
    it('createEdge invokes cmdCreateEdge', async () => {
      const edgePayload = {
        source_type: 'email' as const,
        source_id: 'e-1',
        target_type: 'service' as const,
        target_id: 's-1',
        relation: 'registered_with' as const,
      };
      mockApi.cmdCreateEdge.mockResolvedValueOnce({ id: 'edge-1', ...edgePayload });

      const result = await createEdge(edgePayload);
      expect(mockApi.cmdCreateEdge).toHaveBeenCalledWith(edgePayload);
      expect(result.id).toBe('edge-1');
    });

    it('getEdges invokes cmdGetEdges', async () => {
      mockApi.cmdGetEdges.mockResolvedValueOnce([]);

      const result = await getEdges('service', 's-1');
      expect(mockApi.cmdGetEdges).toHaveBeenCalledWith('service', 's-1');
      expect(result).toEqual([]);
    });

    it('updateEdge invokes cmdUpdateEdge', async () => {
      mockApi.cmdUpdateEdge.mockResolvedValueOnce({ id: 'edge-1', notes: 'updated' });

      const result = await updateEdge('edge-1', { notes: 'updated' });
      expect(mockApi.cmdUpdateEdge).toHaveBeenCalledWith('edge-1', { notes: 'updated' });
      expect(result.notes).toBe('updated');
    });

    it('deleteEdge invokes cmdDeleteEdge', async () => {
      mockApi.cmdDeleteEdge.mockResolvedValueOnce(undefined);

      const result = await deleteEdge('edge-1');
      expect(mockApi.cmdDeleteEdge).toHaveBeenCalledWith('edge-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('search api', () => {
    it('search invokes cmdSearch', async () => {
      mockApi.cmdSearch.mockResolvedValueOnce([]);

      const result = await search('query', ['email']);
      expect(mockApi.cmdSearch).toHaveBeenCalledWith('query', ['email']);
      expect(result).toEqual([]);
    });

    it('generatePassword invokes cmdGeneratePassword and extracts password', async () => {
      mockApi.cmdGeneratePassword.mockResolvedValueOnce({ password: 'abcdef123456' });

      const result = await generatePassword();
      expect(mockApi.cmdGeneratePassword).toHaveBeenCalledWith();
      expect(result).toBe('abcdef123456');
    });
  });
});
