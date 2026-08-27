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
  useReactFlow,
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
  const { nodes: storeNodes, edges: storeEdges, addEdge, setActiveChain } = useGraphStore();
  const { theme, searchQuery, typeFilters } = useUIStore();
  
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);
  const { getLayoutedElements } = useGraphLayout();

  useEffect(() => {
    const savedPositions = JSON.parse(localStorage.getItem('node_positions') || '{}');

    let visibleNodeIds = new Set<string>();

    const flowNodes: FlowNode[] = storeNodes.map((n) => {
      let isHidden = false;

      // Check type filter
      if (typeFilters.length > 0 && !typeFilters.includes(n.type)) {
        isHidden = true;
      }

      // Check search query
      if (!isHidden && searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const d = n.data as any;
        const label = (d.address || d.username || d.name || d.number || '').toLowerCase();
        if (!label.includes(q)) {
          isHidden = true;
        }
      }

      if (!isHidden) {
        visibleNodeIds.add(n.data.id);
      }

      return {
        id: n.data.id,
        type: n.type,
        data: n.data as any,
        position: savedPositions[n.data.id] || { x: 0, y: 0 },
        hidden: isHidden,
      };
    });

    const flowEdges: FlowEdge[] = storeEdges.map((e) => {
      const isHidden = !visibleNodeIds.has(e.source_id) || !visibleNodeIds.has(e.target_id);
      return {
        id: e.id,
        source: e.source_id,
        sourceHandle: 'source-right',
        target: e.target_id,
        targetHandle: 'target-left',
        type: 'glow',
        hidden: isHidden,
        data: { relation: e.relation },
      };
    });

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [storeNodes, storeEdges, setNodes, setEdges, searchQuery, typeFilters]);

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
    const neighborNodes = new Set<string>();
    const matchingEdges = new Set<string>();

    neighborNodes.add(node.id);

    storeEdges.forEach((edge) => {
      if (edge.source_id === node.id || edge.target_id === node.id) {
        matchingEdges.add(edge.id);
        neighborNodes.add(edge.source_id);
        neighborNodes.add(edge.target_id);
      }
    });

    setActiveChain({ nodeIds: neighborNodes, edgeIds: matchingEdges });
  }, [storeEdges, setActiveChain]);

  const onPaneClick = useCallback(() => {
    setActiveChain(null);
  }, [setActiveChain]);

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

  const { screenToFlowPosition } = useReactFlow();

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/reactflow/type');
    if (!type) return;

    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const tempId = `temp-${Date.now()}`;
    
    // Save position immediately so when it mounts it is there
    const savedPositions = JSON.parse(localStorage.getItem('node_positions') || '{}');
    savedPositions[tempId] = position;
    localStorage.setItem('node_positions', JSON.stringify(savedPositions));

    const newNode: any = {
      type,
      data: { id: tempId, isEditing: true, isExpanded: true },
    };
    
    useGraphStore.getState().setActiveChain(null);
    useGraphStore.getState().addTempNode(newNode);
  }, [screenToFlowPosition]);

  return (
    <div className={`w-full h-full ${theme === 'dark' ? 'dark bg-[#0B0F19]' : 'bg-[#F8FAFC]'}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeWithSave}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'glow' }}
        fitView
        colorMode={theme}
      >
        <Background gap={12} size={1} color={theme === 'dark' ? '#1E293B' : '#E2E8F0'} />
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
