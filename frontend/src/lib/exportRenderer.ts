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
import { getFocusState } from './focusState';
import { useGraphStore } from '../stores/graphStore';
import { GRAPH_STYLE } from '../config/graphStyleConfig';
import { computeNodeVisualState, computeEdgeVisualState } from '../hooks/useVisualState';
import { EmailNodeExport } from '../components/graph/nodes/EmailNodeExport';
import { AccountNodeExport } from '../components/graph/nodes/AccountNodeExport';
import { PhoneNodeExport } from '../components/graph/nodes/PhoneNodeExport';
import { ServiceNodeExport } from '../components/graph/nodes/ServiceNodeExport';

const nodeExportTypesMap: Record<string, React.FC<any>> = {
  email: EmailNodeExport,
  account: AccountNodeExport,
  phone: PhoneNodeExport,
  service: ServiceNodeExport,
};

export interface ExportRendererConfig {
  theme: 'dark' | 'light';
  showEdgeLabels?: boolean;
  includeBackground?: boolean;
  keepHighlightRings?: boolean;
  ringScope?: 'all' | 'selected' | 'none';
  edgeStyle?: 'normal' | 'dashed' | 'highlighted';
  edgeStyleApplyTo?: 'all' | 'selected' | 'nonSelected';
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

  const focus = getFocusState();
  const focusedNodeIds = new Set<string>([...focus.rootNodeIds, ...focus.neighborNodeIds]);
  const focusedEdgeIds = new Set<string>([...focus.rootEdgeIds, ...focus.neighborEdgeIds]);

  let ringNodeIds = new Set<string>();
  if (mode === 'dimmed' || mode === 'isolated') {
    const ringScope = config.ringScope ?? (config.keepHighlightRings ? 'selected' : 'none');
    if (ringScope === 'all') {
      ringNodeIds = focusedNodeIds;
    } else if (ringScope === 'selected') {
      ringNodeIds = focus.rootNodeIds;
    } else {
      ringNodeIds = new Set();
    }
  } else {
    ringNodeIds = config.keepHighlightRings ? activeSelectedNodeIds : new Set();
  }

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
  const gridGap = 24;

  const patternOffsetX = ((offsetX % gridGap) + gridGap) % gridGap;
  const patternOffsetY = ((offsetY % gridGap) + gridGap) % gridGap;

  // 5. Render Edges (drawn underneath nodes)
  const edgeSvgList: string[] = [];
  const markerDefs = new Map<string, string>();

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

    const defaultColor = isDark ? GRAPH_STYLE.colors.edge.baseDark : GRAPH_STYLE.colors.edge.baseLight;
    const highlightColor = isDark ? GRAPH_STYLE.colors.edge.highlightDark : GRAPH_STYLE.colors.edge.highlightLight;

    let stroke: string;
    let strokeWidth: number;
    let opacity: number;
    let filter: string;
    let strokeDasharray: string | undefined;
    let isEdgeHighlighted = false;

    if (mode === 'dimmed' || mode === 'isolated') {
      const isFocused = focusedEdgeIds.has(edge.id);

      if (!isFocused && mode === 'dimmed') {
        // Dimmed set: ALWAYS renders with standard dimmed styling regardless of edgeStyle/edgeStyleApplyTo
        stroke = GRAPH_STYLE.colors.edge.dimmed;
        strokeWidth = GRAPH_STYLE.strokeWidth.base;
        opacity = GRAPH_STYLE.opacity.dimmed;
        filter = `blur(${GRAPH_STYLE.blur.dimmed})`;
        strokeDasharray = undefined;
        isEdgeHighlighted = false;
      } else {
        // Focused edge set: apply edgeStyle / edgeStyleApplyTo
        const applyTo = config.edgeStyleApplyTo ?? 'all';
        let matchesApplyTo = false;
        if (applyTo === 'all') {
          matchesApplyTo = true;
        } else if (applyTo === 'selected') {
          matchesApplyTo = focus.rootEdgeIds.has(edge.id);
        } else if (applyTo === 'nonSelected') {
          matchesApplyTo = focus.neighborEdgeIds.has(edge.id);
        }

        if (matchesApplyTo) {
          const edgeStyle = config.edgeStyle ?? (mode === 'dimmed' ? 'dashed' : 'normal');
          if (edgeStyle === 'highlighted') {
            stroke = highlightColor;
            strokeWidth = GRAPH_STYLE.strokeWidth.highlighted;
            strokeDasharray = undefined;
            opacity = GRAPH_STYLE.opacity.normal;
            filter = isDark ? GRAPH_STYLE.glow.highlighted : 'none';
            isEdgeHighlighted = true;
          } else if (edgeStyle === 'dashed') {
            stroke = highlightColor;
            strokeWidth = GRAPH_STYLE.strokeWidth.highlighted;
            strokeDasharray = '5 5';
            opacity = GRAPH_STYLE.opacity.normal;
            filter = isDark ? GRAPH_STYLE.glow.highlighted : 'none';
            isEdgeHighlighted = true;
          } else {
            // 'normal'
            stroke = defaultColor;
            strokeWidth = GRAPH_STYLE.strokeWidth.base;
            strokeDasharray = undefined;
            opacity = GRAPH_STYLE.opacity.normal;
            filter = 'none';
            isEdgeHighlighted = false;
          }
        } else {
          // Edges in the focused set NOT covered by edgeStyleApplyTo render with normal default style
          stroke = defaultColor;
          strokeWidth = GRAPH_STYLE.strokeWidth.base;
          opacity = GRAPH_STYLE.opacity.normal;
          filter = 'none';
          strokeDasharray = undefined;
          isEdgeHighlighted = false;
        }
      }
    } else {
      // mode === 'all': edgeStyle and edgeStyleApplyTo are ignored/no-oped
      const edgeVisual = computeEdgeVisualState(edge, {
        theme: config.theme,
        dimmedIds,
        highlightedIds,
        selectedIds: config.keepHighlightRings ? activeSelectedEdgeIds : new Set(),
        isExporting: true,
        exportMode: mode,
        exportKeepHighlightRings: config.keepHighlightRings,
      });
      stroke = edgeVisual.stroke;
      strokeWidth = edgeVisual.strokeWidth;
      opacity = edgeVisual.opacity;
      filter = edgeVisual.filter !== 'none' ? edgeVisual.filter : '';
      strokeDasharray = edgeVisual.strokeDasharray;
      isEdgeHighlighted = edgeVisual.isHighlighted;
    }

    const markerWidth = isEdgeHighlighted ? 14 : 12;
    const markerHeight = isEdgeHighlighted ? 14 : 12;
    const markerStrokeWidth = isEdgeHighlighted ? 1.75 : 1.5;
    const markerColor = stroke;
    const markerId = `arrow-${markerColor.replace(/[^a-zA-Z0-9]/g, '')}-${markerWidth}-${String(markerStrokeWidth).replace('.', '_')}`;

    if (!markerDefs.has(markerId)) {
      markerDefs.set(
        markerId,
        `<marker id="${markerId}" viewBox="-10 -10 20 20" refX="0" refY="0" markerWidth="${markerWidth}" markerHeight="${markerHeight}" markerUnits="strokeWidth" orient="auto-start-reverse">
      <polyline class="arrow" stroke="${markerColor}" stroke-width="${markerStrokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none" points="-5,-4 0,0 -5,4" />
    </marker>`
      );
    }

    const dashAttr = strokeDasharray ? ` stroke-dasharray="${strokeDasharray}"` : '';
    const filterAttr = (filter && filter !== 'none') ? ` filter="${filter}"` : '';
    let edgeMarkup = `<path d="${edgePath}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"${filterAttr}${dashAttr} marker-end="url(#${markerId})" />`;

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
      <g transform="translate(${labelX}, ${labelY})" opacity="${opacity}">
        <rect x="${rectX}" y="${rectY}" width="${rectWidth}" height="${rectHeight}" rx="${labelConfig.borderRadius}" fill="${themeColors.bg}" stroke="${themeColors.border}" stroke-width="1" />
        <text x="0" y="0" text-anchor="middle" dominant-baseline="central" font-size="${labelConfig.fontSizePx}px" font-weight="${labelConfig.fontWeight}" font-family="${labelConfig.fontFamily}" fill="${themeColors.text}">${formatted}</text>
      </g>`;
    }

    edgeSvgList.push(edgeMarkup);
  }

  if (markerDefs.size === 0) {
    const defaultColor = isDark ? GRAPH_STYLE.colors.edge.baseDark : GRAPH_STYLE.colors.edge.baseLight;
    markerDefs.set(
      'arrowhead',
      `<marker id="arrowhead" viewBox="-10 -10 20 20" refX="0" refY="0" markerWidth="12" markerHeight="12" markerUnits="strokeWidth" orient="auto-start-reverse">
      <polyline class="arrow" stroke="${defaultColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" points="-5,-4 0,0 -5,4" />
    </marker>`
    );
  }

  // 6. Render Nodes wrapped in foreignObject
  const nodeSvgList: string[] = [];

  for (const node of includedNodes) {
    const nodeX = node.position.x + offsetX;
    const nodeY = node.position.y + offsetY;
    const nodeWidth = node.measured?.width || 200;
    const nodeHeight = node.measured?.height || 40;

    const isRingNode = ringNodeIds.has(node.id);
    const nodeVisual = computeNodeVisualState(
      { id: node.id, type: node.type },
      {
        dimmedIds,
        selectedIds: isRingNode ? new Set([node.id]) : new Set(),
        isExporting: true,
        exportKeepHighlightRings: isRingNode,
      }
    );

    const NodeExportComponent = nodeExportTypesMap[node.type || 'email'] || EmailNodeExport;
    const sanitizedData = {
      ...(node.data || {}),
      isExpanded: false,
      isEditing: false,
    };

    const renderedMarkup = ReactDOMServer.renderToStaticMarkup(
      React.createElement(NodeExportComponent, {
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
    ${Array.from(markerDefs.values()).join('\n    ')}
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
