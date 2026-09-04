import CopyFieldButton from '../../shared/CopyFieldButton';
import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, useStore } from '@xyflow/react';
import { PhoneNode as PhoneNodeType } from '../../../types/graph';
import { Smartphone, Edit2, PanelRight, Trash2, X } from 'lucide-react';
import { useGraphStore } from '../../../stores/graphStore';
import { useUIStore } from '../../../stores/uiStore';
import clsx from 'clsx';
import { useNodeVisualState } from '../../../hooks/useVisualState';

import { NodeVisualState } from '../../../hooks/useVisualState';
import { PhoneNodeExport } from './PhoneNodeExport';

export interface PhoneNodeProps {
  data: PhoneNodeType;
  id: string;
  exportMode?: boolean;
  theme?: 'dark' | 'light';
  visualState?: NodeVisualState;
}

export const PhoneNode: React.FC<PhoneNodeProps> = (props) => {
  const { data, id: _id, exportMode } = props;

  const [isExpanded, setIsExpanded] = useState((data as any).isExpanded || false);
  const [isEditing, setIsEditing] = useState((data as any).isEditing || false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [editData, setEditData] = useState({
    number: data.number || '',
    carrier: data.carrier || ''
  });

  const { removeTempNode, deleteNode, setSelectedNode, collapseAllSignal, setExpandedNodeId, expandedNodeId } = useGraphStore();
  const { isEditMode: globalEditMode } = useUIStore();
  const connectionInProgress = useStore((s) => s.connection.inProgress);
  const isConnecting = connectionInProgress;


  const { opacity, filter, ringClass, isDimmed, isVisible } = useNodeVisualState(data.id, 'phone');
  const isModalOpen = (data as any).isModalOpen === true;

  const prevCollapseSignal = useRef(collapseAllSignal);
  useEffect(() => {
    if (exportMode) return;
    if (collapseAllSignal !== prevCollapseSignal.current) {
      prevCollapseSignal.current = collapseAllSignal;
      if (!isEditing) { setIsExpanded(false); setExpandedNodeId(null); }
    }
  }, [collapseAllSignal, isEditing, setExpandedNodeId, exportMode]);

  useEffect(() => {
    if (exportMode) return;
    if (expandedNodeId !== data.id && !isEditing && isExpanded) {
      setIsExpanded(false);
    }
  }, [expandedNodeId, data.id, isEditing, isExpanded, exportMode]);

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setErrorMessage(null);
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
      setErrorMessage(null);
      if (!editData.number.trim()) {
        setErrorMessage('Phone number is required.');
        return;
      }

      const isNew = (data as any).isEditing;
      const { createNode, updateNode } = await import('../../../api/nodes');

      // Compute sensible spawn position
      const savedPositions = JSON.parse(localStorage.getItem('node_positions') || '{}');
      let spawnPos = savedPositions[data.id] || {
        x: (data as any).position_x,
        y: (data as any).position_y,
      };
      if (typeof spawnPos.x !== 'number' || typeof spawnPos.y !== 'number' || (spawnPos.x === 0 && spawnPos.y === 0)) {
        const count = useGraphStore.getState().nodes.length;
        spawnPos = {
          x: 100 + (count % 8) * 80,
          y: 100 + (count % 8) * 60,
        };
      }

      if (isNew) {
        const res = await createNode('phone', {
          number: editData.number.trim(),
          carrier: editData.carrier || undefined,
          position_x: spawnPos.x,
          position_y: spawnPos.y,
        });
        savedPositions[res.id] = spawnPos;
        delete savedPositions[data.id];
        localStorage.setItem('node_positions', JSON.stringify(savedPositions));
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
          number: editData.number.trim(),
          carrier: editData.carrier || undefined
        });
      }
      await useGraphStore.getState().fetchGraph();
      setIsEditing(false);
    } catch (err: any) {
      console.error('[PhoneNode Save Error]', err);
      const msg = typeof err === 'string' ? err : err?.message || JSON.stringify(err);
      setErrorMessage(msg);
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setErrorMessage(null);
    if ((data as any).isEditing) {
      removeTempNode(data.id);
    } else {
      setIsEditing(false);
      setEditData({ number: data.number || '', carrier: data.carrier || '' });
    }
  };

  if (exportMode) {
    return <PhoneNodeExport {...props} />;
  }

  if (!isVisible) return null;

  return (
    <div
      style={{
        opacity,
        filter,
      }}
      className={clsx(
        'relative flex flex-col w-max max-w-[320px] transition-all duration-300 ease-out',
        isDimmed && isModalOpen ? 'pointer-events-none' : 'cursor-pointer'
      )}
      onDoubleClick={(e) => {
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('cancel-node-click'));
        if (!isEditing) {
          const nextState = !isExpanded;
          setIsExpanded(nextState);
          if (nextState) {
            setExpandedNodeId(data.id);
          } else {
            setExpandedNodeId(null);
          }
        }
      }}
    >
      <div className={clsx("group relative rounded-full py-1.5 px-3 flex items-center gap-2 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-200 cursor-pointer drop-shadow-[0_2px_8px_rgba(245,158,11,0.15)] dark:drop-shadow-none transition-all duration-150 ease-out", ringClass)}>
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
          className="rounded-xl p-2 border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-1 cursor-default w-max min-w-[150px] max-w-[240px] text-xs nodrag nopan"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
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
              {errorMessage && (
                <div className="p-1.5 rounded bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-[11px] leading-tight break-words">
                  {errorMessage}
                </div>
              )}
              <input
                value={editData.number}
                onChange={(e) => {
                  setErrorMessage(null);
                  setEditData({ ...editData, number: e.target.value });
                }}
                placeholder="Phone Number"
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-amber-500 text-slate-900 dark:text-slate-100 nodrag nopan"
              />
              <input
                value={editData.carrier}
                onChange={(e) => {
                  setErrorMessage(null);
                  setEditData({ ...editData, carrier: e.target.value });
                }}
                placeholder="Carrier"
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-amber-500 text-slate-900 dark:text-slate-100 nodrag nopan"
              />
              <div className="flex gap-2 justify-end mt-2">
                <button onClick={handleCancel} className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium transition-colors nodrag nopan">Cancel</button>
                <button onClick={handleSave} className="px-3 py-1.5 bg-amber-600 text-white hover:bg-amber-700 rounded font-medium transition-colors shadow-sm nodrag nopan">Save</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1 group">
                <span className="text-[11px] font-medium leading-tight text-slate-500">Carrier</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-700 dark:text-slate-300 break-all">{data.carrier || '—'}</span>
                  {!!data.carrier && <CopyFieldButton value={data.carrier} />}
                </div>
              </div>
              
              {data.tags && data.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                  {data.tags.map(tag => (
                    <span key={tag} className={`group/tag relative pl-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] uppercase tracking-wider font-bold rounded-md pr-1.5 transition-all duration-200 ease-out ${globalEditMode ? 'hover:pr-6' : ''}`}>
                      {tag}
                      {globalEditMode && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); useGraphStore.getState().removeTag(data.id, tag); }}
                          className="absolute top-1/2 -translate-y-1/2 right-0.5 text-slate-400 hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all opacity-0 group-hover/tag:opacity-100 flex items-center justify-center p-0.5 rounded-full z-10"
                          title="Remove Tag"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhoneNode;
