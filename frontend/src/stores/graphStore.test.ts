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
});
