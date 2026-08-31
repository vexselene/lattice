import { useGraphStore } from '../stores/graphStore';
import { getFocusState } from './focusState';

export type ExportMode = 'all' | 'dimmed' | 'isolated';

export interface IncludedIdsResult {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
}

export interface ExportEmphasisResult {
  highlightedIds: Set<string>;
  dimmedIds: Set<string>;
}

/**
 * Returns the set of node and edge IDs to include in an export based on the specified mode.
 * - "all": every node/edge in useGraphStore (full graph).
 * - "dimmed": every node/edge in useGraphStore (full graph, nothing excluded).
 * - "isolated": nodeIds = rootNodeIds ∪ neighborNodeIds, edgeIds = rootEdgeIds ∪ neighborEdgeIds.
 */
export function getExportIncludedIds(mode: ExportMode): IncludedIdsResult {
  if (mode === 'all' || mode === 'dimmed') {
    const { nodes, edges } = useGraphStore.getState();
    const nodeIds = new Set<string>();
    nodes.forEach((n) => {
      const id = n.data?.id || (n as any).id;
      if (id) nodeIds.add(id);
    });

    const edgeIds = new Set<string>();
    edges.forEach((e) => {
      if (e.id) edgeIds.add(e.id);
    });

    return { nodeIds, edgeIds };
  }

  if (mode === 'isolated') {
    const focus = getFocusState();
    return {
      nodeIds: new Set([...focus.rootNodeIds, ...focus.neighborNodeIds]),
      edgeIds: new Set([...focus.rootEdgeIds, ...focus.neighborEdgeIds]),
    };
  }

  return { nodeIds: new Set<string>(), edgeIds: new Set<string>() };
}

/**
 * Returns emphasis (highlighted vs dimmed) for the export:
 * - "dimmed" mode: Reads focus state.
 *   highlightedIds = rootNodeIds ∪ neighborNodeIds ∪ rootEdgeIds ∪ neighborEdgeIds;
 *   dimmedIds = everything else in the included set.
 * - "all" and "isolated": returns null (no dimming applied in either mode).
 */
export function getExportEmphasis(mode: ExportMode): ExportEmphasisResult | null {
  if (mode !== 'dimmed') {
    return null;
  }

  const focus = getFocusState();
  if (!focus.hasActiveFocus) {
    return null;
  }

  const included = getExportIncludedIds('dimmed');

  const highlightedIds = new Set<string>([
    ...focus.rootNodeIds,
    ...focus.neighborNodeIds,
    ...focus.rootEdgeIds,
    ...focus.neighborEdgeIds,
  ]);

  const dimmedIds = new Set<string>();
  included.nodeIds.forEach((id) => {
    if (!highlightedIds.has(id)) {
      dimmedIds.add(id);
    }
  });
  included.edgeIds.forEach((id) => {
    if (!highlightedIds.has(id)) {
      dimmedIds.add(id);
    }
  });

  return { highlightedIds, dimmedIds };
}
