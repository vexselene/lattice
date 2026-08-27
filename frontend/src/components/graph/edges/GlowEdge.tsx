import React from 'react';
import { BaseEdge, getBezierPath, EdgeProps } from '@xyflow/react';
import { useGraphStore } from '../../../stores/graphStore';

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
}) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const { activeChain } = useGraphStore();
  const isActive = activeChain ? activeChain.edgeIds.has(id) : true;

  const strokeWidth = isActive ? (selected ? 3 : 2) : 1;
  const strokeColor = isActive ? (selected ? '#818cf8' : '#94a3b8') : '#94a3b8'; // pastel indigo active glow
  const filter = isActive ? (selected ? 'drop-shadow(0 0 5px rgba(129, 140, 248, 0.6))' : 'none') : 'blur(2.5px) grayscale(60%)';
  const opacity = isActive ? 1 : 0.25;
  const pointerEvents = isActive ? 'auto' : 'none';

  return (
    <>
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
          pointerEvents: pointerEvents as any,
          transition: 'all 0.3s ease-out',
        }}
      />
    </>
  );
};

export default GlowEdge;
