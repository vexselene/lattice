import React, { useEffect, useCallback, useState, useRef, useMemo } from 'react';
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
  MarkerType,
  SelectionMode,
  MiniMap
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Mail, User, Smartphone } from 'lucide-react';

import { useGraphStore } from '../../stores/graphStore';
import { useUIStore } from '../../stores/uiStore';
import EmailNode from './nodes/EmailNode';
import AccountNode from './nodes/AccountNode';
import PhoneNode from './nodes/PhoneNode';
import GlowEdge from './edges/GlowEdge';
import GraphControls from './GraphControls';
import SelectionActionDock from './SelectionActionDock';
import { ExportModal } from './ExportModal';
import useGraphLayout from '../../hooks/useGraphLayout';
import { GRAPH_STYLE } from '../../config/graphStyleConfig';
import { updateNodePosition } from '../../api/nodes';

const nodeTypes = {
  email: EmailNode,
  account: AccountNode,
  phone: PhoneNode,
};

const edgeTypes = {
  glow: GlowEdge,
};

const nodeColor = (node: FlowNode) => {
  switch (node.type) {
    case 'email': return '#93c5fd';
    case 'account': return '#c084fc';
    case 'service': return '#6ee7b7';
    case 'phone': return '#fcd34d';
    default: return '#94a3b8';
  }
};

const nodeStrokeColor = (node: FlowNode) => {
  switch (node.type) {
    case 'email': return '#60a5fa';
    case 'account': return '#a855f7';
    case 'service': return '#34d399';
    case 'phone': return '#fbbf24';
    default: return '#94a3b8';
  }
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
    expandedNodeId,
    selectedNodeIds,
    setSelectedNodeIds,
    selectedEdgeIds,
    setSelectedEdgeIds,
    activeMultiMode,
    setActiveMultiMode
  } = useGraphStore();
  
  const { theme, searchQuery, typeFilters, tagFilters, serviceFilters, isEditMode } = useUIStore();
  
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);
  const { getLayoutedElements } = useGraphLayout();

  const [connectMenu, setConnectMenu] = useState<{ x: number, y: number, sourceId: string } | null>(null);
  const [exportModalScope, setExportModalScope] = useState<'full' | 'selected' | null>(null);
  const connectingNodeId = useRef<string | null>(null);
  // Tracks whether the drag originated from a 'source' or 'target' handle.
  // When dragging from a 'target' handle, the existing node becomes the target
  // and the newly created node becomes the source.
  const connectingHandleType = useRef<'source' | 'target' | null>(null);

  const [proximityTarget, setProximityTarget] = useState<string | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);

  const multiChains = useMemo(() => {
    if (activeMultiMode === 'chains' && selectedNodeIds.size > 0) {
      const nodeIds = new Set<string>(selectedNodeIds);
      const edgeIds = new Set<string>();
      
      storeEdges.forEach(e => {
        if (selectedNodeIds.has(e.source_id) || selectedNodeIds.has(e.target_id)) {
          edgeIds.add(e.id);
          nodeIds.add(e.source_id);
          nodeIds.add(e.target_id);
        }
      });
      return { nodeIds, edgeIds };
    }
    return null;
  }, [activeMultiMode, selectedNodeIds, storeEdges]);

  const isShiftDraggingRef = useRef(false);
  const pendingSelectionRef = useRef<Set<string>>(new Set());

  const onSelectionStart = useCallback(() => {
    isShiftDraggingRef.current = true;
  }, []);

  const onSelectionEnd = useCallback(() => {
    isShiftDraggingRef.current = false;
    if (pendingSelectionRef.current.size > 0) {
      setSelectedNodeIds(prev => {
        const next = new Set(prev);
        pendingSelectionRef.current.forEach(id => next.add(id));
        return next;
      });
      pendingSelectionRef.current.clear();
    }
  }, []);

  const onSelectionChange = useCallback(({ nodes }: { nodes: FlowNode[] }) => {
    if (isShiftDraggingRef.current && nodes.length > 0) {
      pendingSelectionRef.current = new Set(nodes.map(n => n.id));
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const activeElement = document.activeElement;
        if (activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          (activeElement as HTMLElement).isContentEditable
        )) {
          return;
        }

        // Remove any ghost temp nodes (created by drag-to-create but not yet saved)
        const { nodes: storeNodes, removeTempNode } = useGraphStore.getState();
        storeNodes
          .filter((n) => (n.data as any).isEditing === true)
          .forEach((n) => removeTempNode(n.data.id));

        if (activeMultiMode !== 'none') {
          setActiveMultiMode('none');
          setActiveChain(null);
        } else if (selectedNodeIds.size > 0) {
          setSelectedNodeIds(new Set());
        } else {
          setSelectedNode(null);
          if (activeElement instanceof HTMLElement) {
            activeElement.blur();
          }
        }
        setSelectedEdgeIds(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMultiMode, selectedNodeIds, setActiveChain, setSelectedNode, selectedEdgeIds]);


  useEffect(() => {
    const savedPositions = JSON.parse(localStorage.getItem('node_positions') || '{}');

    let visibleNodeIds = new Set<string>();

    let effectiveActiveChain = activeChain;
    if (selectedEdgeIds.size > 0) {
      const edgeIds = new Set<string>(activeChain ? activeChain.edgeIds : []);
      const nodeIds = new Set<string>(activeChain ? activeChain.nodeIds : []);
      storeEdges.forEach(e => {
        if (selectedEdgeIds.has(e.id)) {
          edgeIds.add(e.id);
          nodeIds.add(e.source_id);
          nodeIds.add(e.target_id);
        }
      });
      effectiveActiveChain = { nodeIds, edgeIds };
    } else if (selectedNodeIds.size > 0 && activeMultiMode === 'none' && !activeChain) {
      // Marquee / Ctrl+click node selection: highlight the selected nodes and
      // all edges that touch at least one selected node, dimming the rest.
      const nodeIds = new Set<string>(selectedNodeIds);
      const edgeIds = new Set<string>();
      storeEdges.forEach(e => {
        if (selectedNodeIds.has(e.source_id) || selectedNodeIds.has(e.target_id)) {
          edgeIds.add(e.id);
          nodeIds.add(e.source_id);
          nodeIds.add(e.target_id);
        }
      });
      effectiveActiveChain = { nodeIds, edgeIds };
    }


    const flowNodes: FlowNode[] = storeNodes.map((n) => {
      let isHidden = false;

      if (typeFilters.length > 0 && !typeFilters.includes(n.type)) {
        isHidden = true;
      }

      if (!isHidden && tagFilters.length > 0) {
        const tags = n.data.tags || [];
        if (!tagFilters.some((f: string) => tags.includes(f))) {
          isHidden = true;
        }
      }

      if (!isHidden && serviceFilters && serviceFilters.length > 0) {
        if (n.type !== 'account') {
          isHidden = true;
        } else {
          const sName = (n.data as any)?.service_name;
          const sId = (n.data as any)?.service_id;
          if (!serviceFilters.includes(sName) && !serviceFilters.includes(sId)) {
            isHidden = true;
          }
        }
      }

      if (!isHidden && searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        
        if (q.startsWith('tags:')) {
          const searchTag = q.slice(5).trim();
          const tags = n.data.tags || [];
          if (!tags.some((t: string) => t.toLowerCase().includes(searchTag))) {
            isHidden = true;
          }
        } else {
          const d = n.data as any;
          const label = (d.address || d.username || d.name || d.number || '').toLowerCase();
          if (!label.includes(q)) {
            isHidden = true;
          }
        }
      }
      
      if (activeMultiMode === 'isolate' && selectedNodeIds.size > 0) {
        if (!selectedNodeIds.has(n.data.id as string)) {
          isHidden = true;
        }
      }

      if (!isHidden) {
        visibleNodeIds.add(n.data.id);
      }

      const isModalOpen = expandedNodeId !== null;
      const isSelected = selectedNodeIds.has(n.data.id as string);

      return {
        ...n,
        id: n.data.id,
        selected: isSelected,
        zIndex: expandedNodeId === n.data.id ? 1000 : (isSelected ? 50 : 1),
        data: { 
          ...(n.data as any), 
          isModalOpen,
        },
        position: savedPositions[n.data.id] || { x: 0, y: 0 },
        hidden: isHidden,
      };
    });

    const defaultColor = theme === 'dark' ? GRAPH_STYLE.colors.edge.baseDark : GRAPH_STYLE.colors.edge.baseLight;
    const highlightColor = theme === 'dark' ? GRAPH_STYLE.colors.edge.highlightDark : GRAPH_STYLE.colors.edge.highlightLight;

    const flowEdges: FlowEdge[] = storeEdges.map((e) => {
      let isHidden = !visibleNodeIds.has(e.source_id) || !visibleNodeIds.has(e.target_id);
      
      if (activeMultiMode === 'isolate' && selectedNodeIds.size > 0) {
        if (!selectedNodeIds.has(e.source_id) || !selectedNodeIds.has(e.target_id)) {
          isHidden = true;
        }
      }

      let isEdgeDimmed = false;
      let isEdgeHighlighted = false;
      
      if (activeMultiMode === 'chains' && multiChains) {
        isEdgeHighlighted = multiChains.edgeIds.has(e.id);
        isEdgeDimmed = !isEdgeHighlighted;
      } else {
        isEdgeDimmed = effectiveActiveChain !== null && !effectiveActiveChain.edgeIds.has(e.id);
        isEdgeHighlighted = effectiveActiveChain !== null && effectiveActiveChain.edgeIds.has(e.id);
      }

      return {
        id: e.id,
        source: e.source_id,
        sourceHandle: 'source-right',
        target: e.target_id,
        targetHandle: 'target-left',
        type: 'glow',
        hidden: isHidden,
        selected: selectedEdgeIds.has(e.id),
        animated: isEdgeHighlighted || (activeMultiMode === 'chains' && isEdgeHighlighted),
        data: { relation: e.relation, isModalOpen: expandedNodeId !== null },
        markerEnd: {
          type: MarkerType.Arrow,
          width: isEdgeHighlighted ? 14 : 12,
          height: isEdgeHighlighted ? 14 : 12,
          strokeWidth: isEdgeHighlighted ? 1.75 : 1.5,
          color: isEdgeDimmed ? GRAPH_STYLE.colors.edge.baseLight : (isEdgeHighlighted ? highlightColor : defaultColor),
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
          style: { strokeDasharray: '4 4', stroke: highlightColor, strokeWidth: 2 },
        } as FlowEdge);
      }
    }

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [storeNodes, storeEdges, setNodes, setEdges, searchQuery, typeFilters, tagFilters, serviceFilters, activeChain, selectedEdgeIds, expandedNodeId, proximityTarget, draggingNode, activeMultiMode, selectedNodeIds, multiChains]);


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
    } else {
      // Normal node drag (no proximity connection) - save position to database
      updateNodePosition(node.type || 'email', node.id, node.position.x, node.position.y)
        .catch(err => console.error('[GraphCanvas] Failed to update node position:', err));
    }
    setProximityTarget(null);
    setDraggingNode(null);
  }, [proximityTarget, storeNodes, nodes, addEdge, isEditMode]);

  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleCancelNodeClick = () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
    };
    window.addEventListener('cancel-node-click', handleCancelNodeClick);
    return () => window.removeEventListener('cancel-node-click', handleCancelNodeClick);
  }, []);

  const onNodeClick = useCallback((event: React.MouseEvent, node: FlowNode) => {
    setSelectedEdgeIds(new Set()); // clear edge selection when clicking node

    if (event.ctrlKey || event.metaKey || activeMultiMode !== 'none') {
      event.preventDefault();
      event.stopPropagation();
      setSelectedNodeIds((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) {
          next.delete(node.id);
        } else {
          next.add(node.id);
        }
        return next;
      });
      return;
    }

    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = setTimeout(() => {
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
      useGraphStore.getState().setExpandedNodeId(null);
    }, GRAPH_STYLE.timing.clickDelayMs);
  }, [storeEdges, setActiveChain, activeMultiMode]);

  const onNodeDoubleClick = useCallback(() => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
  }, []);

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
    // If an edge was clicked within the last 500ms, ignore pane clicks.
    // This prevents DOM-replacement phantom clicks from deselecting the edge during a double-click gesture.
    if (Date.now() - ((window as any).__lastEdgeClick || 0) < 500) {
      return;
    }

    // Remove any ghost temp nodes (drag-to-create nodes abandoned without saving or cancelling)
    const { nodes: currentStoreNodes, removeTempNode } = useGraphStore.getState();
    currentStoreNodes
      .filter((n) => (n.data as any).isEditing === true)
      .forEach((n) => removeTempNode(n.data.id));

    if (activeMultiMode !== 'none') {
      setActiveMultiMode('none');
      setSelectedNodeIds(new Set());
      setSelectedEdgeIds(new Set());
      setActiveChain(null);
    } else {
      setActiveChain(null);
      setSelectedNode(null);
      bumpCollapseAll();
      setConnectMenu(null);
      setSelectedNodeIds(new Set());
      setSelectedEdgeIds(new Set());
    }
  }, [activeMultiMode, setActiveChain, setSelectedNode, bumpCollapseAll, setSelectedEdgeIds]);

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: FlowEdge) => {
    event.stopPropagation();
    
    useGraphStore.getState().setOpenMenuEdgeId(null);
    
    setSelectedEdgeIds((prev) => {
      const next = new Set(prev);
      if (event.ctrlKey || event.metaKey) {
        if (next.has(edge.id)) next.delete(edge.id);
        else next.add(edge.id);
      } else {
        next.clear();
        next.add(edge.id);
      }
      return next;
    });
    
    setSelectedNodeIds(new Set());
    setActiveChain(null);
    setSelectedNode(null);
  }, [setSelectedEdgeIds, setSelectedNodeIds, setActiveChain, setSelectedNode]);

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

  const onConnectStart = useCallback((_: any, { nodeId, handleType }: any) => {
    if (!isEditMode) return;
    connectingNodeId.current = nodeId;
    connectingHandleType.current = handleType ?? 'source';
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
    connectingHandleType.current = null;
  }, [isEditMode]);

  const { screenToFlowPosition, setCenter } = useReactFlow();

  useEffect(() => {
    const handleFlyToNode = (e: Event) => {
      const customEvent = e as CustomEvent;
      const nodeId = customEvent.detail?.id;
      if (!nodeId) return;

      const node = nodes.find(n => n.id === nodeId);
      if (node && node.position) {
        setCenter(node.position.x + 90, node.position.y + 40, { zoom: 1.2, duration: 800 });
        setSelectedNodeIds(new Set([nodeId]));
      }
    };
    window.addEventListener('flyToNode', handleFlyToNode);
    return () => window.removeEventListener('flyToNode', handleFlyToNode);
  }, [nodes, setCenter, setSelectedNodeIds]);

  const handleCreateFromMenu = useCallback((type: string) => {
    if (!connectMenu) return;
    const existingNode = storeNodes.find(n => n.data.id === connectMenu.sourceId);
    if (!existingNode) return;

    const position = screenToFlowPosition({ x: connectMenu.x, y: connectMenu.y });
    const tempId = `temp-${Date.now()}`;
    
    const savedPositions = JSON.parse(localStorage.getItem('node_positions') || '{}');
    savedPositions[tempId] = position;
    localStorage.setItem('node_positions', JSON.stringify(savedPositions));

    // If the drag originated from a 'target' handle, the existing node is the target
    // and the newly created node is the source. Otherwise existing = source, new = target.
    const draggedFromTarget = connectingHandleType.current === 'target';

    const pendingConnection = draggedFromTarget
      ? {
          // new node → existing node  (new node is source)
          targetId: existingNode.data.id,
          targetType: existingNode.type,
        }
      : {
          // existing node → new node  (existing node is source)
          sourceId: existingNode.data.id,
          sourceType: existingNode.type,
        };

    const newNode: any = {
      type,
      data: { 
        id: tempId, 
        isEditing: true, 
        isExpanded: true,
        pendingConnection,
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

  let canvasCursor = 'cursor-default';
  if (activeMultiMode === 'isolate') canvasCursor = 'cursor-crosshair';
  else if (activeMultiMode === 'chains') canvasCursor = 'cursor-copy';

  return (
    <div 
      className={`relative w-full h-full ${theme === 'dark' ? 'dark bg-[#0B0F19]' : 'bg-[#F8FAFC]'} ${canvasCursor}`}
      onContextMenu={handleContextMenu}
    >

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeWithSave}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onEdgeClick={onEdgeClick}
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
        selectionMode={SelectionMode.Partial}
        selectionOnDrag={true}
        selectionKeyCode="Shift"
        multiSelectionKeyCode={['Control', 'Meta']}
        selectNodesOnDrag={false}
        edgesFocusable={false}
        onSelectionStart={onSelectionStart}
        onSelectionEnd={onSelectionEnd}
        onSelectionChange={onSelectionChange}
        fitView
        colorMode={theme}
      >
        <Background variant={BackgroundVariant.Lines} gap={24} size={1} color={theme === 'dark' ? '#1e293b' : '#e2e8f0'} className="transition-colors duration-300" />
        <GraphControls 
          onLayout={onLayout} 
          selectedCount={selectedNodeIds.size}
          activeMultiMode={activeMultiMode}
          onToggleMultiMode={(mode) => setActiveMultiMode(prev => prev === mode ? 'none' : mode)}
          onOpenExport={() => setExportModalScope('full')}
        />
        <MiniMap 
          position="top-right"
          pannable={true}
          zoomable={true}
          nodeColor={nodeColor}
          nodeStrokeColor={nodeStrokeColor}
          nodeStrokeWidth={3}
          maskColor={theme === 'dark' ? 'rgba(15, 23, 42, 0.6)' : 'rgba(240, 242, 245, 0.6)'}
          className="bg-white dark:bg-[#0f172a] !rounded-xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-lg !m-4"
        />
      </ReactFlow>

      <SelectionActionDock 
        selectedNodeIds={selectedNodeIds}
        onClearSelection={() => {
          setSelectedNodeIds(new Set());
          if (activeMultiMode !== 'none') {
            setActiveMultiMode('none');
          }
          setActiveChain(null);
        }}
        onOpenExport={() => setExportModalScope('selected')}
      />

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

      <ExportModal 
        isOpen={exportModalScope !== null} 
        initialScope={exportModalScope || 'full'} 
        onClose={() => setExportModalScope(null)} 
      />
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
