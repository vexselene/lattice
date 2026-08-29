import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, useStore } from '@xyflow/react';
import { AccountNode as AccountNodeType } from '../../../types/graph';
import { User, Edit2, PanelRight, Trash2 } from 'lucide-react';
import { useGraphStore } from '../../../stores/graphStore';
import { useUIStore } from '../../../stores/uiStore';
import CopyFieldButton from '../../shared/CopyFieldButton';
import PasswordField from '../../sidebar/PasswordField';
import clsx from 'clsx';

export const AccountNode: React.FC<{ data: AccountNodeType; id: string }> = ({ data, id: _id }) => {
  const [isExpanded, setIsExpanded] = useState((data as any).isExpanded || false);
  const [isEditing, setIsEditing] = useState((data as any).isEditing || false);
  const [editData, setEditData] = useState({
    username: data.username || '',
    service_id: data.service_id || '',
    password: ''
  });

  const { removeTempNode, deleteNode, setSelectedNode, collapseAllSignal, setExpandedNodeId, expandedNodeId } = useGraphStore();
  const { isEditMode: globalEditMode } = useUIStore();
  const connectionInProgress = useStore((s) => s.connection.inProgress);
  const isConnecting = connectionInProgress;


  const isDimmed = (data as any).isDimmed === true;
  const isModalOpen = (data as any).isModalOpen === true;
  const isSelected = Boolean((data as any).isSelected);

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
    setSelectedNode({ type: 'account', data } as any);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if ((data as any).isEditing) {
      removeTempNode(data.id);
    } else {
      deleteNode('account', data.id);
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const isNew = (data as any).isEditing;
      const { createNode, updateNode } = await import('../../../api/nodes');

      if (isNew) {
        const res = await createNode('account', {
          username: editData.username,
          service_id: editData.service_id || 'unlinked',
          password_raw: editData.password || undefined
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
            target_type: 'account',
            target_id: res.id,
            relation: 'registered_with'
          });
        }
      } else {
        await updateNode('account', data.id, {
          username: editData.username,
          service_id: editData.service_id || 'unlinked',
          password_raw: editData.password || undefined
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
      setEditData({ username: data.username || '', service_id: data.service_id || '', password: '' });
    }
  };

  return (
    <div
      className={clsx(
        'relative flex flex-col w-max max-w-[320px] transition-all duration-300 ease-out',
        isDimmed ? `opacity-30 blur-[0.5px] grayscale-[30%] ${isModalOpen ? 'pointer-events-none' : 'cursor-pointer'}` : 'opacity-100 grayscale-0'
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
      <div className={clsx("group relative rounded-full py-1.5 px-3 flex items-center gap-2 bg-purple-50 text-purple-950 dark:bg-purple-950 dark:text-purple-200 cursor-pointer drop-shadow-[0_2px_8px_rgba(168,85,247,0.15)] dark:drop-shadow-none transition-all duration-150 ease-out", isSelected && "ring-2 ring-purple-500/80 ring-offset-1 ring-offset-white dark:ring-offset-slate-900")}>
        <Handle type="target" position={Position.Left} id="target-left" className={clsx("w-2.5 h-2.5 !bg-slate-400 transition-opacity duration-200", isConnecting ? "opacity-100" : "opacity-0 group-hover:opacity-100")} />
        <Handle type="source" position={Position.Right} id="source-right" className={clsx("w-2.5 h-2.5 !bg-slate-400 transition-opacity duration-200", isConnecting ? "opacity-100" : "opacity-0 group-hover:opacity-100")} />

        <div className="p-1 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300 flex-shrink-0">
          <User className="w-3.5 h-3.5" />
        </div>
        <span className="text-sm font-medium tracking-tight truncate max-w-[150px]">
          {isEditing ? (editData.username || 'New Account') : (data.username || 'New Account')}
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
            <span className="px-2 py-0.5 rounded-full bg-purple-100/80 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 text-[10px] font-bold uppercase tracking-widest">
              Account
            </span>
            <div className="flex items-center gap-1">
              {(!isEditing && globalEditMode) && (
                <button onClick={handleEdit} className="p-1 text-slate-400 hover:text-purple-600 transition-colors" title="Edit Node">
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
              <input value={editData.username} onChange={(e) => setEditData({ ...editData, username: e.target.value })} placeholder="Username" className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-purple-500 text-slate-900 dark:text-slate-100" />
              <input value={editData.service_id} onChange={(e) => setEditData({ ...editData, service_id: e.target.value })} placeholder="Service ID" className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-purple-500 text-slate-900 dark:text-slate-100" />
              <input type="password" value={editData.password} onChange={(e) => setEditData({ ...editData, password: e.target.value })} placeholder="Password (Optional)" className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-purple-500 text-slate-900 dark:text-slate-100" />
              <div className="flex gap-2 justify-end mt-2">
                <button onClick={handleCancel} className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium transition-colors">Cancel</button>
                <button onClick={handleSave} className="px-3 py-1.5 bg-purple-600 text-white hover:bg-purple-700 rounded font-medium transition-colors shadow-sm">Save</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1 group">
                <span className="text-[11px] font-medium leading-tight text-slate-500">Service ID</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-700 dark:text-slate-300 break-all">{data.service_id || '—'}</span>
                  {!!data.service_id && <CopyFieldButton value={data.service_id} />}
                </div>
              </div>

              {('password_encrypted' in data && data.password_encrypted) && (
                <div className="mt-1">
                  <span className="text-[11px] font-medium leading-tight text-slate-500 mb-1 block">Password</span>
                  <PasswordField nodeType="account" nodeId={data.id} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountNode;
