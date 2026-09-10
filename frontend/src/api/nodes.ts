import { NodeType, GraphData } from '../types/graph';
import { normalizeError } from './errors';

export function formatErrorMessage(err: any): string {
  if (!err) return 'Unknown error';
  if (err.details !== undefined && err.details !== null) {
    if (typeof err.details === 'string') {
      return err.details;
    }
    if (typeof err.details === 'object') {
      if (err.details.wait_remaining_ms !== undefined) {
        return `Rate limited: please wait ${Math.ceil(err.details.wait_remaining_ms / 1000)}s before trying again`;
      }
      if (err.details.message) {
        return String(err.details.message);
      }
      try {
        return JSON.stringify(err.details);
      } catch {}
    }
  }
  return err.error || err.message || 'Save failed';
}

export const getNodes = async (type: NodeType, skip: number = 0, limit: number = 100): Promise<any[]> => {
  try {
    if (window.api?.cmdGetNodes) {
      const nodes = await window.api.cmdGetNodes(type, skip, limit);
      return nodes.map(n => n.data);
    }
    return [];
  } catch (err) {
    throw normalizeError(err);
  }
};

export const getNode = async (type: NodeType, id: string): Promise<any> => {
  try {
    if (window.api?.cmdGetNode) {
      const node = await window.api.cmdGetNode(type, id);
      return node.data;
    }
    return null;
  } catch (err) {
    throw normalizeError(err);
  }
};

export const createNode = async (type: NodeType, nodeData: any): Promise<any> => {
  try {
    if (window.api?.cmdCreateNode) {
      const node = await window.api.cmdCreateNode(type, nodeData);
      return node.data;
    }
    throw new Error('window.api.cmdCreateNode is not available');
  } catch (err) {
    throw normalizeError(err);
  }
};

export const updateNode = async (type: NodeType, id: string, nodeData: any): Promise<any> => {
  try {
    if (window.api?.cmdUpdateNode) {
      const node = await window.api.cmdUpdateNode(type, id, nodeData);
      return node.data;
    }
    throw new Error('window.api.cmdUpdateNode is not available');
  } catch (err) {
    throw normalizeError(err);
  }
};

export const deleteNode = async (type: string, id: string): Promise<{ success: boolean }> => {
  try {
    if (window.api?.cmdDeleteNode) {
      await window.api.cmdDeleteNode(type, id);
      return { success: true };
    }
    return { success: false };
  } catch (err) {
    throw normalizeError(err);
  }
};

export const getNodePassword = async (type: NodeType, id: string): Promise<{ password: string | null }> => {
  try {
    if (window.api?.cmdGetNodePassword) {
      const password = await window.api.cmdGetNodePassword(type, id);
      return { password: password ?? null };
    }
    return { password: null };
  } catch (err) {
    throw normalizeError(err);
  }
};

export const updateNodePosition = async (type: string, id: string, x: number, y: number): Promise<void> => {
  try {
    if (window.api?.cmdUpdateNodePosition) {
      await window.api.cmdUpdateNodePosition(type, id, x, y);
    }
  } catch (err) {
    throw normalizeError(err);
  }
};

export const getGraph = async (): Promise<GraphData> => {
  try {
    if (window.api?.cmdGetGraph) {
      return await window.api.cmdGetGraph();
    }
    return { nodes: [], edges: [] };
  } catch (err) {
    throw normalizeError(err);
  }
};

export const getSubgraph = async (type: NodeType, id: string, depth: number = 1): Promise<{ edges: any[] }> => {
  try {
    if (window.api?.cmdGetSubgraph) {
      return await window.api.cmdGetSubgraph(type, id, depth);
    }
    return { edges: [] };
  } catch (err) {
    throw normalizeError(err);
  }
};
