import { getNodesBounds, ReactFlowInstance } from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';

export interface ExportCanvasOptions {
  reactFlowInstance: ReactFlowInstance;
  scope?: 'full' | 'selected';
  mode?: 'isolated' | 'dimmed';
  includeBackground?: boolean;
  themeBgColor?: string;
  pixelRatio?: number;
  showEdgeLabels?: boolean;
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
  showEdgeLabels = false,
  fileName = 'lattice-export',
  format = 'png',
  selectedNodeIds
}: ExportCanvasOptions) => {
  const nodes = reactFlowInstance.getNodes();
  const edges = reactFlowInstance.getEdges();

  let activeSelectedNodeIds = selectedNodeIds;
  if (!activeSelectedNodeIds) {
    activeSelectedNodeIds = new Set(nodes.filter(n => n.selected).map(n => n.id));
  }

  let exportNodes = nodes;
  let exportEdges = edges;

  if (scope === 'selected' && mode === 'isolated') {
    exportNodes = nodes.filter(n => activeSelectedNodeIds!.has(n.id));
    exportEdges = edges.filter(e => activeSelectedNodeIds!.has(e.source) && activeSelectedNodeIds!.has(e.target));
  }

  if (exportNodes.length === 0) {
    console.warn('No nodes to export');
    return;
  }

  const bounds = getNodesBounds(exportNodes);
  const padding = 60;
  const exportWidth = bounds.width + padding * 2;
  const exportHeight = bounds.height + padding * 2;

  // 1. Create Headless Detached Container
  const container = document.createElement('div');
  
  // Apply necessary React Flow classes and theme classes for CSS variables to cascade
  container.className = 'react-flow';
  if (document.documentElement.classList.contains('dark')) {
    container.classList.add('dark');
  }

  Object.assign(container.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    zIndex: '-1000', // Hide completely behind the real application
    width: `${exportWidth}px`,
    height: `${exportHeight}px`,
  });

  if (includeBackground && themeBgColor) {
    container.style.backgroundColor = themeBgColor;
  }

  // 2. Clone the authentic viewport to guarantee 100% accurate DOM structure
  const originalViewport = document.querySelector('.react-flow__viewport');
  if (!originalViewport) {
    console.error('Viewport element not found');
    return;
  }
  
  const clonedViewport = originalViewport.cloneNode(true) as HTMLElement;
  
  // Reset viewport transform to neatly frame our computed bounding box
  Object.assign(clonedViewport.style, {
    transform: `translate(${-bounds.x + padding}px, ${-bounds.y + padding}px) scale(1)`,
    transformOrigin: '0 0',
    width: `${exportWidth}px`,
    height: `${exportHeight}px`
  });

  container.appendChild(clonedViewport);
  document.body.appendChild(container);

  // 3. Prune and Format the Cloned DOM
  // Remove UI chrome elements
  const uiChrome = container.querySelectorAll('.react-flow__minimap, .react-flow__controls, .react-flow__panel, .no-export');
  uiChrome.forEach(el => el.remove());

  // Filter Nodes
  const clonedNodes = container.querySelectorAll('.react-flow__node');
  clonedNodes.forEach(nodeEl => {
    const nodeId = nodeEl.getAttribute('data-id');
    const isExportNode = exportNodes.some(n => n.id === nodeId);
    
    if (!isExportNode) {
      nodeEl.remove();
      return;
    }

    if (scope === 'selected' && mode === 'dimmed' && !activeSelectedNodeIds!.has(nodeId!)) {
      (nodeEl as HTMLElement).style.opacity = '0.3';
      (nodeEl as HTMLElement).style.filter = 'grayscale(0.8)';
    }
  });

  // Filter Edges
  const clonedEdges = container.querySelectorAll('.react-flow__edges g[data-id]');
  clonedEdges.forEach(edgeEl => {
    const edgeId = edgeEl.getAttribute('data-id');
    const isExportEdge = exportEdges.some(e => e.id === edgeId);
    
    if (!isExportEdge) {
      edgeEl.remove();
      return;
    }

    if (scope === 'selected' && mode === 'dimmed') {
      const edge = edges.find(e => e.id === edgeId);
      const isSelectedEdge = edge && activeSelectedNodeIds!.has(edge.source) && activeSelectedNodeIds!.has(edge.target);
      if (!isSelectedEdge) {
        (edgeEl as HTMLElement).style.opacity = '0.2';
        (edgeEl as HTMLElement).style.filter = 'grayscale(0.8)';
      }
    }
  });

  // 4. Programmatic Edge Labels
  if (showEdgeLabels) {
    const labelsContainer = document.createElement('div');
    Object.assign(labelsContainer.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '10' // place above edges
    });

    exportEdges.forEach(edge => {
      if (scope === 'selected' && mode === 'dimmed') {
        const isSelectedEdge = activeSelectedNodeIds!.has(edge.source) && activeSelectedNodeIds!.has(edge.target);
        if (!isSelectedEdge) return;
      }

      const labelText = (edge.data?.relationship as string) || (edge.label as string);
      if (!labelText) return;

      // Find the exact path in the *original* DOM to calculate accurate length
      const pathEl = document.querySelector(`.react-flow__edges g[data-id="${edge.id}"] path.react-flow__edge-path`) as SVGPathElement;
      
      if (pathEl && typeof pathEl.getPointAtLength === 'function') {
        try {
          const totalLength = pathEl.getTotalLength();
          const midPoint = pathEl.getPointAtLength(totalLength / 2);
          
          const badge = document.createElement('div');
          badge.textContent = labelText;
          Object.assign(badge.style, {
            position: 'absolute',
            left: `${midPoint.x}px`,
            top: `${midPoint.y}px`,
            transform: 'translate(-50%, -50%)',
            background: '#1e293b',
            color: '#f8fafc',
            fontSize: '11px',
            padding: '4px 10px',
            borderRadius: '12px',
            border: '1px solid #334155',
            fontWeight: '600',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
          });
          labelsContainer.appendChild(badge);
        } catch (err) {
          console.warn('Failed to calculate midpoint for edge', edge.id);
        }
      }
    });
    clonedViewport.appendChild(labelsContainer);
  }

  // 5. High-DPI Snapshot & Cleanup
  try {
    // Wait for a few ticks to ensure DOM is ready and styles are applied
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const exportOpts = {
      pixelRatio,
      backgroundColor: includeBackground ? themeBgColor : undefined,
      width: exportWidth,
      height: exportHeight
    };

    let dataUrl = '';
    if (format === 'svg') {
      dataUrl = await toSvg(container, exportOpts);
    } else {
      dataUrl = await toPng(container, exportOpts);
    }

    const link = document.createElement('a');
    link.download = `${fileName}.${format}`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('Failed to export canvas:', error);
  } finally {
    document.body.removeChild(container);
  }
};
