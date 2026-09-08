import CopyFieldButton from '../../shared/CopyFieldButton';
import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, useStore } from '@xyflow/react';
import { PhoneNode as PhoneNodeType } from '../../../types/graph';
import { Smartphone, Edit2, PanelRight, Trash2 } from 'lucide-react';
import { useGraphStore } from '../../../stores/graphStore';
import { useUIStore } from '../../../stores/uiStore';
import clsx from 'clsx';
import { useNodeVisualState } from '../../../hooks/useVisualState';

import { NodeVisualState } from '../../../hooks/useVisualState';
import { PhoneNodeExport } from './PhoneNodeExport';
import { EditableTags } from '../../shared/EditableTags';
import { formatErrorMessage } from '../../../api/nodes';

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
  const [editData, setEditData] = useState({
    number: data.number || '',
    carrier: data.carrier || ''
  });
  const [saveError, setSaveError] = useState<string | null>(null);

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
    setSaveError(null);

    const trimmedNumber = editData.number.trim();
    if (!trimmedNumber) {
      setSaveError('Phone number is required');
      return;
    }
    if (!/^[\d\s+\-()./ext]+$/i.test(trimmedNumber)) {
      setSaveError('Phone number contains invalid characters');
      return;
    }

    try {
      const isNew = (data as any).isEditing;
      const { createNode, updateNode } = await import('../../../api/nodes');

      if (isNew) {
        const res = await createNode('phone', {
          number: trimmedNumber,
          carrier: editData.carrier?.trim() || undefined,
          position_x: (data as any).position_x ?? 0,
          position_y: (data as any).position_y ?? 0,
        });
        removeTempNode(data.id);
        
        if ((data as any).pendingConnection) {
          const { createEdge } = await import('../../../api/edges');
          const pc = (data as any).pendingConnection;
          if (pc.sourceId) {
            await createEdge({
              source_type: pc.sourceType,
              source_id: pc.sourceId,
              target_type: 'phone',
              target_id: res.id,
              relation: 'registered_with'
            });
          } else if (pc.targetId) {
            await createEdge({
              source_type: 'phone',
              source_id: res.id,
              target_type: pc.targetType,
              target_id: pc.targetId,
              relation: 'registered_with'
            });
          }
        }
      } else {
        await updateNode('phone', data.id, {
          number: trimmedNumber,
          carrier: editData.carrier?.trim() || undefined
        });
      }
      await useGraphStore.getState().fetchGraph();
      setIsEditing(false);
    } catch (err: any) {
      console.error('[PhoneNode] Raw error:', JSON.stringify(err));
      console.error('[PhoneNode] handleSave error:', err);
      setSaveError(formatErrorMessage(err));
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    if ((data as any).isEditing) {
      removeTempNode(data.id);
    } else {
      setIsEditing(false);
      setEditData({ number: data.number || '', carrier: data.carrier || '' });
      setSaveError(null);
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
        ...(filter !== 'none' ? { filter } : {}),
      }}
      className={clsx(
        'relative flex flex-col items-center w-max max-w-[320px] transition-opacity duration-300 ease-out',
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
      <div className={clsx("group relative rounded-full py-1.5 px-3 flex items-center gap-2 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-200 cursor-pointer shadow-[0_2px_8px_rgba(245,158,11,0.15)] dark:shadow-none border-2 border-transparent transition-colors duration-150 ease-out", ringClass)}>
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
          'absolute top-full left-0 right-0 mx-auto w-max overflow-hidden transition-all duration-300 ease-out z-10',
          isExpanded ? 'max-h-[400px] opacity-100 mt-1.5' : 'max-h-0 opacity-0 mt-0 pointer-events-none'
        )}
      >
        <div
          className="rounded-xl p-2 border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-1 cursor-default w-max min-w-[120px] max-w-[220px] text-xs"
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
              <input
                value={editData.number}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^[\d\s+\-()./ext]*$/i.test(val)) {
                    setEditData({ ...editData, number: val });
                  }
                }}
                placeholder="Phone Number"
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-amber-500 text-slate-900 dark:text-slate-100 text-xs"
              />
              <input
                value={editData.carrier}
                onChange={(e) => setEditData({ ...editData, carrier: e.target.value })}
                placeholder="Carrier"
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-amber-500 text-slate-900 dark:text-slate-100 text-xs"
              />
              {data.tags && data.tags.length > 0 && (
                <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                  <EditableTags nodeId={data.id} tags={data.tags} isEditMode={true} />
                </div>
              )}
              {saveError && (
                <p className="text-[10px] text-red-500 leading-tight break-words">{saveError}</p>
              )}
              <div className="flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-3 py-1.5 bg-amber-600 text-white hover:bg-amber-700 rounded font-medium transition-colors shadow-sm"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 pt-1">
              {/* 1. Number */}
              <div className="flex flex-col group">
                <span className="text-[11px] font-medium leading-tight text-slate-500">Number</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-700 dark:text-slate-300 break-all">{data.number || '—'}</span>
                  {!!data.number && <CopyFieldButton value={data.number} />}
                </div>
              </div>

              {/* 2. Carrier */}
              <div className="flex flex-col group">
                <span className="text-[11px] font-medium leading-tight text-slate-500">Carrier</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-700 dark:text-slate-300 break-all">{data.carrier || '—'}</span>
                  {!!data.carrier && <CopyFieldButton value={data.carrier} />}
                </div>
              </div>

              {/* 3. Tags */}
              {data.tags && data.tags.length > 0 && (
                <div className="mt-1 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                  <EditableTags nodeId={data.id} tags={data.tags} isEditMode={globalEditMode} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhoneNode;
