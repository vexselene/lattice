import { useGraphStore } from '../stores/graphStore';
import { useUIStore } from '../stores/uiStore';
import { GRAPH_STYLE } from '../config/graphStyleConfig';

export const RING_CLASSES: Record<string, string> = {
  email: 'ring-2 ring-indigo-500/80 ring-offset-1 ring-offset-white dark:ring-offset-slate-900',
  account: 'ring-2 ring-purple-500/80 ring-offset-1 ring-offset-white dark:ring-offset-slate-900',
  phone: 'ring-2 ring-amber-500/80 ring-offset-1 ring-offset-white dark:ring-offset-slate-900',
  service: 'ring-2 ring-emerald-500/80 ring-offset-1 ring-offset-white dark:ring-offset-slate-900',
  default: 'ring-2 ring-indigo-500/80 ring-offset-1 ring-offset-white dark:ring-offset-slate-900',
};

export interface NodeVisualState {
  opacity: number;
  filter: string;
  ringClass: string;
  isVisible: boolean;
  isDimmed: boolean;
  isSelected: boolean;
}

export interface NodeVisualInput {
  id: string;
  type?: string;
}

export interface NodeVisualContext {
  dimmedIds?: Set<string>;
  selectedIds?: Set<string>;
  isolatedIds?: Set<string>;
  isExporting?: boolean;
  exportKeepHighlightRings?: boolean;
}

/**
 * Pure function computing visual styling for a node based on explicit input parameters.
 */
export function computeNodeVisualState(
  node: NodeVisualInput | string,
  {
    dimmedIds,
    selectedIds,
    isolatedIds,
    isExporting = false,
    exportKeepHighlightRings = false,
  }: NodeVisualContext = {}
): NodeVisualState {
  const nodeId = typeof node === 'string' ? node : node.id;
  const nodeType = (typeof node === 'object' ? node.type : undefined) || 'default';

  const isSelected = selectedIds ? selectedIds.has(nodeId) : false;
  const isDimmed = dimmedIds ? dimmedIds.has(nodeId) : false;
  const isVisible = isolatedIds ? isolatedIds.has(nodeId) : true;

  const effectiveShowRing = isSelected && (!isExporting || exportKeepHighlightRings);

  const opacity = !isVisible
    ? GRAPH_STYLE.opacity.isolatedHidden
    : (isDimmed ? GRAPH_STYLE.opacity.dimmed : GRAPH_STYLE.opacity.normal);

  const filter = isDimmed
    ? `blur(${GRAPH_STYLE.blur.dimmed}) grayscale(${GRAPH_STYLE.grayscale.dimmed})`
    : `blur(${GRAPH_STYLE.blur.none}) grayscale(${GRAPH_STYLE.grayscale.none})`;

  const ringClass = effectiveShowRing
    ? (RING_CLASSES[nodeType] || RING_CLASSES.default)
    : '';

  return {
    opacity,
    filter,
    ringClass,
    isVisible,
    isDimmed,
    isSelected,
  };
}

export interface EdgeVisualState {
  stroke: string;
  strokeWidth: number;
  filter: string;
  strokeDasharray: string | undefined;
  hitboxWidth: number;
  opacity: number;
  isDimmed: boolean;
  isHighlighted: boolean;
  isSelected: boolean;
  isVisible: boolean;
}

export interface EdgeVisualInput {
  id: string;
  source?: string;
  target?: string;
  source_id?: string;
  target_id?: string;
}

export interface EdgeVisualContext {
  dimmedIds?: Set<string>;
  highlightedIds?: Set<string>;
  selectedIds?: Set<string>;
  isolatedIds?: Set<string>;
  isHovered?: boolean;
  theme?: 'dark' | 'light';
  isExporting?: boolean;
  exportKeepHighlightRings?: boolean;
}

/**
 * Pure function computing visual styling for an edge based on explicit input parameters.
 */
export function computeEdgeVisualState(
  edge: EdgeVisualInput | string,
  {
    dimmedIds,
    highlightedIds,
    selectedIds,
    isolatedIds,
    isHovered = false,
    theme = 'dark',
    isExporting = false,
    exportKeepHighlightRings = false,
  }: EdgeVisualContext = {}
): EdgeVisualState {
  const edgeId = typeof edge === 'string' ? edge : edge.id;

  const isSelected = selectedIds ? selectedIds.has(edgeId) : false;
  const isHighlighted = highlightedIds ? highlightedIds.has(edgeId) : false;
  const isDimmed = dimmedIds ? dimmedIds.has(edgeId) : false;
  const isVisible = isolatedIds ? isolatedIds.has(edgeId) : true;

  const defaultColor = theme === 'dark' ? GRAPH_STYLE.colors.edge.baseDark : GRAPH_STYLE.colors.edge.baseLight;
  const effectiveSelectedOrHighlighted = (isSelected || isHighlighted) && (!isExporting || exportKeepHighlightRings);

  const stroke = isDimmed
    ? GRAPH_STYLE.colors.edge.dimmed
    : (effectiveSelectedOrHighlighted || isHovered
        ? GRAPH_STYLE.colors.edge.hover
        : defaultColor);

  const strokeWidth = effectiveSelectedOrHighlighted
    ? GRAPH_STYLE.strokeWidth.highlighted
    : (isHovered ? GRAPH_STYLE.strokeWidth.hover : GRAPH_STYLE.strokeWidth.base);

  const filter = isDimmed
    ? `blur(${GRAPH_STYLE.blur.dimmed})`
    : (effectiveSelectedOrHighlighted
        ? GRAPH_STYLE.glow.highlighted
        : (isHovered ? 'drop-shadow(0 0 3px rgba(129, 140, 248, 0.3))' : 'none'));

  const strokeDasharray = (isHighlighted && (!isExporting || exportKeepHighlightRings)) ? '5 5' : undefined;
  const hitboxWidth = GRAPH_STYLE.hitbox.width;
  const opacity = !isVisible
    ? GRAPH_STYLE.opacity.isolatedHidden
    : (isDimmed ? GRAPH_STYLE.opacity.dimmed : GRAPH_STYLE.opacity.normal);

  return {
    stroke,
    strokeWidth,
    filter,
    strokeDasharray,
    hitboxWidth,
    opacity,
    isDimmed,
    isHighlighted,
    isSelected,
    isVisible,
  };
}

/**
 * Hook subscribing to Zustand graph & UI stores and returning computed node styling.
 */
export function useNodeVisualState(nodeId: string, nodeType: string = 'default'): NodeVisualState {
  const activeChain = useGraphStore((s) => s.activeChain);
  const selectedNodeIds = useGraphStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useGraphStore((s) => s.selectedEdgeIds);
  const activeMultiMode = useGraphStore((s) => s.activeMultiMode);
  const isExporting = useGraphStore((s) => s.isExporting);
  const exportScope = useGraphStore((s) => s.exportScope);
  const exportMode = useGraphStore((s) => s.exportMode);
  const exportKeepHighlightRings = useGraphStore((s) => s.exportKeepHighlightRings);
  const storeEdges = useGraphStore((s) => s.edges);
  const storeNodes = useGraphStore((s) => s.nodes);

  // Compute effective active chain (incorporating selectedEdgeIds if present)
  let effectiveActiveChain = activeChain;
  if (selectedEdgeIds.size > 0) {
    const edgeIds = new Set<string>(activeChain ? activeChain.edgeIds : []);
    const nodeIds = new Set<string>(activeChain ? activeChain.nodeIds : []);
    storeEdges.forEach((e) => {
      if (selectedEdgeIds.has(e.id)) {
        edgeIds.add(e.id);
        nodeIds.add(e.source_id);
        nodeIds.add(e.target_id);
      }
    });
    effectiveActiveChain = { nodeIds, edgeIds };
  }

  const dimmedIds = new Set<string>();

  if (activeMultiMode === 'chains' && selectedNodeIds.size > 0) {
    const chainNodeIds = new Set<string>(selectedNodeIds);
    storeEdges.forEach((e) => {
      if (selectedNodeIds.has(e.source_id) || selectedNodeIds.has(e.target_id)) {
        chainNodeIds.add(e.source_id);
        chainNodeIds.add(e.target_id);
      }
    });
    storeNodes.forEach((n) => {
      const id = n.data?.id || (n as any).id;
      if (id && !chainNodeIds.has(id)) {
        dimmedIds.add(id);
      }
    });
  } else if (effectiveActiveChain !== null) {
    storeNodes.forEach((n) => {
      const id = n.data?.id || (n as any).id;
      const isEditing = (n.data as any)?.isEditing;
      if (id && !effectiveActiveChain!.nodeIds.has(id) && !isEditing) {
        dimmedIds.add(id);
      }
    });
  }

  let isolatedIds: Set<string> | undefined;
  if (activeMultiMode === 'isolate' && selectedNodeIds.size > 0) {
    isolatedIds = selectedNodeIds;
  }

  if (isExporting && exportScope === 'selected') {
    if (exportMode === 'isolated') {
      isolatedIds = selectedNodeIds;
    } else if (exportMode === 'dimmed') {
      storeNodes.forEach((n) => {
        const id = n.data?.id || (n as any).id;
        if (id && !selectedNodeIds.has(id)) {
          dimmedIds.add(id);
        }
      });
    }
  }

  return computeNodeVisualState(
    { id: nodeId, type: nodeType },
    {
      dimmedIds,
      selectedIds: selectedNodeIds,
      isolatedIds,
      isExporting,
      exportKeepHighlightRings,
    }
  );
}

/**
 * Hook subscribing to Zustand graph & UI stores and returning computed edge styling.
 */
export function useEdgeVisualState(edgeId: string, isHovered?: boolean): EdgeVisualState {
  const storeEdges = useGraphStore((s) => s.edges);
  const activeChain = useGraphStore((s) => s.activeChain);
  const selectedEdgeIds = useGraphStore((s) => s.selectedEdgeIds);
  const selectedNodeIds = useGraphStore((s) => s.selectedNodeIds);
  const activeMultiMode = useGraphStore((s) => s.activeMultiMode);
  const isExporting = useGraphStore((s) => s.isExporting);
  const exportScope = useGraphStore((s) => s.exportScope);
  const exportMode = useGraphStore((s) => s.exportMode);
  const exportKeepHighlightRings = useGraphStore((s) => s.exportKeepHighlightRings);
  const theme = useUIStore((s) => s.theme);

  const edge = storeEdges.find((e) => e.id === edgeId) || { id: edgeId };

  // Determine active chain context
  let effectiveActiveChain = activeChain;
  if (selectedEdgeIds.size > 0) {
    const edgeIds = new Set<string>(activeChain ? activeChain.edgeIds : []);
    const nodeIds = new Set<string>(activeChain ? activeChain.nodeIds : []);
    storeEdges.forEach((e) => {
      if (selectedEdgeIds.has(e.id)) {
        edgeIds.add(e.id);
        nodeIds.add(e.source_id);
        nodeIds.add(e.target_id);
      }
    });
    effectiveActiveChain = { nodeIds, edgeIds };
  }

  const dimmedIds = new Set<string>();
  const highlightedIds = new Set<string>();

  if (activeMultiMode === 'chains' && selectedNodeIds.size > 0) {
    const chainEdgeIds = new Set<string>();
    storeEdges.forEach((e) => {
      if (selectedNodeIds.has(e.source_id) || selectedNodeIds.has(e.target_id)) {
        chainEdgeIds.add(e.id);
      }
    });
    storeEdges.forEach((e) => {
      if (chainEdgeIds.has(e.id)) {
        highlightedIds.add(e.id);
      } else {
        dimmedIds.add(e.id);
      }
    });
  } else if (effectiveActiveChain !== null) {
    storeEdges.forEach((e) => {
      if (effectiveActiveChain!.edgeIds.has(e.id)) {
        highlightedIds.add(e.id);
      } else {
        dimmedIds.add(e.id);
      }
    });
  }

  let isolatedIds: Set<string> | undefined;
  if (activeMultiMode === 'isolate' && selectedNodeIds.size > 0) {
    isolatedIds = new Set<string>();
    storeEdges.forEach((e) => {
      if (selectedNodeIds.has(e.source_id) && selectedNodeIds.has(e.target_id)) {
        isolatedIds!.add(e.id);
      }
    });
  }

  if (isExporting && exportScope === 'selected') {
    if (exportMode === 'isolated') {
      isolatedIds = new Set<string>();
      storeEdges.forEach((e) => {
        if (selectedNodeIds.has(e.source_id) && selectedNodeIds.has(e.target_id)) {
          isolatedIds!.add(e.id);
        }
      });
    } else if (exportMode === 'dimmed') {
      storeEdges.forEach((e) => {
        const isSelectedEdge = selectedNodeIds.has(e.source_id) && selectedNodeIds.has(e.target_id);
        if (!isSelectedEdge) {
          dimmedIds.add(e.id);
        }
      });
    }
  }

  return computeEdgeVisualState(
    edge,
    {
      dimmedIds,
      highlightedIds,
      selectedIds: selectedEdgeIds,
      isolatedIds,
      isHovered,
      theme,
      isExporting,
      exportKeepHighlightRings,
    }
  );
}
