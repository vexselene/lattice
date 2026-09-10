import { Edge, EdgeRelation, NodeType } from '../types/graph';

import { normalizeError } from './errors';

export const getEdges = async (node_type?: NodeType, node_id?: string): Promise<Edge[]> => {
  try {
    if (window.api?.cmdGetEdges) {
      return await window.api.cmdGetEdges(node_type, node_id);
    }
    return [];
  } catch (err) {
    throw normalizeError(err);
  }
};

export const createEdge = async (edgeData: {
  source_type: NodeType;
  source_id: string;
  target_type: NodeType;
  target_id: string;
  relation: EdgeRelation;
  notes?: string;
}): Promise<Edge> => {
  try {
    if (window.api?.cmdCreateEdge) {
      return await window.api.cmdCreateEdge(edgeData);
    }
    throw new Error('window.api.cmdCreateEdge is not available');
  } catch (err) {
    throw normalizeError(err);
  }
};

export const updateEdge = async (
  id: string,
  edgeData: { relation?: EdgeRelation; notes?: string }
): Promise<Edge> => {
  try {
    if (window.api?.cmdUpdateEdge) {
      return await window.api.cmdUpdateEdge(id, edgeData);
    }
    throw new Error('window.api.cmdUpdateEdge is not available');
  } catch (err) {
    throw normalizeError(err);
  }
};

export const deleteEdge = async (id: string): Promise<{ success: boolean }> => {
  try {
    if (window.api?.cmdDeleteEdge) {
      await window.api.cmdDeleteEdge(id);
      return { success: true };
    }
    return { success: false };
  } catch (err) {
    throw normalizeError(err);
  }
};
