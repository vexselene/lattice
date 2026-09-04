import { invoke } from '@tauri-apps/api/core';
import { Edge, EdgeRelation, NodeType } from '../types/graph';

export const getEdges = async (node_type?: NodeType, node_id?: string): Promise<Edge[]> => {
  return await invoke<Edge[]>('cmd_get_edges', { nodeType: node_type, nodeId: node_id });
};

export const createEdge = async (edgeData: {
  source_type: NodeType;
  source_id: string;
  target_type: NodeType;
  target_id: string;
  relation: EdgeRelation;
  notes?: string;
}): Promise<Edge> => {
  return await invoke<Edge>('cmd_create_edge', { edge: edgeData });
};

export const updateEdge = async (
  id: string,
  edgeData: { relation?: EdgeRelation; notes?: string }
): Promise<Edge> => {
  return await invoke<Edge>('cmd_update_edge', { edgeId: id, payload: edgeData });
};

export const deleteEdge = async (id: string): Promise<{ success: boolean }> => {
  await invoke('cmd_delete_edge', { edgeId: id });
  return { success: true };
};
