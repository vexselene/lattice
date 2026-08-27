import React from 'react';
import { BaseEdge, getBezierPath, EdgeProps } from '@xyflow/react';

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

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: selected ? 3 : 2,
          stroke: selected ? '#38bdf8' : '#94a3b8',
          filter: selected ? 'drop-shadow(0 0 5px rgba(56, 189, 248, 0.8))' : 'none',
          transition: 'stroke 0.2s, stroke-width 0.2s, filter 0.2s',
        }}
      />
    </>
  );
};

export default GlowEdge;
