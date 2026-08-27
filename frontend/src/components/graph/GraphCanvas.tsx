import { useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  Node as FlowNode,
  Edge as FlowEdge,
  Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useGraphStore } from '../../stores/graphStore';
import { useUIStore } from '../../stores/uiStore';
import EmailNode from './nodes/EmailNode';
import AccountNode from './nodes/AccountNode';
import ServiceNode from './nodes/ServiceNode';
import PhoneNode from './nodes/PhoneNode';
import GlowEdge from './edges/GlowEdge';
import GraphControls from './GraphControls';
import useGraphLayout from '../../hooks/useGraphLayout';

const nodeTypes = {
  email: EmailNode,
  account: AccountNode,
  service: ServiceNode,
  phone: PhoneNode,
};

const edgeTypes = {
  glow: GlowEdge,
};

const GraphInner = () => {
  const { nodes: storeNodes, edges: storeEdges, setSelectedNode, addEdge } = useGraphStore();
  const theme = useUIStore((state) => state.theme);
  
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);
  const { getLayoutedElements } = useGraphLayout();

  useEffect(() => {
    const savedPositions = JSON.parse(localStorage.getItem('node_positions') || '{}');

    const flowNodes: FlowNode[] = storeNodes.map((n) => ({
      id: n.data.id,
      type: n.type,
      data: n.data as any,
      position: savedPositions[n.data.id] || { x: 0, y: 0 },
    }));

    const flowEdges: FlowEdge[] = storeEdges.map((e) => ({
      id: e.id,
      source: e.source_id,
      target: e.target_id,
      type: 'glow',
      data: { relation: e.relation },
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [storeNodes, storeEdges, setNodes, setEdges]);

  const onNodesChangeWithSave = useCallback((changes: any) => {
    onNodesChange(changes);
    setNodes((currentNodes) => {
      const positions = currentNodes.reduce((acc, node) => {
        acc[node.id] = node.position;
        return acc;
      }, {} as any);
      localStorage.setItem('node_positions', JSON.stringify(positions));
      return currentNodes;
    });
  }, [onNodesChange, setNodes]);

  const onLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    
    // Save new layout positions
    const positions = layoutedNodes.reduce((acc, node) => {
      acc[node.id] = node.position;
      return acc;
    }, {} as any);
    localStorage.setItem('node_positions', JSON.stringify(positions));
  }, [nodes, edges, getLayoutedElements, setNodes, setEdges]);

  const onNodeClick = useCallback((_: any, node: FlowNode) => {
    const storeNode = storeNodes.find((n) => n.data.id === node.id);
    if (storeNode) setSelectedNode(storeNode);
  }, [storeNodes, setSelectedNode]);

  const onConnect = useCallback((params: Connection) => {
    if (params.source && params.target) {
      const sourceNode = storeNodes.find(n => n.data.id === params.source);
      const targetNode = storeNodes.find(n => n.data.id === params.target);
      if (sourceNode && targetNode) {
        addEdge({
          source_type: sourceNode.type,
          source_id: params.source,
          target_type: targetNode.type,
          target_id: params.target,
          relation: 'registered_with',
        });
      }
    }
  }, [storeNodes, addEdge]);

  return (
    <div className={`w-full h-full ${theme === 'dark' ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeWithSave}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        colorMode={theme}
      >
        <Background gap={12} size={1} color={theme === 'dark' ? '#334155' : '#cbd5e1'} />
        <GraphControls onLayout={onLayout} />
      </ReactFlow>
    </div>
  );
};

export const GraphCanvas = () => {
  return (
    <ReactFlowProvider>
      <GraphInner />
    </ReactFlowProvider>
  );
};

export default GraphCanvas;
