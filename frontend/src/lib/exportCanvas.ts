import { getNodesBounds, ReactFlowInstance } from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';
import { GRAPH_STYLE } from '../config/graphStyleConfig';
import { useGraphStore } from '../stores/graphStore';

export interface ExportCanvasOptions {
  reactFlowInstance: ReactFlowInstance;
  scope?: 'full' | 'selected';
  mode?: 'isolated' | 'dimmed';
  includeBackground?: boolean;
  themeBgColor?: string;
  pixelRatio?: number;
  showEdgeLabels?: boolean;
  keepHighlightRings?: boolean;
  fileName?: string;
  format?: 'png' | 'svg';
  selectedNodeIds?: Set<string>;
}

export const exportCanvas = async ({
  reactFlowInstance,
  scope = 'full',
  mode = 'isolated',
  includeBackground = true,
  themeBgColor = '#0f172a',
  pixelRatio = 2,
  keepHighlightRings = false,
  fileName = 'lattice-export',
  format = 'png',
  selectedNodeIds
}: ExportCanvasOptions) => {
  const nodes = reactFlowInstance.getNodes();
  const storeSelectedIds = useGraphStore.getState().selectedNodeIds;
  const activeSelectedNodeIds = selectedNodeIds || storeSelectedIds;

  let exportNodes = nodes;
  if (scope === 'selected' && mode === 'isolated') {
    exportNodes = nodes.filter(n => activeSelectedNodeIds.has(n.id));
  }

  if (exportNodes.length === 0) {
    console.warn('No nodes to export');
    return;
  }

  const bounds = getNodesBounds(exportNodes);
  const padding = GRAPH_STYLE.export.paddingPx;
  const exportWidth = bounds.width + padding * 2;
  const exportHeight = bounds.height + padding * 2;

  // 1. Dispatch startExport to the store to trigger visual state hook updates
  useGraphStore.getState().startExport({ scope, mode, keepHighlightRings });

  // 2. Allow React to flush the visual state updates across the live canvas
  await new Promise(r => setTimeout(r, 150));

  const reactFlowElement = document.querySelector('.react-flow') as HTMLElement;
  if (!reactFlowElement) {
    console.error('React Flow container not found');
    useGraphStore.getState().endExport();
    return;
  }

  // 3. Save current viewport and reframe directly to the export bounds
  const oldViewport = reactFlowInstance.getViewport();
  reactFlowInstance.setViewport({ x: -bounds.x + padding, y: -bounds.y + padding, zoom: 1 });

  // Wait for the viewport transform to render
  await new Promise(r => setTimeout(r, 50));

  try {
    let realBgColor = themeBgColor;
    if (includeBackground && reactFlowElement.parentElement) {
      realBgColor = window.getComputedStyle(reactFlowElement.parentElement).backgroundColor || themeBgColor;
    }

    const exportOpts = {
      pixelRatio,
      backgroundColor: includeBackground ? realBgColor : 'transparent',
      width: exportWidth,
      height: exportHeight,
      filter: (node: HTMLElement) => {
        // Exclude UI chrome
        if (node.classList?.contains('react-flow__minimap') ||
            node.classList?.contains('react-flow__controls') ||
            node.classList?.contains('react-flow__panel') ||
            node.classList?.contains('no-export')) {
          return false;
        }
        // Exclude the background layer if background is disabled
        if (!includeBackground && node.classList?.contains('react-flow__background')) {
          return false;
        }
        return true;
      }
    };

    let dataUrl = '';
    if (format === 'svg') {
      dataUrl = await toSvg(reactFlowElement, exportOpts);
    } else {
      dataUrl = await toPng(reactFlowElement, exportOpts);
    }

    const link = document.createElement('a');
    link.download = `${fileName}.${format}`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('Failed to export canvas:', error);
  } finally {
    // 4. Revert viewport and clear export state
    reactFlowInstance.setViewport(oldViewport);
    useGraphStore.getState().endExport();
  }
};
