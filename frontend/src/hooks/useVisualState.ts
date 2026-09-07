import { useGraphStore } from '../stores/graphStore';
import { useUIStore } from '../stores/uiStore';
import { GRAPH_STYLE } from '../config/graphStyleConfig';
import { getFocusState } from '../lib/focusState';

export const RING_CLASSES: Record<string, string> = {
  email: '!border-indigo-600 dark:!border-indigo-400',
  account: '!border-purple-600 dark:!border-purple-400',
  phone: '!border-amber-600 dark:!border-amber-400',
  service: '!border-emerald-600 dark:!border-emerald-400',
  default: '!border-indigo-600 dark:!border-indigo-400',
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
    : 'none';

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
  exportMode?: 'all' | 'dimmed' | 'isolated';
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
    exportMode,
    exportKeepHighlightRings = false,
  }: EdgeVisualContext = {}
): EdgeVisualState {
  const edgeId = typeof edge === 'string' ? edge : edge.id;

  const isSelected = selectedIds ? selectedIds.has(edgeId) : false;
  const isHighlighted = highlightedIds ? highlightedIds.has(edgeId) : false;
  const isDimmed = dimmedIds ? dimmedIds.has(edgeId) : false;
  const isVisible = isolatedIds ? isolatedIds.has(edgeId) : true;

  const defaultColor = theme === 'dark' ? GRAPH_STYLE.colors.edge.baseDark : GRAPH_STYLE.colors.edge.baseLight;
  const highlightColor = theme === 'dark' ? GRAPH_STYLE.colors.edge.highlightDark : GRAPH_STYLE.colors.edge.highlightLight;

  const effectiveSelectedOrHighlighted = isExporting
    ? (exportMode === 'dimmed' ? isHighlighted : (exportKeepHighlightRings && (isSelected || isHighlighted)))
    : (isSelected || isHighlighted);

  const stroke = isDimmed
    ? GRAPH_STYLE.colors.edge.dimmed
    : (effectiveSelectedOrHighlighted || isHovered
        ? highlightColor
        : defaultColor);

  const strokeWidth = effectiveSelectedOrHighlighted
    ? GRAPH_STYLE.strokeWidth.highlighted
    : (isHovered ? GRAPH_STYLE.strokeWidth.hover : GRAPH_STYLE.strokeWidth.base);

  const filter = isDimmed
    ? `blur(${GRAPH_STYLE.blur.dimmed})`
    : (effectiveSelectedOrHighlighted
        ? (theme === 'dark' ? GRAPH_STYLE.glow.highlighted : 'none')
        : (isHovered ? (theme === 'dark' ? 'drop-shadow(0 0 3px rgba(129, 140, 248, 0.3))' : 'none') : 'none'));

  let strokeDasharray: string | undefined = undefined;
  if (isExporting) {
    if (exportMode === 'dimmed' && isHighlighted) {
      strokeDasharray = '5 5';
    } else {
      strokeDasharray = undefined;
    }
  } else {
    strokeDasharray = isHighlighted ? '5 5' : undefined;
  }
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
  const selectedNodeIds = useGraphStore((s) => s.selectedNodeIds);
  const activeMultiMode = useGraphStore((s) => s.activeMultiMode);
  const isExporting = useGraphStore((s) => s.isExporting);
  const exportScope = useGraphStore((s) => s.exportScope);
  const exportMode = useGraphStore((s) => s.exportMode);
  const exportKeepHighlightRings = useGraphStore((s) => s.exportKeepHighlightRings);
  const storeNodes = useGraphStore((s) => s.nodes);

  const focus = getFocusState();
  const dimmedIds = new Set<string>();

  const isNodeFocused = (id: string) => focus.rootNodeIds.has(id) || focus.neighborNodeIds.has(id);

  if (focus.hasActiveFocus) {
    storeNodes.forEach((n) => {
      const id = n.data?.id || (n as any).id;
      const isEditing = (n.data as any)?.isEditing;
      if (id && !isNodeFocused(id) && !isEditing) {
        dimmedIds.add(id);
      }
    });
  }

  let isolatedIds: Set<string> | undefined;
  if (activeMultiMode === 'isolate' && focus.hasActiveFocus) {
    isolatedIds = new Set([...focus.rootNodeIds, ...focus.neighborNodeIds]);
  }

  if (isExporting && exportScope === 'selected') {
    if (exportMode === 'isolated') {
      isolatedIds = new Set([...focus.rootNodeIds, ...focus.neighborNodeIds]);
    } else if (exportMode === 'dimmed') {
      storeNodes.forEach((n) => {
        const id = n.data?.id || (n as any).id;
        if (id && !isNodeFocused(id)) {
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
  const selectedEdgeIds = useGraphStore((s) => s.selectedEdgeIds);
  const activeMultiMode = useGraphStore((s) => s.activeMultiMode);
  const isExporting = useGraphStore((s) => s.isExporting);
  const exportScope = useGraphStore((s) => s.exportScope);
  const exportMode = useGraphStore((s) => s.exportMode);
  const exportKeepHighlightRings = useGraphStore((s) => s.exportKeepHighlightRings);
  const theme = useUIStore((s) => s.theme);

  const edge = storeEdges.find((e) => e.id === edgeId) || { id: edgeId };

  const focus = getFocusState();
  const dimmedIds = new Set<string>();
  const highlightedIds = new Set<string>();

  const isEdgeFocused = (id: string) => focus.rootEdgeIds.has(id) || focus.neighborEdgeIds.has(id);

  if (focus.hasActiveFocus) {
    storeEdges.forEach((e) => {
      if (isEdgeFocused(e.id)) {
        highlightedIds.add(e.id);
      } else {
        dimmedIds.add(e.id);
      }
    });
  }

  let isolatedIds: Set<string> | undefined;
  if (activeMultiMode === 'isolate' && focus.hasActiveFocus) {
    isolatedIds = new Set([...focus.rootEdgeIds, ...focus.neighborEdgeIds]);
  }

  if (isExporting && exportScope === 'selected') {
    if (exportMode === 'isolated') {
      isolatedIds = new Set([...focus.rootEdgeIds, ...focus.neighborEdgeIds]);
    } else if (exportMode === 'dimmed') {
      storeEdges.forEach((e) => {
        if (!isEdgeFocused(e.id)) {
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
      exportMode,
      exportKeepHighlightRings,
    }
  );
}
