import { useGraphStore } from '../stores/graphStore';

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
 * - "all" | "dimmed": every node and edge currently in useGraphStore (full graph, nothing filtered out).
 * - "isolated": nodeIds = selectedNodeIds exactly as-is; edgeIds = edges where BOTH source and target are in selectedNodeIds.
 */
export function getExportIncludedIds(mode: ExportMode): IncludedIdsResult {
  const { nodes, edges, selectedNodeIds } = useGraphStore.getState();

  if (mode === 'all' || mode === 'dimmed') {
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
    const nodeIds = new Set<string>(selectedNodeIds);
    const edgeIds = new Set<string>();

    edges.forEach((e) => {
      const sourceId = e.source_id || (e as any).source;
      const targetId = e.target_id || (e as any).target;
      if (sourceId && targetId && nodeIds.has(sourceId) && nodeIds.has(targetId)) {
        edgeIds.add(e.id);
      }
    });

    return { nodeIds, edgeIds };
  }

  return { nodeIds: new Set<string>(), edgeIds: new Set<string>() };
}

/**
 * Returns emphasis (highlighted vs dimmed) for the export:
 * - "dimmed" mode: Reads useGraphStore.activeChain directly.
 *   highlightedIds = activeChain's node/edge ids; dimmedIds = everything else in the included set.
 * - "all" and "isolated": returns null (no dimming applied in either mode).
 */
export function getExportEmphasis(mode: ExportMode): ExportEmphasisResult | null {
  if (mode !== 'dimmed') {
    return null;
  }

  const { activeChain } = useGraphStore.getState();
  const included = getExportIncludedIds('dimmed');

  const highlightedIds = new Set<string>();
  if (activeChain) {
    activeChain.nodeIds.forEach((id) => highlightedIds.add(id));
    activeChain.edgeIds.forEach((id) => highlightedIds.add(id));
  }

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
