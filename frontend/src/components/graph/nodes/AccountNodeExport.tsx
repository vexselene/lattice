import React from 'react';
import { AccountNode as AccountNodeType } from '../../../types/graph';
import { User } from 'lucide-react';
import { GRAPH_STYLE } from '../../../config/graphStyleConfig';
import { NodeVisualState } from '../../../hooks/useVisualState';

export interface AccountNodeExportProps {
  data: AccountNodeType;
  id?: string;
  exportMode?: boolean;
  theme?: 'dark' | 'light';
  visualState?: NodeVisualState;
}

export const AccountNodeExport: React.FC<AccountNodeExportProps> = ({ data, theme, visualState }) => {
  const themeMode = theme || 'dark';
  const nodeTheme = GRAPH_STYLE.colors.node.account[themeMode];
  const ringStyle = visualState?.ringClass
    ? `0 0 0 2px ${nodeTheme.ring}, 0 0 0 3px ${themeMode === 'dark' ? '#0f172a' : '#ffffff'}`
    : undefined;

  const serviceName = (data as any).service_name;
  const serviceColor = (data as any).service_color || '#a855f7';

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
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
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: serviceName ? '6px 10px 6px 12px' : '6px 12px',
          borderRadius: serviceName ? '9999px 0 0 9999px' : '9999px',
          backgroundColor: nodeTheme.bg,
          color: nodeTheme.text,
          border: `1px solid ${nodeTheme.border}`,
          borderRight: serviceName ? 'none' : `1px solid ${nodeTheme.border}`,
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
          <User style={{ width: '14px', height: '14px' }} />
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
          {data.username || 'New Account'}
        </span>
      </div>

      {serviceName && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '6px 14px 6px 10px',
            borderRadius: '0 9999px 9999px 0',
            backgroundColor: `${serviceColor}20`,
            color: serviceColor,
            border: `1px solid ${nodeTheme.border}`,
            fontSize: '12px',
            fontWeight: 600,
            maxWidth: '140px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {serviceName}
        </div>
      )}
    </div>
  );
};

export default AccountNodeExport;
