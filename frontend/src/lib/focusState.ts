import { useGraphStore } from '../stores/graphStore';
import { Edge } from '../types/graph';

export interface FocusState {
  rootNodeIds: Set<string>;
  rootEdgeIds: Set<string>;
  neighborNodeIds: Set<string>;
  neighborEdgeIds: Set<string>;
  hasActiveFocus: boolean;
}

export interface FocusStateInputs {
  activeChain: { nodeIds: Set<string>; edgeIds: Set<string> } | null;
  selectedNodeIds: Set<string>;
  selectedEdgeIds: Set<string>;
  activeMultiMode: 'none' | 'isolate' | 'chains';
  edges: Edge[];
}

/**
 * Pure function computing structured focus state (roots vs neighbors) from store inputs.
 */
export function computeFocusState(inputs: FocusStateInputs): FocusState {
  const { activeChain, selectedNodeIds, selectedEdgeIds, activeMultiMode, edges } = inputs;

  // Trigger 4: Chains mode (activeMultiMode === 'chains', selectedNodeIds non-empty)
  if (activeMultiMode === 'chains' && selectedNodeIds.size > 0) {
    const rootNodeIds = new Set<string>(selectedNodeIds);
    // TODO: populate from a future selectedEdgeIds-in-multi-select feature — do not remove this field, downstream code already depends on it existing as a Set even when empty
    const rootEdgeIds = new Set<string>();
    const neighborNodeIds = new Set<string>();
    const neighborEdgeIds = new Set<string>();

    edges.forEach((e: Edge) => {
      const isSourceRoot = rootNodeIds.has(e.source_id);
      const isTargetRoot = rootNodeIds.has(e.target_id);

      if (isSourceRoot || isTargetRoot) {
        neighborEdgeIds.add(e.id);
        if (!isSourceRoot) {
          neighborNodeIds.add(e.source_id);
        }
        if (!isTargetRoot) {
          neighborNodeIds.add(e.target_id);
        }
      }
    });

    return {
      rootNodeIds,
      rootEdgeIds,
      neighborNodeIds,
      neighborEdgeIds,
      hasActiveFocus: true,
    };
  }

  // Trigger 2: Edge click (selectedEdgeIds non-empty, activeChain null, selectedNodeIds empty)
  if (selectedEdgeIds.size > 0 && selectedNodeIds.size === 0 && activeChain === null) {
    const rootNodeIds = new Set<string>();
    const rootEdgeIds = new Set<string>(selectedEdgeIds);
    const neighborNodeIds = new Set<string>();
    const neighborEdgeIds = new Set<string>();

    edges.forEach((e: Edge) => {
      if (selectedEdgeIds.has(e.id)) {
        neighborNodeIds.add(e.source_id);
        neighborNodeIds.add(e.target_id);
      }
    });

    return {
      rootNodeIds,
      rootEdgeIds,
      neighborNodeIds,
      neighborEdgeIds,
      hasActiveFocus: true,
    };
  }

  // Trigger 3: Multi-select (activeMultiMode !== 'chains', selectedNodeIds non-empty)
  if (selectedNodeIds.size > 0) {
    const rootNodeIds = new Set<string>(selectedNodeIds);
    // TODO: populate from a future selectedEdgeIds-in-multi-select feature — do not remove this field, downstream code already depends on it existing as a Set even when empty
    const rootEdgeIds = new Set<string>();
    const neighborNodeIds = new Set<string>();
    const neighborEdgeIds = new Set<string>();

    return {
      rootNodeIds,
      rootEdgeIds,
      neighborNodeIds,
      neighborEdgeIds,
      hasActiveFocus: true,
    };
  }

  // Trigger 1: Single node click (activeChain set, selectedNodeIds/selectedEdgeIds empty, activeMultiMode !== 'chains')
  if (activeChain !== null) {
    const allNodeIds = Array.from(activeChain.nodeIds);
    const chainEdgeIds = activeChain.edgeIds;

    // Identify root node: in a 1-hop star graph around clicked node, root is incident to all chain edges
    let rootId = allNodeIds[0] || '';
    if (chainEdgeIds.size > 0 && allNodeIds.length > 1) {
      const edgeList = edges.filter((e) => chainEdgeIds.has(e.id));
      for (const nodeId of allNodeIds) {
        const touchesAll = edgeList.every((e) => e.source_id === nodeId || e.target_id === nodeId);
        if (touchesAll) {
          rootId = nodeId;
          break;
        }
      }
    }

    const rootNodeIds = new Set<string>(rootId ? [rootId] : []);
    const rootEdgeIds = new Set<string>();
    const neighborNodeIds = new Set<string>();
    allNodeIds.forEach((id) => {
      if (id !== rootId) {
        neighborNodeIds.add(id);
      }
    });
    const neighborEdgeIds = new Set<string>(activeChain.edgeIds);

    return {
      rootNodeIds,
      rootEdgeIds,
      neighborNodeIds,
      neighborEdgeIds,
      hasActiveFocus: true,
    };
  }

  // No active selection of any kind
  return {
    rootNodeIds: new Set<string>(),
    rootEdgeIds: new Set<string>(),
    neighborNodeIds: new Set<string>(),
    neighborEdgeIds: new Set<string>(),
    hasActiveFocus: false,
  };
}

/**
 * Returns the focus state directly from useGraphStore.
 */
export function getFocusState(): FocusState {
  const { activeChain, selectedNodeIds, selectedEdgeIds, activeMultiMode, edges } = useGraphStore.getState();
  return computeFocusState({
    activeChain,
    selectedNodeIds,
    selectedEdgeIds,
    activeMultiMode,
    edges,
  });
}

/**
 * Backwards compatibility helper for merged focus sets.
 */
export function getEffectiveFocusState() {
  const { edges } = useGraphStore.getState();
  const focus = getFocusState();
  const focusedNodeIds = new Set<string>([...focus.rootNodeIds, ...focus.neighborNodeIds]);
  const focusedEdgeIds = new Set<string>([...focus.rootEdgeIds, ...focus.neighborEdgeIds]);

  // For multi-select roots (trigger 3), include edges connecting root nodes for legacy callers
  if (focus.rootNodeIds.size > 0 && focus.rootEdgeIds.size === 0 && focus.neighborEdgeIds.size === 0) {
    edges.forEach((e: Edge) => {
      if (focus.rootNodeIds.has(e.source_id) && focus.rootNodeIds.has(e.target_id)) {
        focusedEdgeIds.add(e.id);
      }
    });
  }

  return {
    focusedNodeIds,
    focusedEdgeIds,
    hasActiveFocus: focus.hasActiveFocus,
  };
}
