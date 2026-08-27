import { create } from 'zustand';
import { GraphNode, Edge } from '../types/graph';
import { getGraph, deleteNode as apiDeleteNode } from '../api/nodes';

interface GraphState {
  nodes: GraphNode[];
  edges: Edge[];
  selectedNode: GraphNode | null;
  isLoading: boolean;
  error: string | null;
  fetchGraph: () => Promise<void>;
  setSelectedNode: (node: GraphNode | null) => void;
  deleteNode: (nodeType: string, nodeId: string) => Promise<void>;
  deleteEdge: (edgeId: string) => Promise<void>;
  addEdge: (edgeData: any) => Promise<void>;
  activeChain: { nodeIds: Set<string>; edgeIds: Set<string> } | null;
  setActiveChain: (chain: { nodeIds: Set<string>; edgeIds: Set<string> } | null) => void;
  addTempNode: (node: GraphNode) => void;
  removeTempNode: (nodeId: string) => void;
}

export const useGraphStore = create<GraphState>()((set, get) => ({
  nodes: [],
  edges: [],
  selectedNode: null,
  activeChain: null,
  isLoading: false,
  error: null,
  
  setActiveChain: (chain) => set({ activeChain: chain }),
  addTempNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
  removeTempNode: (nodeId) => set((state) => ({ nodes: state.nodes.filter(n => n.data.id !== nodeId) })),
  
  fetchGraph: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await getGraph();
      set({ nodes: data.nodes, edges: data.edges, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch graph', isLoading: false });
    }
  },

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
