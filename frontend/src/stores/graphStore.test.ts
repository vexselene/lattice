import { describe, it, expect, beforeEach } from 'vitest';
import { useGraphStore } from './graphStore';
import { GraphNode } from '../types/graph';

describe('graphStore node position updates', () => {
  beforeEach(() => {
    useGraphStore.setState({
      nodes: [
        {
          type: 'email',
          data: {
            id: 'node-1',
            address: 'test@example.com',
            position_x: 10,
            position_y: 20,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        } as GraphNode,
        {
          type: 'phone',
          data: {
            id: 'node-2',
            number: '+1234567890',
            position_x: 50,
            position_y: 60,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        } as GraphNode,
      ],
    });
  });

  it('updateNodePosition updates in-memory position for a single node', () => {
    useGraphStore.getState().updateNodePosition('node-1', 150, 250);

    const nodes = useGraphStore.getState().nodes;
    const node1 = nodes.find((n) => n.data.id === 'node-1');
    const node2 = nodes.find((n) => n.data.id === 'node-2');

    expect(node1?.data.position_x).toBe(150);
    expect(node1?.data.position_y).toBe(250);
    expect(node2?.data.position_x).toBe(50);
    expect(node2?.data.position_y).toBe(60);
  });

  it('updateNodePositions updates multiple node positions simultaneously', () => {
    useGraphStore.getState().updateNodePositions([
      { id: 'node-1', x: 300, y: 400 },
      { id: 'node-2', x: 500, y: 600 },
    ]);

    const nodes = useGraphStore.getState().nodes;
    const node1 = nodes.find((n) => n.data.id === 'node-1');
    const node2 = nodes.find((n) => n.data.id === 'node-2');

    expect(node1?.data.position_x).toBe(300);
    expect(node1?.data.position_y).toBe(400);
    expect(node2?.data.position_x).toBe(500);
    expect(node2?.data.position_y).toBe(600);
  });

  it('updateNodePositions handles a subset of nodes and preserves unmoved nodes', () => {
    useGraphStore.getState().updateNodePositions([
      { id: 'node-1', x: 999, y: 888 },
    ]);

    const nodes = useGraphStore.getState().nodes;
    const node1 = nodes.find((n) => n.data.id === 'node-1');
    const node2 = nodes.find((n) => n.data.id === 'node-2');

    expect(node1?.data.position_x).toBe(999);
    expect(node1?.data.position_y).toBe(888);
    expect(node2?.data.position_x).toBe(50);
    expect(node2?.data.position_y).toBe(60);
  });

  it('updateNodePositions is a no-op when passed an empty array', () => {
    useGraphStore.getState().updateNodePositions([]);

    const nodes = useGraphStore.getState().nodes;
    const node1 = nodes.find((n) => n.data.id === 'node-1');
    const node2 = nodes.find((n) => n.data.id === 'node-2');

    expect(node1?.data.position_x).toBe(10);
    expect(node1?.data.position_y).toBe(20);
    expect(node2?.data.position_x).toBe(50);
    expect(node2?.data.position_y).toBe(60);
  });

  it('resetGraph flushes all nodes, edges, selection, and active chain states', () => {
    useGraphStore.setState({
      activeChain: { nodeIds: new Set(['node-1']), edgeIds: new Set(['edge-1']) },
      selectedNode: { type: 'email', data: { id: 'node-1' } } as any,
      selectedNodeIds: new Set(['node-1']),
      selectedEdgeIds: new Set(['edge-1']),
      expandedNodeId: 'node-1',
      activeMultiMode: 'chains',
      openMenuEdgeId: 'edge-1',
    });

    useGraphStore.getState().resetGraph();

    const state = useGraphStore.getState();
    expect(state.nodes).toEqual([]);
    expect(state.edges).toEqual([]);
    expect(state.services).toEqual([]);
    expect(state.selectedNode).toBeNull();
    expect(state.activeChain).toBeNull();
    expect(state.expandedNodeId).toBeNull();
    expect(state.selectedNodeIds.size).toBe(0);
    expect(state.selectedEdgeIds.size).toBe(0);
    expect(state.activeMultiMode).toBe('none');
    expect(state.openMenuEdgeId).toBeNull();
  });
});
