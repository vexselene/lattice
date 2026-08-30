import { describe, it, expect, beforeEach } from 'vitest';
import { getExportIncludedIds, getExportEmphasis } from './exportSelection';
import { useGraphStore } from '../stores/graphStore';
import { GraphNode, Edge } from '../types/graph';

describe('exportSelection', () => {
  const mockNodes: GraphNode[] = [
    {
      type: 'email',
      data: {
        id: 'node-1',
        address: 'alice@example.com',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    },
    {
      type: 'account',
      data: {
        id: 'node-2',
        username: 'alice_acct',
        service_id: 'node-3',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    },
    {
      type: 'service',
      data: {
        id: 'node-3',
        name: 'GitHub',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    },
  ];

  const mockEdges: Edge[] = [
    {
      id: 'edge-1',
      source_type: 'email',
      source_id: 'node-1',
      target_type: 'account',
      target_id: 'node-2',
      relation: 'registered_with',
    },
    {
      id: 'edge-2',
      source_type: 'account',
      source_id: 'node-2',
      target_type: 'service',
      target_id: 'node-3',
      relation: 'linked_account',
    },
  ];

  beforeEach(() => {
    useGraphStore.setState({
      nodes: mockNodes,
      edges: mockEdges,
      selectedNodeIds: new Set(['node-1', 'node-3']), // Non-adjacent nodes
      activeChain: {
        nodeIds: new Set(['node-2', 'node-3']),
        edgeIds: new Set(['edge-2']),
      },
    });
  });

  describe('getExportIncludedIds', () => {
    it('returns all nodes and edges when mode is "all"', () => {
      const result = getExportIncludedIds('all');
      expect(result.nodeIds).toEqual(new Set(['node-1', 'node-2', 'node-3']));
      expect(result.edgeIds).toEqual(new Set(['edge-1', 'edge-2']));
    });

    it('returns all nodes and edges when mode is "dimmed"', () => {
      const result = getExportIncludedIds('dimmed');
      expect(result.nodeIds).toEqual(new Set(['node-1', 'node-2', 'node-3']));
      expect(result.edgeIds).toEqual(new Set(['edge-1', 'edge-2']));
    });

    it('returns exactly selected nodes and only fully connected edges when mode is "isolated"', () => {
      // selectedNodeIds contains node-1 and node-3 (non-adjacent)
      const result = getExportIncludedIds('isolated');
      expect(result.nodeIds).toEqual(new Set(['node-1', 'node-3']));
      expect(result.edgeIds).toEqual(new Set()); // No edge connects node-1 directly to node-3
    });

    it('returns connected edges when selected nodes are adjacent in "isolated" mode', () => {
      useGraphStore.setState({ selectedNodeIds: new Set(['node-1', 'node-2']) });
      const result = getExportIncludedIds('isolated');
      expect(result.nodeIds).toEqual(new Set(['node-1', 'node-2']));
      expect(result.edgeIds).toEqual(new Set(['edge-1']));
    });
  });

  describe('getExportEmphasis', () => {
    it('returns null when mode is "all"', () => {
      expect(getExportEmphasis('all')).toBeNull();
    });

    it('returns null when mode is "isolated"', () => {
      expect(getExportEmphasis('isolated')).toBeNull();
    });

    it('returns highlightedIds and dimmedIds based on activeChain when mode is "dimmed"', () => {
      const emphasis = getExportEmphasis('dimmed');
      expect(emphasis).not.toBeNull();
      // activeChain has node-2, node-3 and edge-2
      expect(emphasis!.highlightedIds).toEqual(new Set(['node-2', 'node-3', 'edge-2']));
      // dimmedIds has everything else in the graph (node-1, edge-1)
      expect(emphasis!.dimmedIds).toEqual(new Set(['node-1', 'edge-1']));
    });
  });
});
