import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
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

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('Frontend Tauri IPC API Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('nodes api', () => {
    it('getGraph invokes cmd_get_graph', async () => {
      const mockGraph = { nodes: [], edges: [] };
      vi.mocked(invoke).mockResolvedValueOnce(mockGraph);

      const result = await getGraph();
      expect(invoke).toHaveBeenCalledWith('cmd_get_graph');
      expect(result).toEqual(mockGraph);
    });

    it('createNode unwraps node.data', async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        type: 'email',
        data: { id: 'email-123', address: 'test@example.com' },
      });

      const result = await createNode('email', { address: 'test@example.com' });
      expect(invoke).toHaveBeenCalledWith('cmd_create_node', {
        nodeType: 'email',
        data: { address: 'test@example.com' },
      });
      expect(result).toEqual({ id: 'email-123', address: 'test@example.com' });
    });

    it('updateNode unwraps node.data', async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        type: 'service',
        data: { id: 'srv-1', name: 'GitHub' },
      });

      const result = await updateNode('service', 'srv-1', { name: 'GitHub' });
      expect(invoke).toHaveBeenCalledWith('cmd_update_node', {
        nodeType: 'service',
        nodeId: 'srv-1',
        data: { name: 'GitHub' },
      });
      expect(result).toEqual({ id: 'srv-1', name: 'GitHub' });
    });

    it('deleteNode invokes cmd_delete_node', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const result = await deleteNode('account', 'acc-1');
      expect(invoke).toHaveBeenCalledWith('cmd_delete_node', {
        nodeType: 'account',
        nodeId: 'acc-1',
      });
      expect(result).toEqual({ success: true });
    });

    it('getNodePassword invokes cmd_get_node_password and wraps password', async () => {
      vi.mocked(invoke).mockResolvedValueOnce('secretPass');

      const result = await getNodePassword('email', 'eml-1');
      expect(invoke).toHaveBeenCalledWith('cmd_get_node_password', {
        nodeType: 'email',
        nodeId: 'eml-1',
      });
      expect(result).toEqual({ password: 'secretPass' });
    });

    it('updateNodePosition invokes cmd_update_node_position', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await updateNodePosition('phone', 'ph-1', 150.5, 220.0);
      expect(invoke).toHaveBeenCalledWith('cmd_update_node_position', {
        nodeType: 'phone',
        nodeId: 'ph-1',
        x: 150.5,
        y: 220.0,
      });
    });
  });

  describe('edges api', () => {
    it('createEdge invokes cmd_create_edge', async () => {
      const edgePayload = {
        source_type: 'email' as const,
        source_id: 'e-1',
        target_type: 'service' as const,
        target_id: 's-1',
        relation: 'registered_with' as const,
      };
      vi.mocked(invoke).mockResolvedValueOnce({ id: 'edge-1', ...edgePayload });

      const result = await createEdge(edgePayload);
      expect(invoke).toHaveBeenCalledWith('cmd_create_edge', { edge: edgePayload });
      expect(result.id).toBe('edge-1');
    });

    it('getEdges invokes cmd_get_edges', async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);

      const result = await getEdges('service', 's-1');
      expect(invoke).toHaveBeenCalledWith('cmd_get_edges', {
        nodeType: 'service',
        nodeId: 's-1',
      });
      expect(result).toEqual([]);
    });

    it('updateEdge invokes cmd_update_edge', async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ id: 'edge-1', notes: 'updated' });

      const result = await updateEdge('edge-1', { notes: 'updated' });
      expect(invoke).toHaveBeenCalledWith('cmd_update_edge', {
        edgeId: 'edge-1',
        payload: { notes: 'updated' },
      });
      expect(result.notes).toBe('updated');
    });

    it('deleteEdge invokes cmd_delete_edge', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const result = await deleteEdge('edge-1');
      expect(invoke).toHaveBeenCalledWith('cmd_delete_edge', { edgeId: 'edge-1' });
      expect(result).toEqual({ success: true });
    });
  });

  describe('search api', () => {
    it('search invokes cmd_search', async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);

      const result = await search('query', ['email']);
      expect(invoke).toHaveBeenCalledWith('cmd_search', { query: 'query', types: ['email'] });
      expect(result).toEqual([]);
    });

    it('generatePassword invokes cmd_generate_password and extracts password', async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ password: 'abcdef123456' });

      const result = await generatePassword();
      expect(invoke).toHaveBeenCalledWith('cmd_generate_password');
      expect(result).toBe('abcdef123456');
    });
  });
});
