import { invoke } from '@tauri-apps/api/core';
import { NodeType, GraphData, GraphNode } from '../types/graph';

export const getNodes = async (type: NodeType, skip: number = 0, limit: number = 100): Promise<any[]> => {
  const nodes = await invoke<GraphNode[]>('cmd_get_nodes', { nodeType: type, skip, limit });
  return nodes.map(n => n.data);
};

export const getNode = async (type: NodeType, id: string): Promise<any> => {
  const node = await invoke<GraphNode>('cmd_get_node', { nodeType: type, nodeId: id });
  return node.data;
};

export const createNode = async (type: NodeType, nodeData: any): Promise<any> => {
  console.log(`[cmd_create_node] INVOKE type=${type} payload=`, JSON.stringify(nodeData));
  try {
    const node = await invoke<GraphNode>('cmd_create_node', { nodeType: type, data: nodeData });
    console.log(`[cmd_create_node] SUCCESS type=${type} res=`, node);
    return node.data;
  } catch (err) {
    console.error(`[cmd_create_node] FAILED type=${type} error=`, err);
    throw err;
  }
};

export const updateNode = async (type: NodeType, id: string, nodeData: any): Promise<any> => {
  console.log(`[cmd_update_node] INVOKE type=${type} id=${id} payload=`, JSON.stringify(nodeData));
  try {
    const node = await invoke<GraphNode>('cmd_update_node', { nodeType: type, nodeId: id, data: nodeData });
    console.log(`[cmd_update_node] SUCCESS type=${type} id=${id} res=`, node);
    return node.data;
  } catch (err) {
    console.error(`[cmd_update_node] FAILED type=${type} id=${id} error=`, err);
    throw err;
  }
};

export const deleteNode = async (type: string, id: string): Promise<{ success: boolean }> => {
  await invoke('cmd_delete_node', { nodeType: type, nodeId: id });
  return { success: true };
};

export const getNodePassword = async (type: NodeType, id: string): Promise<{ password: string | null }> => {
  const password = await invoke<string | null>('cmd_get_node_password', { nodeType: type, nodeId: id });
  return { password };
};

export const updateNodePosition = async (type: string, id: string, x: number, y: number): Promise<void> => {
  await invoke('cmd_update_node_position', { nodeType: type, nodeId: id, x, y });
};

export const getGraph = async (): Promise<GraphData> => {
  return await invoke<GraphData>('cmd_get_graph');
};

export const getSubgraph = async (type: NodeType, id: string, depth: number = 1): Promise<{ edges: any[] }> => {
  return await invoke<{ edges: any[] }>('cmd_get_subgraph', { nodeType: type, nodeId: id, depth });
};
