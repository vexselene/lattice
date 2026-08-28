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
  data,
}) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // isDimmed is computed in GraphCanvas and passed as edge data
  const isDimmed = (data as any)?.isDimmed === true;

  const strokeWidth = isDimmed ? 1 : (selected ? 3 : 2);
  const strokeColor = isDimmed ? '#94a3b8' : (selected ? '#818cf8' : '#94a3b8');
  const filter = isDimmed ? 'blur(2.5px) grayscale(60%)' : (selected ? 'drop-shadow(0 0 5px rgba(129, 140, 248, 0.6))' : 'none');
  const opacity = isDimmed ? 0.25 : 1;
  const pointerEvents = isDimmed ? 'none' : 'auto';

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
