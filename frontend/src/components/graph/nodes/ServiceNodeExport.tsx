import React from 'react';
import { ServiceNode as ServiceNodeType } from '../../../types/graph';
import { Server } from 'lucide-react';
import { GRAPH_STYLE } from '../../../config/graphStyleConfig';
import { NodeVisualState } from '../../../hooks/useVisualState';

export interface ServiceNodeExportProps {
  data: ServiceNodeType;
  id?: string;
  exportMode?: boolean;
  theme?: 'dark' | 'light';
  visualState?: NodeVisualState;
}

export const ServiceNodeExport: React.FC<ServiceNodeExportProps> = ({ data, theme, visualState }) => {
  const themeMode = theme || 'dark';
  const nodeTheme = GRAPH_STYLE.colors.node.service[themeMode];
  const ringStyle = visualState?.ringClass
    ? `0 0 0 2px ${nodeTheme.ring}, 0 0 0 3px ${themeMode === 'dark' ? '#0f172a' : '#ffffff'}`
    : undefined;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        borderRadius: '9999px',
        backgroundColor: nodeTheme.bg,
        color: nodeTheme.text,
        border: `1px solid ${nodeTheme.border}`,
        boxShadow: ringStyle,
        opacity: visualState?.opacity ?? 1,
        filter: visualState?.filter ?? 'none',
        fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: '14px',
        fontWeight: 500,
        lineHeight: '20px',
        boxSizing: 'border-box',
        whiteSpace: 'nowrap',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px',
          borderRadius: '9999px',
          backgroundColor: nodeTheme.iconBg,
          color: nodeTheme.iconText,
          flexShrink: 0,
        }}
      >
        <Server style={{ width: '14px', height: '14px' }} />
      </div>
      <span
        style={{
          maxWidth: '150px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          letterSpacing: '-0.01em',
        }}
      >
        {data.name || 'New Service'}
      </span>
    </div>
  );
};

export default ServiceNodeExport;
