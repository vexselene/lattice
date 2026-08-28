import React, { useEffect, useCallback, useState, useRef } from 'react';
import {
  ReactFlow,
  Background, BackgroundVariant,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  Node as FlowNode,
  Edge as FlowEdge,
  Connection,
  useReactFlow,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Mail, User, Server, Smartphone } from 'lucide-react';

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
  const { 
    nodes: storeNodes, 
    edges: storeEdges, 
    addEdge, 
    deleteEdge,
    setActiveChain, 
    activeChain, 
    bumpCollapseAll,
    setSelectedNode,
    expandedNodeId
  } = useGraphStore();
  
  const { theme, searchQuery, typeFilters, isEditMode } = useUIStore();
  
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);
  const { getLayoutedElements } = useGraphLayout();

  const [connectMenu, setConnectMenu] = useState<{ x: number, y: number, sourceId: string } | null>(null);
  const [activeEdgeId, setActiveEdgeId] = useState<string | null>(null);
  const connectingNodeId = useRef<string | null>(null);

  const [proximityTarget, setProximityTarget] = useState<string | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());


  useEffect(() => {
    const savedPositions = JSON.parse(localStorage.getItem('node_positions') || '{}');

    let visibleNodeIds = new Set<string>();

    const flowNodes: FlowNode[] = storeNodes.map((n) => {
      let isHidden = false;

      if (typeFilters.length > 0 && !typeFilters.includes(n.type)) {
        isHidden = true;
      }

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

      const isDimmed = activeChain !== null && !activeChain.nodeIds.has(n.data.id) && !(n.data as any).isEditing;
      const isModalOpen = expandedNodeId !== null;

      return {
        ...n,
        id: n.data.id,
        data: { 
          ...(n.data as any), 
          isDimmed,
          isModalOpen
        },
        position: savedPositions[n.data.id] || { x: 0, y: 0 },
        hidden: isHidden,
      };
    });

    const flowEdges: FlowEdge[] = storeEdges.map((e) => {
      const isHidden = !visibleNodeIds.has(e.source_id) || !visibleNodeIds.has(e.target_id);
      const isEdgeDimmed = activeChain !== null && !activeChain.edgeIds.has(e.id);
      const isEdgeHighlighted = activeChain !== null && activeChain.edgeIds.has(e.id);
      
      const defaultColor = theme === 'dark' ? '#64748b' : '#475569';
      const highlightColor = '#818cf8';


      return {
        id: e.id,
        source: e.source_id,
        sourceHandle: 'source-right',
        target: e.target_id,
        targetHandle: 'target-left',
        type: 'glow',
        hidden: isHidden,
        animated: isEdgeHighlighted,
        data: { relation: e.relation, isDimmed: isEdgeDimmed, isMenuOpen: activeEdgeId === e.id, isModalOpen: expandedNodeId !== null },
        markerEnd: {
          type: MarkerType.Arrow,
          width: isEdgeHighlighted ? 14 : 12,
          height: isEdgeHighlighted ? 14 : 12,
          strokeWidth: isEdgeHighlighted ? 1.75 : 1.5,
          color: isEdgeDimmed ? '#475569' : (isEdgeHighlighted ? highlightColor : defaultColor),
        }
      };
    });

    if (proximityTarget && draggingNode) {
      const draggingNodeObj = flowNodes.find(n => n.id === draggingNode);
      const targetNodeObj = flowNodes.find(n => n.id === proximityTarget);
      
      if (draggingNodeObj && targetNodeObj) {
        const isNewNodeDownstream = draggingNodeObj.position.x >= targetNodeObj.position.x;
        const sourceId = isNewNodeDownstream ? proximityTarget : draggingNode;
        const targetId = isNewNodeDownstream ? draggingNode : proximityTarget;

        flowEdges.push({
          id: 'proximity-preview',
          source: sourceId,
          target: targetId,
          sourceHandle: 'source-right',
          targetHandle: 'target-left',
          type: 'default',
          animated: true,
          style: { strokeDasharray: '4 4', stroke: '#818cf8', strokeWidth: 2 },
        } as FlowEdge);
      }
    }

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [storeNodes, storeEdges, setNodes, setEdges, searchQuery, typeFilters, activeChain, activeEdgeId, expandedNodeId, proximityTarget, draggingNode]);


  const onNodesChangeWithSave = useCallback((changes: any) => {
    onNodesChange(changes);
    
    setNodes((currentNodes) => {
      if (isEditMode) {
        const savedPositions = JSON.parse(localStorage.getItem('node_positions') || '{}');
        const positions = currentNodes.reduce((acc, node) => {
          acc[node.id] = node.position;
          return acc;
        }, savedPositions);
        localStorage.setItem('node_positions', JSON.stringify(positions));
      }
      return currentNodes;
    });
  }, [onNodesChange, setNodes, isEditMode]);

  const onLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    
    if (isEditMode) {
      const savedPositions = JSON.parse(localStorage.getItem('node_positions') || '{}');
      const positions = layoutedNodes.reduce((acc, node) => {
        acc[node.id] = node.position;
        return acc;
      }, savedPositions);
      localStorage.setItem('node_positions', JSON.stringify(positions));
    }
  }, [nodes, edges, getLayoutedElements, setNodes, setEdges, isEditMode]);

  
  const onNodeDrag = useCallback((_: any, node: FlowNode) => {
    const hasEdges = storeEdges.some(e => e.source_id === node.id || e.target_id === node.id);
    if (hasEdges) {
      if (proximityTarget !== null) setProximityTarget(null);
      if (draggingNode !== null) setDraggingNode(null);
      return;
    }

    let closestId: string | null = null;

    let minDist = 140;

    nodes.forEach((n) => {
      if (n.id === node.id) return;
      const dx = (n.position.x + (n.measured?.width || 200) / 2) - (node.position.x + (node.measured?.width || 200) / 2);
      const dy = (n.position.y + (n.measured?.height || 50) / 2) - (node.position.y + (node.measured?.height || 50) / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= minDist) {
        minDist = dist;
        closestId = n.id;
      }
    });

    if (proximityTarget !== closestId) {
      setProximityTarget(closestId);
    }
    if (draggingNode !== node.id) {
      setDraggingNode(node.id);
    }
  }, [nodes, proximityTarget, draggingNode, storeEdges]);

  const onNodeDragStop = useCallback((_: any, node: FlowNode) => {
    if (proximityTarget && isEditMode) {
      const targetNode = storeNodes.find(n => n.data.id === proximityTarget);
      if (targetNode) {
        const flowNodeTarget = nodes.find(n => n.id === proximityTarget);
        const draggingX = node.position.x;
        const targetX = flowNodeTarget?.position.x || 0;
        const isNewNodeDownstream = draggingX >= targetX;

        const srcType = isNewNodeDownstream ? targetNode.type : node.type;
        const srcId = isNewNodeDownstream ? targetNode.data.id : node.id;
        const tgtType = isNewNodeDownstream ? node.type : targetNode.type;
        const tgtId = isNewNodeDownstream ? node.id : targetNode.data.id;

        addEdge({
          source_type: srcType as string,
          source_id: srcId,
          target_type: tgtType as string,
          target_id: tgtId,
          relation: 'registered_with'
        });
      }
    }
    setProximityTarget(null);
    setDraggingNode(null);
  }, [proximityTarget, storeNodes, nodes, addEdge, isEditMode]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: FlowNode) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      setSelectedNodeIds((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) {
          next.delete(node.id);
        } else {
          next.add(node.id);
        }
        return next;
      });
      return; // prevent single-node focus/chain trigger when ctrl-clicking
    }

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

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: FlowNode) => {
    event.preventDefault();
    setSelectedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else {
        next.add(node.id);
      }
      return next;
    });
  }, []);

  const onPaneClick = useCallback(() => {
    setActiveChain(null);
    setSelectedNode(null);
    bumpCollapseAll();
    setConnectMenu(null);
    setActiveEdgeId(null);
    setSelectedNodeIds(new Set());
  }, [setActiveChain, setSelectedNode, bumpCollapseAll]);

  const onEdgeDoubleClick = useCallback((_: any, edge: FlowEdge) => {
    if (isEditMode) {
      setActiveEdgeId(edge.id);
    }
  }, [isEditMode]);

  const onConnect = useCallback((params: Connection) => {
    if (!isEditMode) return;
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
  }, [storeNodes, addEdge, isEditMode]);

  const onReconnect = useCallback((oldEdge: FlowEdge, newConnection: Connection) => {
    if (!isEditMode) return;
    if (newConnection.source && newConnection.target) {
      const sourceNode = storeNodes.find(n => n.data.id === newConnection.source);
      const targetNode = storeNodes.find(n => n.data.id === newConnection.target);
      if (sourceNode && targetNode) {
        // Backend edge update doesn't support changing endpoints, so recreate
        deleteEdge(oldEdge.id);
        addEdge({
          source_type: sourceNode.type,
          source_id: newConnection.source,
          target_type: targetNode.type,
          target_id: newConnection.target,
          relation: oldEdge.data?.relation || 'registered_with',
        });
      }
    }
  }, [storeNodes, deleteEdge, addEdge, isEditMode]);

  const onConnectStart = useCallback((_: any, { nodeId }: any) => {
    if (!isEditMode) return;
    connectingNodeId.current = nodeId;
  }, [isEditMode]);

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    if (!isEditMode) return;
    if (!connectingNodeId.current) return;
    const targetIsPane = (event.target as Element).classList.contains('react-flow__pane');
    if (targetIsPane) {
      const clientX = 'touches' in event ? event.touches[0].clientX : (event as MouseEvent).clientX;
      const clientY = 'touches' in event ? event.touches[0].clientY : (event as MouseEvent).clientY;
      setConnectMenu({ x: clientX, y: clientY, sourceId: connectingNodeId.current });
    }
    connectingNodeId.current = null;
  }, [isEditMode]);

  const { screenToFlowPosition } = useReactFlow();

  const handleCreateFromMenu = useCallback((type: string) => {
    if (!connectMenu) return;
    const sourceNode = storeNodes.find(n => n.data.id === connectMenu.sourceId);
    if (!sourceNode) return;

    const position = screenToFlowPosition({ x: connectMenu.x, y: connectMenu.y });
    const tempId = `temp-${Date.now()}`;
    
    const savedPositions = JSON.parse(localStorage.getItem('node_positions') || '{}');
    savedPositions[tempId] = position;
    localStorage.setItem('node_positions', JSON.stringify(savedPositions));

    const newNode: any = {
      type,
      data: { 
        id: tempId, 
        isEditing: true, 
        isExpanded: true,
        pendingConnection: {
          sourceId: sourceNode.data.id,
          sourceType: sourceNode.type
        }
      },
    };
    
    useGraphStore.getState().setActiveChain(null);
    useGraphStore.getState().addTempNode(newNode);
    setConnectMenu(null);
  }, [connectMenu, screenToFlowPosition, storeNodes]);

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


  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }
    e.preventDefault();
  }, []);

  return (
    <div 
      className={`relative w-full h-full ${theme === 'dark' ? 'dark bg-[#0B0F19]' : 'bg-[#F8FAFC]'}`}
      onContextMenu={handleContextMenu}
    >

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeWithSave}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd as any}
        onReconnect={onReconnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'glow' }}
        nodesConnectable={isEditMode}
        edgesReconnectable={isEditMode}
        fitView
        colorMode={theme}
      >
        <Background variant={BackgroundVariant.Lines} gap={24} size={1} color={theme === 'dark' ? '#1e293b' : '#e2e8f0'} className="transition-colors duration-300" />
        <GraphControls onLayout={onLayout} selectedCount={selectedNodeIds.size} />
      </ReactFlow>

      {connectMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-2 w-48 flex flex-col gap-1"
          style={{ top: connectMenu.y, left: connectMenu.x }}
        >
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-2 py-1 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 mb-1">
            Create & Connect
          </div>
          {[
            { type: 'email', icon: Mail, label: 'Email Node', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/50' },
            { type: 'account', icon: User, label: 'Account Node', color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/50' },
            { type: 'service', icon: Server, label: 'Service Node', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/50' },
            { type: 'phone', icon: Smartphone, label: 'Phone Node', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/50' },
          ].map(opt => (
            <button
              key={opt.type}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left text-sm font-medium text-slate-700 dark:text-slate-300"
              onClick={() => handleCreateFromMenu(opt.type)}
            >
              <div className={`p-1 rounded-md ${opt.color}`}>
                <opt.icon className="w-3.5 h-3.5" />
              </div>
              {opt.label}
            </button>
          ))}
        </div>
      )}
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
