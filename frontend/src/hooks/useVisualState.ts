import { useGraphStore } from '../stores/graphStore';
import { useUIStore } from '../stores/uiStore';
import { GRAPH_STYLE } from '../config/graphStyleConfig';

const RING_CLASSES: Record<string, string> = {
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

  const isSelected = selectedNodeIds.has(nodeId);

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

  // Multi-chains / activeChain dimming computation
  let isDimmed = false;
  if (activeMultiMode === 'chains' && selectedNodeIds.size > 0) {
    const chainNodeIds = new Set<string>(selectedNodeIds);
    storeEdges.forEach((e) => {
      if (selectedNodeIds.has(e.source_id) || selectedNodeIds.has(e.target_id)) {
        chainNodeIds.add(e.source_id);
        chainNodeIds.add(e.target_id);
      }
    });
    if (!chainNodeIds.has(nodeId)) {
      isDimmed = true;
    }
  } else if (effectiveActiveChain !== null) {
    const nodeObj = storeNodes.find((n) => n.data.id === nodeId);
    const isEditing = (nodeObj?.data as any)?.isEditing;
    if (!effectiveActiveChain.nodeIds.has(nodeId) && !isEditing) {
      isDimmed = true;
    }
  }

  // Isolate mode visibility
  let isVisible = true;
  if (activeMultiMode === 'isolate' && selectedNodeIds.size > 0) {
    if (!selectedNodeIds.has(nodeId)) {
      isVisible = false;
    }
  }

  // Canvas Export State Overrides
  if (isExporting) {
    if (exportScope === 'selected') {
      if (exportMode === 'isolated') {
        if (!selectedNodeIds.has(nodeId)) {
          isVisible = false;
        }
      } else if (exportMode === 'dimmed') {
        if (!selectedNodeIds.has(nodeId)) {
          isDimmed = true;
        }
      }
    }
  }

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

  const edge = storeEdges.find((e) => e.id === edgeId);
  const isSelected = selectedEdgeIds.has(edgeId);

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

  let isDimmed = false;
  let isHighlighted = false;

  if (activeMultiMode === 'chains' && selectedNodeIds.size > 0) {
    const chainEdgeIds = new Set<string>();
    storeEdges.forEach((e) => {
      if (selectedNodeIds.has(e.source_id) || selectedNodeIds.has(e.target_id)) {
        chainEdgeIds.add(e.id);
      }
    });
    isHighlighted = chainEdgeIds.has(edgeId);
    isDimmed = !isHighlighted;
  } else if (effectiveActiveChain !== null) {
    isDimmed = !effectiveActiveChain.edgeIds.has(edgeId);
    isHighlighted = effectiveActiveChain.edgeIds.has(edgeId);
  }

  let isVisible = true;
  if (activeMultiMode === 'isolate' && selectedNodeIds.size > 0 && edge) {
    if (!selectedNodeIds.has(edge.source_id) || !selectedNodeIds.has(edge.target_id)) {
      isVisible = false;
    }
  }

  // Canvas Export State Overrides
  if (isExporting && edge) {
    const isSelectedEdge = selectedNodeIds.has(edge.source_id) && selectedNodeIds.has(edge.target_id);
    if (exportScope === 'selected') {
      if (exportMode === 'isolated') {
        if (!isSelectedEdge) {
          isVisible = false;
        }
      } else if (exportMode === 'dimmed') {
        if (!isSelectedEdge) {
          isDimmed = true;
        }
      }
    }
    if (!exportKeepHighlightRings) {
      isHighlighted = false;
    }
  }

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
