import CopyFieldButton from '../../shared/CopyFieldButton';
import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, useStore } from '@xyflow/react';
import { ServiceNode as ServiceNodeType } from '../../../types/graph';
import { Server, Edit2, PanelRight, Trash2, X } from 'lucide-react';
import { useGraphStore } from '../../../stores/graphStore';
import { useUIStore } from '../../../stores/uiStore';
import clsx from 'clsx';
import { useNodeVisualState } from '../../../hooks/useVisualState';

import { GRAPH_STYLE } from '../../../config/graphStyleConfig';
import { NodeVisualState } from '../../../hooks/useVisualState';

export interface ServiceNodeProps {
  data: ServiceNodeType;
  id: string;
  exportMode?: boolean;
  theme?: 'dark' | 'light';
  visualState?: NodeVisualState;
}

export const ServiceNode: React.FC<ServiceNodeProps> = ({ data, id: _id, exportMode, theme, visualState }) => {
  if (exportMode) {
    const themeMode = theme || 'dark';
    const nodeTheme = GRAPH_STYLE.colors.node.service[themeMode];
    const ringStyle = visualState?.ringClass
      ? `0 0 0 2px ${nodeTheme.ring}, 0 0 0 3px ${themeMode === 'dark' ? '#0f172a' : '#ffffff'}`
      : undefined;

    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '9999px',
          backgroundColor: nodeTheme.bg,
          color: nodeTheme.text,
          border: `1px solid ${nodeTheme.border}`,
          boxShadow: ringStyle,
          opacity: visualState?.opacity ?? 1,
          filter: visualState?.filter ?? 'none',
          fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontSize: '14px',
          fontWeight: 500,
          lineHeight: '20px',
          boxSizing: 'border-box',
          whiteSpace: 'nowrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            borderRadius: '9999px',
            backgroundColor: nodeTheme.iconBg,
            color: nodeTheme.iconText,
            flexShrink: 0,
          }}
        >
          <Server style={{ width: '14px', height: '14px' }} />
        </div>
        <span
          style={{
            maxWidth: '150px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '-0.01em',
          }}
        >
          {data.name || 'New Service'}
        </span>
      </div>
    );
  }

  const [isExpanded, setIsExpanded] = useState((data as any).isExpanded || false);
  const [isEditing, setIsEditing] = useState((data as any).isEditing || false);
  const [editData, setEditData] = useState({
    name: data.name || '',
    category: data.category || '',
    url: data.url || ''
  });

  const { removeTempNode, deleteNode, setSelectedNode, collapseAllSignal, setExpandedNodeId, expandedNodeId } = useGraphStore();
  const { isEditMode: globalEditMode } = useUIStore();
  const connectionInProgress = useStore((s) => s.connection.inProgress);
  const isConnecting = connectionInProgress;


  const { opacity, filter, ringClass, isDimmed, isVisible } = useNodeVisualState(data.id, 'service');
  const isModalOpen = (data as any).isModalOpen === true;

  const prevCollapseSignal = useRef(collapseAllSignal);
  useEffect(() => {
    if (collapseAllSignal !== prevCollapseSignal.current) {
      prevCollapseSignal.current = collapseAllSignal;
      if (!isEditing) { setIsExpanded(false); setExpandedNodeId(null); }
    }
  }, [collapseAllSignal, isEditing, setExpandedNodeId]);

  useEffect(() => {
    if (expandedNodeId !== data.id && !isEditing && isExpanded) {
      setIsExpanded(false);
    }
  }, [expandedNodeId, data.id, isEditing, isExpanded]);

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setIsExpanded(true);
  };

  const handleOpenSidebar = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode({ type: 'service', data } as any);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if ((data as any).isEditing) {
      removeTempNode(data.id);
    } else {
      deleteNode('service', data.id);
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const isNew = (data as any).isEditing;
      const { createNode, updateNode } = await import('../../../api/nodes');

      if (isNew) {
        const res = await createNode('service', {
          name: editData.name,
          category: editData.category || undefined,
          url: editData.url || undefined
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
            target_type: 'service',
            target_id: res.id,
            relation: 'registered_with'
          });
        }
      } else {
        await updateNode('service', data.id, {
          name: editData.name,
          category: editData.category || undefined,
          url: editData.url || undefined
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
      setEditData({ name: data.name || '', category: data.category || '', url: data.url || '' });
    }
  };

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
      <div className={clsx("group relative rounded-full py-1.5 px-3 flex items-center gap-2 bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-200 cursor-pointer drop-shadow-[0_2px_8px_rgba(16,185,129,0.15)] dark:drop-shadow-none transition-all duration-150 ease-out", ringClass)}>
        <Handle type="target" position={Position.Left} id="target-left" className={clsx("w-2.5 h-2.5 !bg-slate-400 transition-opacity duration-200", isConnecting ? "opacity-100" : "opacity-0 group-hover:opacity-100")} />
        <Handle type="source" position={Position.Right} id="source-right" className={clsx("w-2.5 h-2.5 !bg-slate-400 transition-opacity duration-200", isConnecting ? "opacity-100" : "opacity-0 group-hover:opacity-100")} />

        <div className="p-1 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300 flex-shrink-0">
          <Server className="w-3.5 h-3.5" />
        </div>
        <span className="text-sm font-medium tracking-tight truncate max-w-[150px]">
          {isEditing ? (editData.name || 'New Service') : (data.name || 'New Service')}
        </span>
      </div>

      <div
        className={clsx(
          'absolute top-full left-1/2 -translate-x-1/2 overflow-hidden transition-all duration-300 ease-out z-10',
          isExpanded ? 'max-h-[400px] opacity-100 mt-1.5' : 'max-h-0 opacity-0 mt-0'
        )}
      >
        <div
          className="rounded-xl p-2 border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-1 cursor-default w-max min-w-[120px] max-w-[220px] text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-widest">
              Service
            </span>
            <div className="flex items-center gap-1">
              {(!isEditing && globalEditMode) && (
                <button onClick={handleEdit} className="p-1 text-slate-400 hover:text-emerald-600 transition-colors" title="Edit Node">
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
              <input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} placeholder="Service Name" className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-emerald-500 text-slate-900 dark:text-slate-100" />
              <input value={editData.category} onChange={(e) => setEditData({ ...editData, category: e.target.value })} placeholder="Category" className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-emerald-500 text-slate-900 dark:text-slate-100" />
              <input value={editData.url} onChange={(e) => setEditData({ ...editData, url: e.target.value })} placeholder="URL" className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-emerald-500 text-slate-900 dark:text-slate-100" />
              <div className="flex gap-2 justify-end mt-2">
                <button onClick={handleCancel} className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium transition-colors">Cancel</button>
                <button onClick={handleSave} className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded font-medium transition-colors shadow-sm">Save</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1 group">
                <span className="text-[11px] font-medium leading-tight text-slate-500">Category</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-700 dark:text-slate-300 break-all">{data.category || '—'}</span>
                  {!!data.category && <CopyFieldButton value={data.category} />}
                </div>
              </div>
              <div className="flex flex-col gap-1 group">
                <span className="text-[11px] font-medium leading-tight text-slate-500">URL</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-700 dark:text-slate-300 break-all">{data.url || '—'}</span>
                  {!!data.url && <CopyFieldButton value={data.url} />}
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

export default ServiceNode;
