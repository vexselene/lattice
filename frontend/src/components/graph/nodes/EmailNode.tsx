import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { EmailNode as EmailNodeType } from '../../../types/graph';
import { Mail, Edit2, PanelRight, Trash2 } from 'lucide-react';
import { useGraphStore } from '../../../stores/graphStore';
import { useUIStore } from '../../../stores/uiStore';
import PasswordField from '../../sidebar/PasswordField';
import clsx from 'clsx';

export const EmailNode: React.FC<{ data: EmailNodeType; id: string }> = ({ data, id: _id }) => {
  const [isExpanded, setIsExpanded] = useState((data as any).isExpanded || false);
  const [isEditing, setIsEditing] = useState((data as any).isEditing || false);
  const [editData, setEditData] = useState({
    address: data.address || '',
    provider: data.provider || '',
    password: ''
  });

  const { removeTempNode, deleteNode, setSelectedNode, collapseAllSignal } = useGraphStore();
  const { isEditMode: globalEditMode } = useUIStore();

  // Chain dimming is now passed as prop via GraphCanvas
  const isDimmed = (data as any).isDimmed === true;

  // Collapse when pane is clicked
  const prevCollapseSignal = useRef(collapseAllSignal);
  useEffect(() => {
    if (collapseAllSignal !== prevCollapseSignal.current) {
      prevCollapseSignal.current = collapseAllSignal;
      if (!isEditing) setIsExpanded(false);
    }
  }, [collapseAllSignal, isEditing]);

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setIsExpanded(true);
  };

  const handleOpenSidebar = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Synthesise a GraphNode-shaped object matching what the store expects
    setSelectedNode({ type: 'email', data } as any);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if ((data as any).isEditing) {
      removeTempNode(data.id);
    } else {
      deleteNode('email', data.id);
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const isNew = (data as any).isEditing;
      const { createNode, updateNode } = await import('../../../api/nodes');

      if (isNew) {
        const res = await createNode('email', {
          address: editData.address,
          provider: editData.provider || undefined,
          password_raw: editData.password || undefined
        });
        const savedPositions = JSON.parse(localStorage.getItem('node_positions') || '{}');
        if (savedPositions[data.id]) {
          savedPositions[res.id] = savedPositions[data.id];
          delete savedPositions[data.id];
          localStorage.setItem('node_positions', JSON.stringify(savedPositions));
        }
        removeTempNode(data.id);
      } else {
        await updateNode('email', data.id, {
          address: editData.address,
          provider: editData.provider || undefined,
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
      setEditData({ address: data.address || '', provider: data.provider || '', password: '' });
    }
  };

  return (
    <div
      className={clsx(
        'relative flex flex-col transition-all duration-300 ease-out w-max max-w-[320px]',
        isDimmed ? 'opacity-25 blur-[2.5px] grayscale-[60%] pointer-events-none' : 'opacity-100 blur-0 grayscale-0'
      )}
      onDoubleClick={(e) => { e.stopPropagation(); if (!isEditing) setIsExpanded((prev: boolean) => !prev); }}
    >
      {/* Pill row — handles are anchored HERE so they never shift */}
      <div className="relative rounded-full py-1.5 px-3 border shadow-sm flex items-center gap-2 bg-indigo-50/80 border-indigo-200/80 text-indigo-950 dark:bg-indigo-950/30 dark:border-indigo-500/30 dark:text-indigo-200 shadow-indigo-100/50 dark:shadow-indigo-950/40 backdrop-blur-md cursor-pointer drop-shadow-md">
        {/* Handles inside the pill — they use absolute centering by React Flow */}
        <Handle type="target" position={Position.Left} id="target-left" className="w-2.5 h-2.5 !bg-slate-400" />
        <Handle type="source" position={Position.Right} id="source-right" className="w-2.5 h-2.5 !bg-slate-400" />

        <div className="p-1 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300 flex-shrink-0">
          <Mail className="w-3.5 h-3.5" />
        </div>
        <span className="text-sm font-medium tracking-tight truncate max-w-[150px]">
          {isEditing ? (editData.address || 'New Email') : (data.address || 'New Email')}
        </span>
      </div>

      {/* Accordion tray — slides down, does NOT affect handle position */}
      <div
        className={clsx(
          'absolute top-full left-1/2 -translate-x-1/2 overflow-hidden transition-all duration-300 ease-out z-10',
          isExpanded ? 'max-h-[400px] opacity-100 mt-1.5' : 'max-h-0 opacity-0 mt-0'
        )}
      >
        <div
          className="rounded-2xl p-3 border backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-slate-200/80 dark:border-slate-700/80 shadow-lg text-xs flex flex-col gap-2 cursor-default w-72"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-indigo-100/80 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-widest">
              Email
            </span>
            <div className="flex items-center gap-1">
              {(!isEditing && globalEditMode) && (
                <button onClick={handleEdit} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors" title="Edit Node">
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
              <input value={editData.address} onChange={(e) => setEditData({ ...editData, address: e.target.value })} placeholder="Email Address" className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-indigo-500 text-slate-900 dark:text-slate-100" />
              <input value={editData.provider} onChange={(e) => setEditData({ ...editData, provider: e.target.value })} placeholder="Provider" className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-indigo-500 text-slate-900 dark:text-slate-100" />
              <input type="password" value={editData.password} onChange={(e) => setEditData({ ...editData, password: e.target.value })} placeholder="Password (Optional)" className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-indigo-500 text-slate-900 dark:text-slate-100" />
              <div className="flex gap-2 justify-end mt-2">
                <button onClick={handleCancel} className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium transition-colors">Cancel</button>
                <button onClick={handleSave} className="px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded font-medium transition-colors shadow-sm">Save</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-slate-500 font-medium">Provider</span>
                <span className="text-slate-700 dark:text-slate-300">{data.provider || '—'}</span>
              </div>

              {('password_encrypted' in data && data.password_encrypted) && (
                <div className="mt-1">
                  <span className="text-slate-500 font-medium mb-1 block">Password</span>
                  <PasswordField nodeType="email" nodeId={data.id} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailNode;
