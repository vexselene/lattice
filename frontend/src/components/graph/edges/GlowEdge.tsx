import React, { useState } from 'react';
import { BaseEdge, getBezierPath, EdgeProps, EdgeLabelRenderer } from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import { useGraphStore } from '../../../stores/graphStore';
import { useUIStore } from '../../../stores/uiStore';
import { EdgeRelation } from '../../../types/graph';
import { GRAPH_STYLE } from '../../../config/graphStyleConfig';

// Global map to preserve click timestamps perfectly even if React remounts the edge component
const edgeClickTimes = new Map<string, number>();

export const GlowEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
  data,
  animated,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const { deleteEdge, setOpenMenuEdgeId, openMenuEdgeId } = useGraphStore();
  const { theme, isEditMode } = useUIStore();
  const [isHovered, setIsHovered] = useState(false);
  const isMenuOpen = openMenuEdgeId === id && selected;

  const isDimmed = (data as any)?.isDimmed === true;
  const formatRelation = (r: string) => {
    return r.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };
  const relation = (data as any)?.relation || 'registered_with';

  const defaultColor = theme === 'dark' ? GRAPH_STYLE.colors.edge.baseDark : GRAPH_STYLE.colors.edge.baseLight;
  
  const strokeWidth = selected 
    ? GRAPH_STYLE.strokeWidth.highlighted 
    : (isHovered ? GRAPH_STYLE.strokeWidth.hover : GRAPH_STYLE.strokeWidth.base);
  const strokeColor = isDimmed 
    ? GRAPH_STYLE.colors.edge.dimmed 
    : (selected || isHovered ? GRAPH_STYLE.colors.edge.hover : defaultColor);
  const filter = selected 
    ? GRAPH_STYLE.glow.highlighted 
    : (isHovered ? 'drop-shadow(0 0 3px rgba(129, 140, 248, 0.3))' : 'none');
  const opacity = isDimmed ? GRAPH_STYLE.opacity.dimmed : GRAPH_STYLE.opacity.normal;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteEdge(id);
  };

  const handleRelationChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const val = e.target.value as EdgeRelation;
    try {
      const { updateEdge } = await import('../../../api/edges');
      await updateEdge(id, { relation: val });
      await useGraphStore.getState().fetchGraph();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only track primary pointer / left click
    if (e.button !== 0) return;

    const now = Date.now();
    const lastClickTime = edgeClickTimes.get(id) || 0;
    
    // Globally record the edge click to prevent phantom pane clicks
    (window as any).__lastEdgeClick = now;
    
    // Window for reliable trackpad double taps
    if (now - lastClickTime < GRAPH_STYLE.timing.doubleTapThresholdMs) {
      e.stopPropagation();
      e.preventDefault();
      setOpenMenuEdgeId(isMenuOpen ? null : id);
      (window as any).__lastMenuToggle = now;
      edgeClickTimes.set(id, 0); // reset
    } else {
      edgeClickTimes.set(id, now);
    }
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    // Swallow the native click event if we just toggled the menu via pointerdown
    if (Date.now() - ((window as any).__lastMenuToggle || 0) < GRAPH_STYLE.timing.suppressWindowMs) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={0}
        style={{
          ...style,
          strokeWidth,
          stroke: strokeColor,
          filter: isDimmed ? `blur(${GRAPH_STYLE.blur.dimmed})` : filter,
          opacity,
          pointerEvents: 'none',
          transition: 'stroke 300ms ease-out, stroke-opacity 300ms ease-out, stroke-width 300ms ease-out, opacity 300ms ease-out, filter 300ms ease-out',
        }}
      />

      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={GRAPH_STYLE.hitbox.width}
        onPointerDown={handlePointerDown}
        onClickCapture={handleClickCapture}
        vectorEffect="non-scaling-stroke"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="cursor-pointer"
        style={{ pointerEvents: 'all' }}
      />
      
      {animated && (
        <path
          d={edgePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray="5 5"
          className="react-flow__edge-path"
          style={{
            pointerEvents: 'none',
            opacity: 1,
            filter: GRAPH_STYLE.glow.highlighted,
            animation: 'dashdraw 0.5s linear infinite'
          }}
        />
      )}

      {isMenuOpen && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              zIndex: 1000
            }}
            className="nodrag nopan bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-md shadow-md max-w-[170px] w-auto px-1.5 py-1 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-1 group">
              {isEditMode ? (
                <select
                  value={relation}
                  onChange={handleRelationChange}
                  className="flex-1 text-[10px] font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-1 py-0.5 outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="registered_with">Registered With</option>
                  <option value="recovery_for">Recovery For</option>
                  <option value="uses_username">Uses Username</option>
                  <option value="linked_account">Linked Account</option>
                </select>
              ) : (
                <div className="flex items-center min-w-0 px-0.5">
                  <span className="text-[10px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {formatRelation(relation)}
                  </span>
                </div>
              )}
              {isEditMode && (
                <button
                  onClick={handleDelete}
                  className="p-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors shrink-0"
                  title="Delete Connection"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default GlowEdge;