import { create } from 'zustand';
import { GraphNode, Edge } from '../types/graph';
import { getGraph, deleteNode as apiDeleteNode, getNodes } from '../api/nodes';

interface GraphState {
  nodes: GraphNode[];
  edges: Edge[];
  services: any[];
  selectedNode: GraphNode | null;
  isLoading: boolean;
  error: string | null;
  collapseAllSignal: number;
  fetchGraph: () => Promise<void>;
  fetchServices: () => Promise<any[]>;
  setSelectedNode: (node: GraphNode | null) => void;
  deleteNode: (nodeType: string, nodeId: string) => Promise<void>;
  deleteEdge: (edgeId: string) => Promise<void>;
  addEdge: (edgeData: any) => Promise<void>;
  activeChain: { nodeIds: Set<string>; edgeIds: Set<string> } | null;
  expandedNodeId: string | null;
  setExpandedNodeId: (id: string | null) => void;
  setActiveChain: (chain: { nodeIds: Set<string>; edgeIds: Set<string> } | null) => void;
  selectedNodeIds: Set<string>;
  selectedEdgeIds: Set<string>;
  activeMultiMode: 'none' | 'isolate' | 'chains';
  setSelectedNodeIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setSelectedEdgeIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setActiveMultiMode: (mode: 'none' | 'isolate' | 'chains' | ((prev: 'none' | 'isolate' | 'chains') => 'none' | 'isolate' | 'chains')) => void;
  isExporting: boolean;
  exportScope: 'full' | 'selected';
  exportMode: 'isolated' | 'dimmed';
  exportKeepHighlightRings: boolean;
  startExport: (config: { scope: 'full' | 'selected'; mode: 'isolated' | 'dimmed'; keepHighlightRings?: boolean }) => void;
  endExport: () => void;
  addTempNode: (node: GraphNode) => void;
  removeTempNode: (nodeId: string) => void;
  bumpCollapseAll: () => void;
  openMenuEdgeId: string | null;
  setOpenMenuEdgeId: (id: string | null) => void;
  batchAddTag: (nodeIds: string[], tag: string) => void;
  removeTag: (nodeId: string, tag: string) => void;
  updateNodePosition: (nodeId: string, x: number, y: number) => void;
  updateNodePositions: (updates: Array<{ id: string; x: number; y: number }>) => void;
  resetGraph: () => void;
}

export const useGraphStore = create<GraphState>()((set, get) => ({
  nodes: [],
  edges: [],
  services: [],
  selectedNode: null,
  activeChain: null,
  expandedNodeId: null,
  setExpandedNodeId: (id) => set({ expandedNodeId: id }),
  selectedNodeIds: new Set<string>(),
  selectedEdgeIds: new Set<string>(),
  activeMultiMode: 'none',
  setSelectedNodeIds: (ids) => set((state) => ({
    selectedNodeIds: typeof ids === 'function' ? ids(state.selectedNodeIds) : ids
  })),
  setSelectedEdgeIds: (ids) => set((state) => ({
    selectedEdgeIds: typeof ids === 'function' ? ids(state.selectedEdgeIds) : ids
  })),
  setActiveMultiMode: (mode) => set((state) => ({
    activeMultiMode: typeof mode === 'function' ? mode(state.activeMultiMode) : mode
  })),
  isExporting: false,
  exportScope: 'full',
  exportMode: 'isolated',
  exportKeepHighlightRings: false,
  startExport: ({ scope, mode, keepHighlightRings = false }) => set({
    isExporting: true,
    exportScope: scope,
    exportMode: mode,
    exportKeepHighlightRings: keepHighlightRings
  }),
  endExport: () => set({
    isExporting: false,
    exportScope: 'full',
    exportMode: 'isolated',
    exportKeepHighlightRings: false
  }),
  collapseAllSignal: 0,
  isLoading: false,
  error: null,
  openMenuEdgeId: null,
  setOpenMenuEdgeId: (id) => set({ openMenuEdgeId: id }),
  
  setActiveChain: (chain) => set({ activeChain: chain }),
  addTempNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
  removeTempNode: (nodeId) => set((state) => ({ nodes: state.nodes.filter(n => n.data.id !== nodeId) })),
  bumpCollapseAll: () => set((state) => ({ collapseAllSignal: state.collapseAllSignal + 1, openMenuEdgeId: null, expandedNodeId: null })),
  
  updateNodePosition: (nodeId, x, y) => set((state) => ({
    nodes: state.nodes.map((n) =>
      n.data.id === nodeId
        ? { ...n, data: { ...n.data, position_x: x, position_y: y } }
        : n
    ),
  })),

  updateNodePositions: (updates) => {
    if (!updates || updates.length === 0) return;
    const map = new Map(updates.map((u) => [u.id, u]));
    set((state) => ({
      nodes: state.nodes.map((n) => {
        const up = map.get(n.data.id);
        return up ? { ...n, data: { ...n.data, position_x: up.x, position_y: up.y } } : n;
      }),
    }));
  },
  
  batchAddTag: async (nodeIds, tag) => {
    const normalized = tag.trim().toLowerCase();
    if (!normalized) return;
    
    // Perform updates
    let updatedNodes: GraphNode[] = [];
    set((state) => {
      let changed = false;
      const newNodes = state.nodes.map(n => {
        if (nodeIds.includes(n.data.id)) {
          const currentTags = n.data.tags || [];
          if (!currentTags.includes(normalized)) {
            changed = true;
            const newNode = {
              ...n,
              data: {
                ...n.data,
                tags: [...currentTags, normalized]
              }
            };
            updatedNodes.push(newNode);
            return newNode;
          }
        }
        return n;
      });
      return changed ? { nodes: newNodes } : {};
    });

    // Save to backend
    if (updatedNodes.length > 0) {
      try {
        const { updateNode } = await import('../api/nodes');
        for (const n of updatedNodes) {
          await updateNode(n.type, n.data.id, { tags: n.data.tags });
        }
      } catch (err) {
        console.error('Failed to save tags to backend', err);
      }
    }
  },

  removeTag: async (nodeId, tag) => {
    let targetNode: GraphNode | null = null;
    set((state) => {
      const newNodes = state.nodes.map(n => {
        if (n.data.id === nodeId && n.data.tags?.includes(tag)) {
          targetNode = {
            ...n,
            data: {
              ...n.data,
              tags: n.data.tags.filter((t: string) => t !== tag)
            }
          };
          return targetNode;
        }
        return n;
      });
      return targetNode ? { nodes: newNodes } : {};
    });

    if (targetNode) {
      try {
        const { updateNode } = await import('../api/nodes');
        const node = targetNode as GraphNode;
        await updateNode(node.type, node.data.id, { tags: node.data.tags });
      } catch (err) {
        console.error('Failed to remove tag from backend', err);
      }
    }
  },

  fetchServices: async () => {
    try {
      const services = await getNodes('service');
      set({ services: services || [] });
      return services || [];
    } catch (err) {
      console.error('Failed to fetch services:', err);
      return [];
    }
  },

  fetchGraph: async () => {
    set({
      isLoading: true,
      error: null,
      selectedNode: null,
      activeChain: null,
      expandedNodeId: null,
      selectedNodeIds: new Set<string>(),
      selectedEdgeIds: new Set<string>(),
      activeMultiMode: 'none',
      openMenuEdgeId: null,
    });
    try {
      const [data, servicesData] = await Promise.all([
        getGraph(),
        getNodes('service').catch(() => [])
      ]);
      set({
        nodes: data.nodes,
        edges: data.edges,
        services: servicesData || [],
        isLoading: false
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch graph', isLoading: false });
    }
  },

  resetGraph: () => set({
    nodes: [],
    edges: [],
    services: [],
    selectedNode: null,
    activeChain: null,
    expandedNodeId: null,
    selectedNodeIds: new Set<string>(),
    selectedEdgeIds: new Set<string>(),
    activeMultiMode: 'none',
    isExporting: false,
    exportScope: 'full',
    exportMode: 'isolated',
    exportKeepHighlightRings: false,
    collapseAllSignal: 0,
    isLoading: false,
    error: null,
    openMenuEdgeId: null,
  }),

  setSelectedNode: (node) => set({ selectedNode: node }),
  
  deleteNode: async (nodeType, nodeId) => {
    try {
      await apiDeleteNode(nodeType, nodeId);
      await get().fetchGraph(); // Refresh after delete
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete node' });
    }
  },
  
  deleteEdge: async (edgeId) => {
    try {
      // Need to import apiDeleteEdge
      const { deleteEdge: apiDeleteEdge } = await import('../api/edges');
      await apiDeleteEdge(edgeId);
      await get().fetchGraph();
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete edge' });
    }
  },
  
  addEdge: async (edgeData) => {
    try {
      const { createEdge } = await import('../api/edges');
      await createEdge(edgeData);
      await get().fetchGraph();
    } catch (err: any) {
      set({ error: err.message || 'Failed to add edge' });
    }
  }
}));
