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

// ─── Icon SVG content (extracted from lucide-react, rendered at 14×14 in a 24×24 viewBox) ───

/**
 * Returns an inline SVG <g> string for a lucide icon, scaled and positioned at (cx, cy)
 * centered in a 14×14 icon area. The icon is painted with the given stroke color.
 * viewBox is 0 0 24 24 so we scale with a transform.
 */
function renderIcon(
  type: string,
  cx: number,
  cy: number,
  stroke: string
): string {
  const size = 14;
  const scale = size / 24;
  const tx = cx - size / 2;
  const ty = cy - size / 2;
  const transform = `translate(${tx},${ty}) scale(${scale.toFixed(6)})`;
  const commonAttrs = `fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;

  let paths: string;
  switch (type) {
    case 'email':
      paths = `<rect x="2" y="4" width="20" height="16" rx="2" ${commonAttrs}/><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" ${commonAttrs}/>`;
      break;
    case 'account':
      paths = `<circle cx="12" cy="7" r="4" ${commonAttrs}/><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" ${commonAttrs}/>`;
      break;
    case 'phone':
      paths = `<rect width="14" height="20" x="5" y="2" rx="2" ry="2" ${commonAttrs}/><path d="M12 18h.01" ${commonAttrs}/>`;
      break;
    case 'service':
    default:
      paths = `<rect width="20" height="8" x="2" y="2" rx="2" ry="2" ${commonAttrs}/><rect width="20" height="8" x="2" y="14" rx="2" ry="2" ${commonAttrs}/><line x1="6" x2="6.01" y1="6" y2="6" ${commonAttrs}/><line x1="6" x2="6.01" y1="18" y2="18" ${commonAttrs}/>`;
      break;
  }

  return `<g transform="${transform}">${paths}</g>`;
}

// ─── Text width estimator ───
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

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── Node type colors ───
type NodeColorKey = 'email' | 'account' | 'phone' | 'service';
const NODE_COLOR_KEYS: NodeColorKey[] = ['email', 'account', 'phone', 'service'];

function getNodeColors(type: string | undefined, isDark: boolean) {
  const key = (NODE_COLOR_KEYS.includes(type as NodeColorKey) ? type : 'email') as NodeColorKey;
  return GRAPH_STYLE.colors.node[key][isDark ? 'dark' : 'light'];
}

// ─── Pure dimension calculator for SVG export ───
export function getNodeExportDimensions(node: FlowNode): { width: number; height: number } {
  const type = node.type || 'email';
  const data = node.data as any;
  const H = 32;

  const paddingL = 6;
  const paddingR = 12;
  const iconCircleDiam = 22;
  const gapIconText = 8;
  const fontSize = 14;
  const maxTextPx = 150;

  let label: string;
  switch (type) {
    case 'email':   label = data.address  || 'New Email';   break;
    case 'account': label = data.username || 'New Account'; break;
    case 'phone':   label = data.number   || 'New Phone';   break;
    case 'service': label = data.name     || 'New Service'; break;
    default:        label = String(data.address || data.username || data.name || data.number || type);
  }

  const charPx = fontSize * 0.6;
  const maxChars = Math.floor(maxTextPx / charPx);
  const displayLabel = label.length > maxChars ? label.slice(0, maxChars - 1) + '\u2026' : label;
  const textW = Math.min(measureTextWidth(displayLabel, fontSize), maxTextPx);

  const isDualPill = type === 'account' && Boolean(data.service_name || data.service_id);
  if (isDualPill) {
    const serviceName = data.service_name || data.service_id;
    const sFontSize = 12;
    const sMaxChars = Math.floor(maxTextPx / (sFontSize * 0.6));
    const sDisplayLabel = serviceName.length > sMaxChars ? serviceName.slice(0, sMaxChars - 1) + '\u2026' : serviceName;
    const sTextW = Math.min(measureTextWidth(sDisplayLabel, sFontSize), maxTextPx);

    const padR1 = 8;
    const W1 = paddingL + iconCircleDiam + gapIconText + textW + padR1;
    const padL2 = 8;
    const padR2 = 12;
    const W2 = padL2 + sTextW + padR2;
    return { width: W1 + W2, height: H };
  }

  const pillW = paddingL + iconCircleDiam + gapIconText + textW + paddingR;
  return { width: pillW, height: H };
}

// ─── Pure-SVG node pill renderer ───
function renderNodeAsSvg(
  node: FlowNode,
  nodeX: number,
  nodeY: number,
  isDark: boolean,
  nodeVisual: ReturnType<typeof computeNodeVisualState>
): string {
  const type = node.type || 'email';
  const colors = getNodeColors(type, isDark);

  const H = 32;
  const paddingY = 6;
  const paddingL = 6;
  const paddingR = 12;
  const iconCircleDiam = 22;
  const iconCircleR = iconCircleDiam / 2;
  const gapIconText = 8;
  const fontSize = 14;
  const fontFamily = "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const maxTextPx = 150;

  const data = node.data as any;
  let label: string;
  switch (type) {
    case 'email':   label = data.address  || 'New Email';   break;
    case 'account': label = data.username || 'New Account'; break;
    case 'phone':   label = data.number   || 'New Phone';   break;
    case 'service': label = data.name     || 'New Service'; break;
    default:        label = String(data.address || data.username || data.name || data.number || type);
  }

  const charPx = fontSize * 0.6;
  const maxChars = Math.floor(maxTextPx / charPx);
  const displayLabel = label.length > maxChars ? label.slice(0, maxChars - 1) + '\u2026' : label;
  const textW = Math.min(measureTextWidth(displayLabel, fontSize), maxTextPx);
  const pillW = paddingL + iconCircleDiam + gapIconText + textW + paddingR;

  const opacity = nodeVisual.opacity;
  const filterStr = (nodeVisual.filter && nodeVisual.filter !== 'blur(0px) grayscale(0%)')
    ? ` filter="${nodeVisual.filter}"` : '';

  const hasRing = !!nodeVisual.ringClass;
  const ringColor = colors.ring;
  const iconCx = paddingL + iconCircleR;
  const iconCy = H / 2;
  const clipId = `clip-${node.id.replace(/[^a-zA-Z0-9]/g, '-')}`;

  const parts: string[] = [];

  // Check if dual-pill account
  const isDualPill = type === 'account' && Boolean(data.service_name || data.service_id);
  if (isDualPill) {
    const serviceName = data.service_name || data.service_id;
    const serviceColor = data.service_color || '#3B82F6';
    const sFontSize = 12;
    const sMaxChars = Math.floor(maxTextPx / (sFontSize * 0.6));
    const sDisplayLabel = serviceName.length > sMaxChars ? serviceName.slice(0, sMaxChars - 1) + '\u2026' : serviceName;
    const sTextW = Math.min(measureTextWidth(sDisplayLabel, sFontSize), maxTextPx);

    const padR1 = 8;
    const W1 = paddingL + iconCircleDiam + gapIconText + textW + padR1;
    const padL2 = 8;
    const padR2 = 12;
    const W2 = padL2 + sTextW + padR2;
    const totalW = W1 + W2;

    // 1. Left segment (Account)
    parts.push(
      `<path d="M 16 0 L ${W1} 0 L ${W1} ${H} L 16 ${H} A 16 16 0 0 1 0 16 A 16 16 0 0 1 16 0 Z" fill="${colors.bg}"/>`
    );

    // 2. Right segment (Service)
    parts.push(
      `<path d="M ${W1} 0 L ${totalW - 16} 0 A 16 16 0 0 1 ${totalW} 16 A 16 16 0 0 1 ${totalW - 16} ${H} L ${W1} ${H} Z" fill="${serviceColor}" fill-opacity="${isDark ? '0.2' : '0.12'}"/>`
    );

    // 3. Divider line
    parts.push(
      `<line x1="${W1}" y1="0" x2="${W1}" y2="${H}" stroke="${colors.border}" stroke-width="1"/>`
    );

    // 4. Outer border (only when selected)
    if (hasRing) {
      parts.push(
        `<rect x="0" y="0" width="${totalW}" height="${H}" rx="${H / 2}" ry="${H / 2}" fill="none" stroke="${ringColor}" stroke-width="2"/>`
      );
    }

    // Icon background circle
    parts.push(`<circle cx="${iconCx}" cy="${iconCy}" r="${iconCircleR}" fill="${colors.iconBg}"/>`);

    // Icon paths
    parts.push(renderIcon(type, iconCx, iconCy, colors.iconText));

    // Left text (username)
    const textX = paddingL + iconCircleDiam + gapIconText;
    const textY = H / 2;
    parts.push(
      `<defs><clipPath id="${clipId}"><rect x="${textX}" y="${paddingY}" width="${maxTextPx}" height="${H - paddingY * 2}"/></clipPath></defs>`
    );
    parts.push(
      `<text x="${textX}" y="${textY}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="500" fill="${colors.text}" dominant-baseline="central" clip-path="url(#${clipId})">${escapeXml(displayLabel)}</text>`
    );

    // Right text (service)
    const sClipId = `${clipId}-service`;
    const sTextX = W1 + padL2;
    const sTextY = H / 2;
    parts.push(
      `<defs><clipPath id="${sClipId}"><rect x="${sTextX}" y="${paddingY}" width="${maxTextPx}" height="${H - paddingY * 2}"/></clipPath></defs>`
    );
    parts.push(
      `<text x="${sTextX}" y="${sTextY}" font-family="${fontFamily}" font-size="${sFontSize}" font-weight="600" fill="${serviceColor}" dominant-baseline="central" clip-path="url(#${sClipId})">${escapeXml(sDisplayLabel)}</text>`
    );

    return `<g transform="translate(${nodeX},${nodeY})" opacity="${opacity}"${filterStr}>\n  ${parts.join('\n  ')}\n</g>`;
  }

  // Pill fill + border (border only when selected)
  parts.push(
    `<rect x="0" y="0" width="${pillW}" height="${H}" rx="${H / 2}" ry="${H / 2}" fill="${colors.bg}" stroke="${hasRing ? ringColor : 'none'}" stroke-width="${hasRing ? 2 : 0}"/>`
  );

  // Icon background circle
  parts.push(`<circle cx="${iconCx}" cy="${iconCy}" r="${iconCircleR}" fill="${colors.iconBg}"/>`);

  // Icon paths
  parts.push(renderIcon(type, iconCx, iconCy, colors.iconText));

  // Text clip + label
  const textX = paddingL + iconCircleDiam + gapIconText;
  const textY = H / 2;

  parts.push(
    `<defs><clipPath id="${clipId}"><rect x="${textX}" y="${paddingY}" width="${maxTextPx}" height="${H - paddingY * 2}"/></clipPath></defs>`
  );
  parts.push(
    `<text x="${textX}" y="${textY}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="500" fill="${colors.text}" dominant-baseline="central" clip-path="url(#${clipId})">${escapeXml(displayLabel)}</text>`
  );

  return `<g transform="translate(${nodeX},${nodeY})" opacity="${opacity}"${filterStr}>\n  ${parts.join('\n  ')}\n</g>`;
}

// ─── Public Config ───
export interface ExportRendererConfig {
  theme: 'dark' | 'light';
  showEdgeLabels?: boolean;
  includeBackground?: boolean;
  keepHighlightRings?: boolean;
  ringScope?: 'all' | 'selected' | 'none';
  edgeStyle?: 'normal' | 'dashed' | 'highlighted';
  edgeStyleApplyTo?: 'all' | 'selected' | 'nonSelected';
}

// ─── Main export function ───
/**
 * Serializes a graph into a standalone SVG string using ONLY pure SVG primitives.
 * No foreignObject, no HTML, no CSS classes. All styling is inline SVG attributes.
 * Canvas-safe: drawImage() of this SVG will not taint the canvas.
 */
export function graphToSvgString(
  nodes: FlowNode[],
  edges: FlowEdge[],
  mode: ExportMode = 'all',
  config: ExportRendererConfig = { theme: 'dark', showEdgeLabels: true, includeBackground: true, keepHighlightRings: false }
): string {
  // 1. Determine included nodes/edges
  let includedNodeIds: Set<string>;
  let includedEdgeIds: Set<string>;

  const storeResult = getExportIncludedIds(mode);
  if (mode === 'isolated') {
    includedNodeIds = storeResult.nodeIds;
    includedEdgeIds = storeResult.edgeIds;
  } else if (storeResult.nodeIds.size > 0 || storeResult.edgeIds.size > 0) {
    includedNodeIds = storeResult.nodeIds;
    includedEdgeIds = storeResult.edgeIds;
  } else {
    includedNodeIds = new Set(nodes.map((n) => n.id));
    includedEdgeIds = new Set(edges.map((e) => e.id));
  }

  // Exclude hidden nodes
  const visibleNodeSet = new Set(nodes.filter((n) => !n.hidden).map((n) => n.id));
  includedNodeIds = new Set([...includedNodeIds].filter((id) => visibleNodeSet.has(id)));
  includedEdgeIds = new Set([...includedEdgeIds].filter((id) => {
    const edge = edges.find((e) => e.id === id);
    if (!edge) return false;
    return includedNodeIds.has(edge.source) && includedNodeIds.has(edge.target);
  }));

  const includedNodes = nodes.filter((n) => includedNodeIds.has(n.id));
  const includedEdges = edges.filter((e) => includedEdgeIds.has(e.id));

  // 2. Visual emphasis
  const focus = getFocusState();
  const emphasis = getExportEmphasis(mode);
  let dimmedIds        = emphasis ? emphasis.dimmedIds      : new Set<string>();
  const highlightedIds = emphasis ? emphasis.highlightedIds : new Set<string>();

  if (mode === 'dimmed' && !focus.hasActiveFocus) {
    dimmedIds = new Set<string>([...includedNodeIds, ...includedEdgeIds]);
  }

  const storeSelectedNodeIds = useGraphStore.getState().selectedNodeIds;
  const storeSelectedEdgeIds = useGraphStore.getState().selectedEdgeIds;
  const activeSelectedNodeIds = new Set<string>([...storeSelectedNodeIds, ...nodes.filter((n) => n.selected).map((n) => n.id)]);
  const activeSelectedEdgeIds = new Set<string>([...storeSelectedEdgeIds, ...edges.filter((e) => e.selected).map((e) => e.id)]);

  const focusedNodeIds = new Set<string>([...focus.rootNodeIds, ...focus.neighborNodeIds]);
  const focusedEdgeIds = new Set<string>([...focus.rootEdgeIds, ...focus.neighborEdgeIds]);

  let ringNodeIds = new Set<string>();
  if (mode === 'dimmed' || mode === 'isolated') {
    const ringScope = config.ringScope ?? (config.keepHighlightRings ? 'selected' : 'none');
    if (ringScope === 'all') ringNodeIds = focusedNodeIds;
    else if (ringScope === 'selected') ringNodeIds = focus.rootNodeIds;
    else ringNodeIds = new Set();
  } else {
    ringNodeIds = config.keepHighlightRings ? activeSelectedNodeIds : new Set();
  }

  // 3. Bounds, minimum dimensions, and 16:9 aspect ratio
  const MIN_WIDTH  = (GRAPH_STYLE.export as any).minWidthPx  ?? 960;
  const MIN_HEIGHT = (GRAPH_STYLE.export as any).minHeightPx ?? 540;
  const padding    = GRAPH_STYLE.export.paddingPx;

  let exportWidth = MIN_WIDTH;
  let exportHeight = MIN_HEIGHT;
  let offsetX = 0;
  let offsetY = 0;

  if (includedNodes.length > 0) {
    const nodesForBounds = includedNodes.map((n) => {
      const dims = getNodeExportDimensions(n);
      return {
        ...n,
        measured: { width: dims.width, height: dims.height },
        width: dims.width,
        height: dims.height,
      };
    });
    const bounds = getNodesBounds(nodesForBounds);
    const contentWidth  = Math.ceil(bounds.width  + padding * 2);
    const contentHeight = Math.ceil(bounds.height + padding * 2);

    exportWidth  = Math.max(contentWidth, MIN_WIDTH);
    exportHeight = Math.max(contentHeight, MIN_HEIGHT);

    // If narrower than 16:9, expand width to maintain at least 16:9
    if (exportWidth / exportHeight < 16 / 9) {
      exportWidth = Math.ceil(exportHeight * (16 / 9));
    }

    const extraX = Math.max(0, exportWidth - contentWidth);
    const extraY = Math.max(0, exportHeight - contentHeight);
    offsetX = -bounds.x + padding + extraX / 2;
    offsetY = -bounds.y + padding + extraY / 2;
  }

  // 4. Theme & Grid
  const isDark    = config.theme === 'dark';
  const bgColor   = isDark ? '#0B0F19' : '#F8FAFC';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const gridGap   = 24;
  const patternOffsetX = ((offsetX % gridGap) + gridGap) % gridGap;
  const patternOffsetY = ((offsetY % gridGap) + gridGap) % gridGap;

  // 5. Render Edges
  const edgeSvgList: string[] = [];
  const markerDefs = new Map<string, string>();

  for (const edge of includedEdges) {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);

    const sDims = sourceNode ? getNodeExportDimensions(sourceNode) : { width: 180, height: 32 };
    const tDims = targetNode ? getNodeExportDimensions(targetNode) : { width: 180, height: 32 };

    const sNodeWidth  = sDims.width;
    const sNodeHeight = sDims.height;
    const tNodeHeight = tDims.height;

    const sourceX = (sourceNode ? sourceNode.position.x + sNodeWidth : 0) + offsetX;
    const sourceY = (sourceNode ? sourceNode.position.y + sNodeHeight / 2 : 0) + offsetY;
    const targetX = (targetNode ? targetNode.position.x : 0) + offsetX;
    const targetY = (targetNode ? targetNode.position.y + tNodeHeight / 2 : 0) + offsetY;

    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX, sourceY, sourcePosition: Position.Right,
      targetX, targetY, targetPosition: Position.Left,
    });

    const defaultColor   = isDark ? GRAPH_STYLE.colors.edge.baseDark  : GRAPH_STYLE.colors.edge.baseLight;
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
        stroke = GRAPH_STYLE.colors.edge.dimmed; strokeWidth = GRAPH_STYLE.strokeWidth.base;
        opacity = GRAPH_STYLE.opacity.dimmed; filter = `blur(${GRAPH_STYLE.blur.dimmed})`;
        strokeDasharray = undefined; isEdgeHighlighted = false;
      } else {
        const applyTo = config.edgeStyleApplyTo ?? 'all';
        let matchesApplyTo =
          applyTo === 'all' ? true :
          applyTo === 'selected' ? focus.rootEdgeIds.has(edge.id) :
          focus.neighborEdgeIds.has(edge.id);

        if (matchesApplyTo) {
          const edgeStyle = config.edgeStyle ?? (mode === 'dimmed' ? 'dashed' : 'normal');
          if (edgeStyle === 'highlighted') {
            stroke = highlightColor; strokeWidth = GRAPH_STYLE.strokeWidth.highlighted;
            strokeDasharray = undefined; opacity = GRAPH_STYLE.opacity.normal;
            filter = isDark ? GRAPH_STYLE.glow.highlighted : 'none'; isEdgeHighlighted = true;
          } else if (edgeStyle === 'dashed') {
            stroke = highlightColor; strokeWidth = GRAPH_STYLE.strokeWidth.highlighted;
            strokeDasharray = '5 5'; opacity = GRAPH_STYLE.opacity.normal;
            filter = isDark ? GRAPH_STYLE.glow.highlighted : 'none'; isEdgeHighlighted = true;
          } else {
            stroke = defaultColor; strokeWidth = GRAPH_STYLE.strokeWidth.base;
            strokeDasharray = undefined; opacity = GRAPH_STYLE.opacity.normal;
            filter = 'none'; isEdgeHighlighted = false;
          }
        } else {
          stroke = defaultColor; strokeWidth = GRAPH_STYLE.strokeWidth.base;
          opacity = GRAPH_STYLE.opacity.normal; filter = 'none';
          strokeDasharray = undefined; isEdgeHighlighted = false;
        }
      }
    } else {
      const edgeVisual = computeEdgeVisualState(edge, {
        theme: config.theme, dimmedIds, highlightedIds,
        selectedIds: config.keepHighlightRings ? activeSelectedEdgeIds : new Set(),
        isExporting: true, exportMode: mode, exportKeepHighlightRings: config.keepHighlightRings,
      });
      stroke = edgeVisual.stroke; strokeWidth = edgeVisual.strokeWidth;
      opacity = edgeVisual.opacity;
      filter = edgeVisual.filter !== 'none' ? edgeVisual.filter : '';
      strokeDasharray = edgeVisual.strokeDasharray; isEdgeHighlighted = edgeVisual.isHighlighted;
    }

    const markerW  = isEdgeHighlighted ? 14 : 12;
    const markerH  = isEdgeHighlighted ? 14 : 12;
    const markerSW = isEdgeHighlighted ? 1.75 : 1.5;
    const markerId = `arrow-${stroke.replace(/[^a-zA-Z0-9]/g, '')}-${markerW}-${String(markerSW).replace('.', '_')}`;

    if (!markerDefs.has(markerId)) {
      markerDefs.set(markerId,
        `<marker id="${markerId}" viewBox="-10 -10 20 20" refX="0" refY="0" markerWidth="${markerW}" markerHeight="${markerH}" markerUnits="strokeWidth" orient="auto-start-reverse">
      <polyline stroke="${stroke}" stroke-width="${markerSW}" stroke-linecap="round" stroke-linejoin="round" fill="none" points="-5,-4 0,0 -5,4"/>
    </marker>`
      );
    }

    const dashAttr   = strokeDasharray ? ` stroke-dasharray="${strokeDasharray}"` : '';
    const filterAttr = (filter && filter !== 'none') ? ` filter="${filter}"` : '';
    let edgeMarkup = `<path d="${edgePath}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"${filterAttr}${dashAttr} marker-end="url(#${markerId})"/>`;

    const relation = (edge.data?.relation as string) || (edge.label as string);
    if (relation && config.showEdgeLabels !== false) {
      const formatted   = formatRelation(relation);
      const labelCfg    = GRAPH_STYLE.edgeLabel;
      const themeColors = labelCfg.colors[isDark ? 'dark' : 'light'];
      const textW = measureTextWidth(formatted, labelCfg.fontSizePx);
      const rectW = textW + labelCfg.paddingX * 2;
      const rectH = labelCfg.heightPx;
      edgeMarkup += `
      <g transform="translate(${labelX},${labelY})" opacity="${opacity}">
        <rect x="${-rectW / 2}" y="${-rectH / 2}" width="${rectW}" height="${rectH}" rx="${labelCfg.borderRadius}" fill="${themeColors.bg}" stroke="${themeColors.border}" stroke-width="1"/>
        <text x="0" y="0" text-anchor="middle" dominant-baseline="central" font-size="${labelCfg.fontSizePx}px" font-weight="${labelCfg.fontWeight}" font-family="${labelCfg.fontFamily}" fill="${themeColors.text}">${escapeXml(formatted)}</text>
      </g>`;
    }
    edgeSvgList.push(edgeMarkup);
  }

  if (markerDefs.size === 0) {
    const dc = isDark ? GRAPH_STYLE.colors.edge.baseDark : GRAPH_STYLE.colors.edge.baseLight;
    markerDefs.set('arrowhead',
      `<marker id="arrowhead" viewBox="-10 -10 20 20" refX="0" refY="0" markerWidth="12" markerHeight="12" markerUnits="strokeWidth" orient="auto-start-reverse">
      <polyline stroke="${dc}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" points="-5,-4 0,0 -5,4"/>
    </marker>`
    );
  }

  // 6. Render Nodes — pure SVG, NO foreignObject
  const nodeSvgList: string[] = [];

  for (const node of includedNodes) {
    const nodeX = node.position.x + offsetX;
    const nodeY = node.position.y + offsetY;

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

    nodeSvgList.push(renderNodeAsSvg(node, nodeX, nodeY, isDark, nodeVisual));
  }

  // 7. Root SVG document
  const bgMarkup = config.includeBackground !== false ? `
  <!-- Background -->
  <rect width="100%" height="100%" fill="${bgColor}"/>
  <rect width="100%" height="100%" fill="url(#grid-pattern)"/>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${exportWidth}" height="${exportHeight}" viewBox="0 0 ${exportWidth} ${exportHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="grid-pattern" width="${gridGap}" height="${gridGap}" patternUnits="userSpaceOnUse" x="${patternOffsetX}" y="${patternOffsetY}">
      <path d="M ${gridGap} 0 L 0 0 0 ${gridGap}" fill="none" stroke="${gridColor}" stroke-width="1"/>
    </pattern>
    ${Array.from(markerDefs.values()).join('\n    ')}
    <style>
      text { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
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
