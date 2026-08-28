import React from 'react';
import { BaseEdge, getBezierPath, EdgeProps, EdgeLabelRenderer } from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import { useGraphStore } from '../../../stores/graphStore';
import { useUIStore } from '../../../stores/uiStore';
import { EdgeRelation } from '../../../types/graph';

export const GlowEdge: React.FC<EdgeProps> = ({
  id,
  source,
  target,
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

  const { deleteEdge, setActiveChain } = useGraphStore();
  const { theme } = useUIStore();

  const isDimmed = (data as any)?.isDimmed === true;
  const isMenuOpen = (data as any)?.isMenuOpen === true;
  const relation = (data as any)?.relation || 'registered_with';

  const defaultColor = theme === 'dark' ? '#64748b' : '#475569';
  
  const strokeWidth = selected ? 2.5 : 1.25;
  const strokeColor = isDimmed ? '#475569' : (selected ? '#818cf8' : defaultColor);
  const filter = selected ? 'drop-shadow(0 0 5px rgba(129, 140, 248, 0.5))' : 'none';
  const opacity = isDimmed ? 0.2 : 1;
  const pointerEvents = 'auto';

  const onEdgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nodes = new Set<string>();
    nodes.add(source);
    nodes.add(target);
    const edges = new Set<string>();
    edges.add(id);
    setActiveChain({ nodeIds: nodes, edgeIds: edges });
  };

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

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        onClick={onEdgeClick}
        className="cursor-pointer"
        style={{ pointerEvents: pointerEvents as any }}
      />

      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth,
          stroke: strokeColor,
          filter,
          opacity,
          pointerEvents: 'none',
          transition: 'stroke 300ms ease-out, stroke-opacity 300ms ease-out, stroke-width 300ms ease-out, opacity 300ms ease-out, filter 300ms ease-out',
        }}
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
            filter: 'drop-shadow(0 0 5px rgba(129, 140, 248, 0.8))',
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
            className="nodrag nopan flex items-center gap-2 p-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <select
              value={relation}
              onChange={handleRelationChange}
              className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 outline-none focus:border-indigo-500 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <option value="registered_with">Registered With</option>
              <option value="recovery_for">Recovery For</option>
              <option value="uses_username">Uses Username</option>
              <option value="linked_account">Linked Account</option>
            </select>
            <button
              onClick={handleDelete}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors"
              title="Delete Connection"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default GlowEdge;
