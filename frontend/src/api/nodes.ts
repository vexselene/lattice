import { apiClient } from './client';
import { NodeType, GraphData } from '../types/graph';

export const getNodes = async (type: NodeType, skip: number = 0, limit: number = 100) => {
  const { data } = await apiClient.get(`/nodes/${type}`, { params: { skip, limit } });
  return data;
};

export const getNode = async (type: NodeType, id: string) => {
  const { data } = await apiClient.get(`/nodes/${type}/${id}`);
  return data;
};

export const createNode = async (type: NodeType, nodeData: any) => {
  const { data } = await apiClient.post(`/nodes/${type}`, { data: nodeData });
  return data;
};

export const updateNode = async (type: NodeType, id: string, nodeData: any) => {
  const { data } = await apiClient.put(`/nodes/${type}/${id}`, { data: nodeData });
  return data;
};

export const deleteNode = async (type: string, id: string) => {
  const { data } = await apiClient.delete(`/nodes/${type}/${id}`);
  return data;
};

export const getNodePassword = async (type: NodeType, id: string) => {
  const { data } = await apiClient.get(`/nodes/${type}/${id}/password`);
  return data; // { password }
};

export const getGraph = async (): Promise<GraphData> => {
  const { data } = await apiClient.get('/graph');
  return data;
};

export const getSubgraph = async (type: NodeType, id: string, depth: number = 1) => {
  const { data } = await apiClient.get(`/graph/subgraph/${type}/${id}`, { params: { depth } });
  return data;
};
