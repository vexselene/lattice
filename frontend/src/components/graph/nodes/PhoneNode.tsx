import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, useStore } from '@xyflow/react';
import { PhoneNode as PhoneNodeType } from '../../../types/graph';
import { Smartphone, Edit2, PanelRight, Trash2 } from 'lucide-react';
import { useGraphStore } from '../../../stores/graphStore';
import { useUIStore } from '../../../stores/uiStore';
import clsx from 'clsx';

export const PhoneNode: React.FC<{ data: PhoneNodeType; id: string }> = ({ data, id: _id }) => {
  const [isExpanded, setIsExpanded] = useState((data as any).isExpanded || false);
  const [isEditing, setIsEditing] = useState((data as any).isEditing || false);
  const [editData, setEditData] = useState({
    number: data.number || '',
    carrier: data.carrier || ''
  });

  const { removeTempNode, deleteNode, setSelectedNode, collapseAllSignal, setExpandedNodeId, setActiveChain, edges: storeEdges } = useGraphStore();
  const { isEditMode: globalEditMode } = useUIStore();
  const connectionInProgress = useStore((s) => s.connection.inProgress);
  const isConnecting = connectionInProgress;


  const isDimmed = (data as any).isDimmed === true;
  const isModalOpen = (data as any).isModalOpen === true;

  const prevCollapseSignal = useRef(collapseAllSignal);
  useEffect(() => {
    if (collapseAllSignal !== prevCollapseSignal.current) {
      prevCollapseSignal.current = collapseAllSignal;
      if (!isEditing) { setIsExpanded(false); setExpandedNodeId(null); }
    }
  }, [collapseAllSignal, isEditing]);

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setIsExpanded(true);
  };

  const handleOpenSidebar = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode({ type: 'phone', data } as any);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if ((data as any).isEditing) {
      removeTempNode(data.id);
    } else {
      deleteNode('phone', data.id);
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const isNew = (data as any).isEditing;
      const { createNode, updateNode } = await import('../../../api/nodes');

      if (isNew) {
        const res = await createNode('phone', {
          number: editData.number,
          carrier: editData.carrier || undefined
        });
        const savedPositions = JSON.parse(localStorage.getItem('node_positions') || '{}');
        if (savedPositions[data.id]) {
          savedPositions[res.id] = savedPositions[data.id];
          delete savedPositions[data.id];
          localStorage.setItem('node_positions', JSON.stringify(savedPositions));
        }
        removeTempNode(data.id);
        
        if ((data as any).pendingConnection) {
          const { createEdge } = await import('../../../api/edges');
          await createEdge({
            source_type: (data as any).pendingConnection.sourceType,
            source_id: (data as any).pendingConnection.sourceId,
            target_type: 'phone',
            target_id: res.id,
            relation: 'registered_with'
          });
        }
      } else {
        await updateNode('phone', data.id, {
          number: editData.number,
          carrier: editData.carrier || undefined
        });
      }
      await useGraphStore.getState().fetchGraph();
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    if ((data as any).isEditing) {
      removeTempNode(data.id);
    } else {
      setIsEditing(false);
      setEditData({ number: data.number || '', carrier: data.carrier || '' });
    }
  };

  return (
    <div
      className={clsx(
        'relative flex flex-col w-max max-w-[320px] transition-all duration-300 ease-out',
        isDimmed ? `opacity-30 blur-[0.5px] grayscale-[30%] ${isModalOpen ? 'pointer-events-none' : 'cursor-pointer'}` : 'opacity-100 grayscale-0 shadow-sm'
      )}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!isEditing) {
          const nextState = !isExpanded;
          setIsExpanded(nextState);
          if (nextState) {
            setExpandedNodeId(data.id);
            // Highlight chain
            const neighborNodes = new Set([data.id]);
            const matchingEdges = new Set<string>();
            storeEdges.forEach((edge) => {
              if (edge.source_id === data.id || edge.target_id === data.id) {
                matchingEdges.add(edge.id);
                neighborNodes.add(edge.source_id);
                neighborNodes.add(edge.target_id);
              }
            });
            setActiveChain({ nodeIds: neighborNodes, edgeIds: matchingEdges });
          } else {
            setExpandedNodeId(null);
          }
        }
      }}
    >
      <div className="group relative rounded-full py-1.5 px-3 border shadow-sm flex items-center gap-2 bg-amber-50/80 border-amber-200/80 text-amber-950 dark:bg-amber-950/30 dark:border-amber-500/30 dark:text-amber-200 shadow-amber-100/50 dark:shadow-amber-950/40 cursor-pointer drop-shadow-md">
        <Handle type="target" position={Position.Left} id="target-left" className={clsx("w-2.5 h-2.5 !bg-slate-400 transition-opacity duration-200", isConnecting ? "opacity-100" : "opacity-0 group-hover:opacity-100")} />
        <Handle type="source" position={Position.Right} id="source-right" className={clsx("w-2.5 h-2.5 !bg-slate-400 transition-opacity duration-200", isConnecting ? "opacity-100" : "opacity-0 group-hover:opacity-100")} />

        <div className="p-1 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300 flex-shrink-0">
          <Smartphone className="w-3.5 h-3.5" />
        </div>
        <span className="text-sm font-medium tracking-tight truncate max-w-[150px]">
          {isEditing ? (editData.number || 'New Phone') : (data.number || 'New Phone')}
        </span>
      </div>

      <div
        className={clsx(
          'absolute top-full left-1/2 -translate-x-1/2 overflow-hidden transition-all duration-300 ease-out z-10',
          isExpanded ? 'max-h-[400px] opacity-100 mt-1.5' : 'max-h-0 opacity-0 mt-0'
        )}
      >
        <div
          className="rounded-xl p-2.5 border bg-white/90 dark:bg-slate-900/90 border-slate-200/80 dark:border-slate-700/80 shadow-lg flex flex-col gap-1.5 cursor-default w-full min-w-[220px] max-w-[280px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-amber-100/80 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 text-[10px] font-bold uppercase tracking-widest">
              Phone
            </span>
            <div className="flex items-center gap-1">
              {(!isEditing && globalEditMode) && (
                <button onClick={handleEdit} className="p-1 text-slate-400 hover:text-amber-600 transition-colors" title="Edit Node">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              {!isEditing && (
                <button onClick={handleOpenSidebar} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" title="Open Detail Panel">
                  <PanelRight className="w-3.5 h-3.5" />
                </button>
              )}
              {(!isEditing && globalEditMode) && (
                <button onClick={handleDelete} className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="Delete Node">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {isEditing ? (
            <div className="flex flex-col gap-2 w-full min-w-0 mt-1">
              <input value={editData.number} onChange={(e) => setEditData({ ...editData, number: e.target.value })} placeholder="Phone Number" className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-amber-500 text-slate-900 dark:text-slate-100" />
              <input value={editData.carrier} onChange={(e) => setEditData({ ...editData, carrier: e.target.value })} placeholder="Carrier" className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-amber-500 text-slate-900 dark:text-slate-100" />
              <div className="flex gap-2 justify-end mt-2">
                <button onClick={handleCancel} className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium transition-colors">Cancel</button>
                <button onClick={handleSave} className="px-3 py-1.5 bg-amber-600 text-white hover:bg-amber-700 rounded font-medium transition-colors shadow-sm">Save</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium leading-tight text-slate-500">Carrier</span>
              <span className="text-slate-700 dark:text-slate-300">{data.carrier || '—'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhoneNode;
