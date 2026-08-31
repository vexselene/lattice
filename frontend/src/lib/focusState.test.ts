import { describe, it, expect } from 'vitest';
import { computeFocusState } from './focusState';
import { Edge } from '../types/graph';

describe('computeFocusState', () => {
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

  it('Trigger 1: handles single node-click active chain (root + neighbors)', () => {
    const focus = computeFocusState({
      activeChain: {
        nodeIds: new Set(['node-1', 'node-2']),
        edgeIds: new Set(['edge-1']),
      },
      selectedNodeIds: new Set(),
      selectedEdgeIds: new Set(),
      activeMultiMode: 'none',
      edges: mockEdges,
    });

    expect(focus.hasActiveFocus).toBe(true);
    expect(focus.rootNodeIds).toEqual(new Set(['node-1']));
    expect(focus.rootEdgeIds).toEqual(new Set());
    expect(focus.neighborNodeIds).toEqual(new Set(['node-2']));
    expect(focus.neighborEdgeIds).toEqual(new Set(['edge-1']));
  });

  it('Trigger 2: handles edge-click (selectedEdgeIds root, endpoint neighbors)', () => {
    const focus = computeFocusState({
      activeChain: null,
      selectedNodeIds: new Set(),
      selectedEdgeIds: new Set(['edge-2']),
      activeMultiMode: 'none',
      edges: mockEdges,
    });

    expect(focus.hasActiveFocus).toBe(true);
    expect(focus.rootNodeIds).toEqual(new Set());
    expect(focus.rootEdgeIds).toEqual(new Set(['edge-2']));
    expect(focus.neighborNodeIds).toEqual(new Set(['node-2', 'node-3']));
    expect(focus.neighborEdgeIds).toEqual(new Set());
  });

  it('Trigger 3: handles multi-select node selection (selectedNodeIds roots, no neighbor expansion)', () => {
    const focus = computeFocusState({
      activeChain: null,
      selectedNodeIds: new Set(['node-1', 'node-3']),
      selectedEdgeIds: new Set(),
      activeMultiMode: 'none',
      edges: mockEdges,
    });

    expect(focus.hasActiveFocus).toBe(true);
    expect(focus.rootNodeIds).toEqual(new Set(['node-1', 'node-3']));
    expect(focus.rootEdgeIds).toEqual(new Set());
    expect(focus.neighborNodeIds).toEqual(new Set());
    expect(focus.neighborEdgeIds).toEqual(new Set());
  });

  it('Trigger 4: handles chains mode with 1-hop expansion', () => {
    const focus = computeFocusState({
      activeChain: null,
      selectedNodeIds: new Set(['node-1']),
      selectedEdgeIds: new Set(),
      activeMultiMode: 'chains',
      edges: mockEdges,
    });

    expect(focus.hasActiveFocus).toBe(true);
    expect(focus.rootNodeIds).toEqual(new Set(['node-1']));
    expect(focus.rootEdgeIds).toEqual(new Set());
    expect(focus.neighborNodeIds).toEqual(new Set(['node-2']));
    expect(focus.neighborEdgeIds).toEqual(new Set(['edge-1']));
  });

  it('Default: returns false for hasActiveFocus with empty sets when nothing is selected', () => {
    const focus = computeFocusState({
      activeChain: null,
      selectedNodeIds: new Set(),
      selectedEdgeIds: new Set(),
      activeMultiMode: 'none',
      edges: mockEdges,
    });

    expect(focus.hasActiveFocus).toBe(false);
    expect(focus.rootNodeIds).toBeInstanceOf(Set);
    expect(focus.rootNodeIds.size).toBe(0);
    expect(focus.rootEdgeIds).toBeInstanceOf(Set);
    expect(focus.rootEdgeIds.size).toBe(0);
    expect(focus.neighborNodeIds).toBeInstanceOf(Set);
    expect(focus.neighborNodeIds.size).toBe(0);
    expect(focus.neighborEdgeIds).toBeInstanceOf(Set);
    expect(focus.neighborEdgeIds.size).toBe(0);
  });
});
