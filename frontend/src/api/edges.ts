import { apiClient } from './client';
import { Edge, EdgeRelation, NodeType } from '../types/graph';

export const getEdges = async (node_type?: NodeType, node_id?: string) => {
  const { data } = await apiClient.get('/edges', { params: { node_type, node_id } });
  return data as Edge[];
};

export const createEdge = async (edgeData: {
  source_type: NodeType;
  source_id: string;
  target_type: NodeType;
  target_id: string;
  relation: EdgeRelation;
  notes?: string;
}) => {
  const { data } = await apiClient.post('/edges', edgeData);
  return data as Edge;
};

export const updateEdge = async (id: string, edgeData: { relation?: EdgeRelation; notes?: string }) => {
  const { data } = await apiClient.put(`/edges/${id}`, edgeData);
  return data as Edge;
};

export const deleteEdge = async (id: string) => {
  const { data } = await apiClient.delete(`/edges/${id}`);
  return data;
};
