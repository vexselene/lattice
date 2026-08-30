import React from 'react';
import ReactDOMServer from 'react-dom/server';
import {
  getBezierPath,
  getNodesBounds,
  Position,
  Node as FlowNode,
  Edge as FlowEdge,
} from '@xyflow/react';
import { getExportIncludedIds, getExportEmphasis, ExportMode } from './exportSelection';
import { useGraphStore } from '../stores/graphStore';
import { GRAPH_STYLE } from '../config/graphStyleConfig';
import { computeNodeVisualState, computeEdgeVisualState } from '../hooks/useVisualState';
import { EmailNode } from '../components/graph/nodes/EmailNode';
import { AccountNode } from '../components/graph/nodes/AccountNode';
import { PhoneNode } from '../components/graph/nodes/PhoneNode';
import { ServiceNode } from '../components/graph/nodes/ServiceNode';

const nodeTypesMap: Record<string, React.FC<any>> = {
  email: EmailNode,
  account: AccountNode,
  phone: PhoneNode,
  service: ServiceNode,
};

export interface ExportRendererConfig {
  theme: 'dark' | 'light';
  showEdgeLabels?: boolean;
  includeBackground?: boolean;
  keepHighlightRings?: boolean;
}

function measureTextWidth(text: string, fontSizePx: number = 10): number {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === ' ') {
      width += fontSizePx * 0.28;
    } else if (/[ijlI1.,:;!]/.test(char)) {
      width += fontSizePx * 0.32;
    } else if (/[frtj\-]/.test(char)) {
      width += fontSizePx * 0.42;
    } else if (/[mwMW@]/.test(char)) {
      width += fontSizePx * 0.82;
    } else if (/[A-Z]/.test(char)) {
      width += fontSizePx * 0.68;
    } else {
      width += fontSizePx * 0.58;
    }
  }
  return Math.ceil(width);
}

function formatRelation(r: string): string {
  return r
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Serializes a graph (nodes & edges) into a standalone SVG string with 1:1 visual fidelity.
 * Applies visual styling via shared computeNodeVisualState & computeEdgeVisualState pure functions.
 */
export function graphToSvgString(
  nodes: FlowNode[],
  edges: FlowEdge[],
  mode: ExportMode = 'all',
  config: ExportRendererConfig = { theme: 'dark', showEdgeLabels: true, includeBackground: true, keepHighlightRings: false }
): string {
  // 1. Filter nodes/edges using getExportIncludedIds or standalone fallback
  let includedNodeIds: Set<string>;
  let includedEdgeIds: Set<string>;

  const storeResult = getExportIncludedIds(mode);
  if (storeResult.nodeIds.size > 0 || storeResult.edgeIds.size > 0) {
    includedNodeIds = storeResult.nodeIds;
    includedEdgeIds = storeResult.edgeIds;
  } else {
    // Standalone fallback when called with custom node/edge arrays without Zustand store
    if (mode === 'all' || mode === 'dimmed') {
      includedNodeIds = new Set(nodes.map((n) => n.id));
      includedEdgeIds = new Set(edges.map((e) => e.id));
    } else {
      // 'isolated'
      includedNodeIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
      includedEdgeIds = new Set(
        edges.filter((e) => includedNodeIds.has(e.source) && includedNodeIds.has(e.target)).map((e) => e.id)
      );
    }
  }

  const includedNodes = nodes.filter((n) => includedNodeIds.has(n.id));
  const includedEdges = edges.filter((e) => includedEdgeIds.has(e.id));

  if (includedNodes.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>`;
  }

  // 3. Compute visual emphasis & selection
  const emphasis = getExportEmphasis(mode);
  const dimmedIds = emphasis ? emphasis.dimmedIds : new Set<string>();
  const highlightedIds = emphasis ? emphasis.highlightedIds : new Set<string>();

  const storeSelectedNodeIds = useGraphStore.getState().selectedNodeIds;
  const storeSelectedEdgeIds = useGraphStore.getState().selectedEdgeIds;
  const activeSelectedNodeIds = new Set<string>([...storeSelectedNodeIds, ...nodes.filter((n) => n.selected).map((n) => n.id)]);
  const activeSelectedEdgeIds = new Set<string>([...storeSelectedEdgeIds, ...edges.filter((e) => e.selected).map((e) => e.id)]);

  // 3. Compute bounds and padding
  const bounds = getNodesBounds(includedNodes);
  const padding = GRAPH_STYLE.export.paddingPx;
  const exportWidth = Math.ceil(bounds.width + padding * 2);
  const exportHeight = Math.ceil(bounds.height + padding * 2);
  const offsetX = -bounds.x + padding;
  const offsetY = -bounds.y + padding;

  // 4. Theme & Grid setup (24px gap matching live Background)
  const isDark = config.theme === 'dark';
  const bgColor = isDark ? '#0B0F19' : '#F8FAFC';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const arrowColor = isDark ? GRAPH_STYLE.colors.edge.baseDark : GRAPH_STYLE.colors.edge.baseLight;
  const gridGap = 24;

  const patternOffsetX = ((offsetX % gridGap) + gridGap) % gridGap;
  const patternOffsetY = ((offsetY % gridGap) + gridGap) % gridGap;

  // 5. Render Edges (drawn underneath nodes)
  const edgeSvgList: string[] = [];

  for (const edge of includedEdges) {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);

    const sNodeWidth = sourceNode?.measured?.width || 180;
    const sNodeHeight = sourceNode?.measured?.height || 36;
    const tNodeHeight = targetNode?.measured?.height || 36;

    const sourceX = ((edge as any).sourceX ?? (sourceNode ? sourceNode.position.x + sNodeWidth : 0)) + offsetX;
    const sourceY = ((edge as any).sourceY ?? (sourceNode ? sourceNode.position.y + sNodeHeight / 2 : 0)) + offsetY;
    const targetX = ((edge as any).targetX ?? (targetNode ? targetNode.position.x : 0)) + offsetX;
    const targetY = ((edge as any).targetY ?? (targetNode ? targetNode.position.y + tNodeHeight / 2 : 0)) + offsetY;

    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition: Position.Right,
      targetX,
      targetY,
      targetPosition: Position.Left,
    });

    const edgeVisual = computeEdgeVisualState(edge, {
      theme: config.theme,
      dimmedIds,
      highlightedIds,
      selectedIds: config.keepHighlightRings ? activeSelectedEdgeIds : new Set(),
      isExporting: true,
      exportKeepHighlightRings: config.keepHighlightRings,
    });

    let edgeMarkup = `<path d="${edgePath}" fill="none" stroke="${edgeVisual.stroke}" stroke-width="${edgeVisual.strokeWidth}" opacity="${edgeVisual.opacity}" filter="${edgeVisual.filter !== 'none' ? edgeVisual.filter : ''}" stroke-dasharray="${edgeVisual.strokeDasharray || ''}" marker-end="url(#arrowhead)" />`;

    const relation = (edge.data?.relation as string) || (edge.label as string);
    if (relation && config.showEdgeLabels !== false) {
      const formatted = formatRelation(relation);
      const labelConfig = GRAPH_STYLE.edgeLabel;
      const themeColors = labelConfig.colors[isDark ? 'dark' : 'light'];
      const textWidth = measureTextWidth(formatted, labelConfig.fontSizePx);
      const rectWidth = textWidth + labelConfig.paddingX * 2;
      const rectHeight = labelConfig.heightPx;
      const rectX = -rectWidth / 2;
      const rectY = -rectHeight / 2;

      edgeMarkup += `
      <g transform="translate(${labelX}, ${labelY})" opacity="${edgeVisual.opacity}">
        <rect x="${rectX}" y="${rectY}" width="${rectWidth}" height="${rectHeight}" rx="${labelConfig.borderRadius}" fill="${themeColors.bg}" stroke="${themeColors.border}" stroke-width="1" />
        <text x="0" y="0" text-anchor="middle" dominant-baseline="central" font-size="${labelConfig.fontSizePx}px" font-weight="${labelConfig.fontWeight}" font-family="${labelConfig.fontFamily}" fill="${themeColors.text}">${formatted}</text>
      </g>`;
    }

    edgeSvgList.push(edgeMarkup);
  }

  // 6. Render Nodes wrapped in foreignObject
  const nodeSvgList: string[] = [];

  for (const node of includedNodes) {
    const nodeX = node.position.x + offsetX;
    const nodeY = node.position.y + offsetY;
    const nodeWidth = node.measured?.width || 200;
    const nodeHeight = node.measured?.height || 40;

    const nodeVisual = computeNodeVisualState(
      { id: node.id, type: node.type },
      {
        dimmedIds,
        selectedIds: config.keepHighlightRings ? activeSelectedNodeIds : new Set(),
        isExporting: true,
        exportKeepHighlightRings: config.keepHighlightRings,
      }
    );

    const NodeComponent = nodeTypesMap[node.type || 'email'] || EmailNode;
    const sanitizedData = {
      ...(node.data || {}),
      isExpanded: false,
      isEditing: false,
    };

    const renderedMarkup = ReactDOMServer.renderToStaticMarkup(
      React.createElement(NodeComponent, {
        id: node.id,
        data: sanitizedData,
        exportMode: true,
        theme: config.theme,
        visualState: nodeVisual,
      })
    );

    nodeSvgList.push(`
    <foreignObject x="${nodeX}" y="${nodeY}" width="${nodeWidth}" height="${nodeHeight}" overflow="visible">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width: 100%; height: 100%;">
        ${renderedMarkup}
      </div>
    </foreignObject>`);
  }

  // 7. Root SVG Document
  const bgMarkup = config.includeBackground !== false ? `
  <!-- Background -->
  <rect width="100%" height="100%" fill="${bgColor}" />
  <rect width="100%" height="100%" fill="url(#grid-pattern)" />` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${exportWidth}" height="${exportHeight}" viewBox="0 0 ${exportWidth} ${exportHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="grid-pattern" width="${gridGap}" height="${gridGap}" patternUnits="userSpaceOnUse" x="${patternOffsetX}" y="${patternOffsetY}">
      <path d="M ${gridGap} 0 L 0 0 0 ${gridGap}" fill="none" stroke="${gridColor}" stroke-width="1" />
    </pattern>
    <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="${arrowColor}" />
    </marker>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap');
      text, div, span, p {
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
    </style>
  </defs>${bgMarkup}

  <!-- Edges -->
  <g class="edges">
    ${edgeSvgList.join('\n    ')}
  </g>

  <!-- Nodes -->
  <g class="nodes">
    ${nodeSvgList.join('\n    ')}
  </g>
</svg>`;
}

export default graphToSvgString;
