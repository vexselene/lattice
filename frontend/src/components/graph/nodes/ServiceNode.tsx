import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ServiceNode as ServiceNodeType } from '../../../types/graph';
import { Server, Edit2 } from 'lucide-react';
import { useGraphStore } from '../../../stores/graphStore';
import clsx from 'clsx';

export const ServiceNode: React.FC<{ data: ServiceNodeType; id: string }> = ({ data, id }) => {
  const [isExpanded, setIsExpanded] = useState((data as any).isExpanded || false);
  const [isEditing, setIsEditing] = useState((data as any).isEditing || false);
  const [editData, setEditData] = useState({ 
    name: data.name || '', 
    category: data.category || '', 
    url: data.url || '' 
  });
  
  const { activeChain, removeTempNode } = useGraphStore();

  const isActive = isEditing || (activeChain ? activeChain.nodeIds.has(id) : true);
  
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setIsExpanded(true);
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

  return (
    <div 
      className={clsx(
        "relative flex flex-col transition-all duration-300 ease-out",
        !isActive ? "opacity-25 blur-[2.5px] grayscale-[60%] pointer-events-none" : "opacity-100 blur-0 grayscale-0 drop-shadow-md",
        isExpanded && "-translate-y-1 shadow-md"
      )}
      onDoubleClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
    >
      <Handle type="target" position={Position.Left} id="target-left" className="w-2.5 h-2.5 !bg-slate-400" />
      <Handle type="source" position={Position.Right} id="source-right" className="w-2.5 h-2.5 !bg-slate-400" />

      <div className="rounded-full py-1.5 px-3 border shadow-sm flex items-center gap-2 bg-emerald-50/80 border-emerald-200/80 text-emerald-950 dark:bg-emerald-950/30 dark:border-emerald-500/30 dark:text-emerald-200 shadow-emerald-100/50 dark:shadow-emerald-950/40 backdrop-blur-md cursor-pointer">
        <div className="p-1 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300 flex-shrink-0">
          <Server className="w-3.5 h-3.5" />
        </div>
        <span className="text-sm font-medium tracking-tight truncate max-w-[150px]">
          {isEditing ? (editData.name || 'New Service') : (data.name || 'New Service')}
        </span>
      </div>

      {isExpanded && (
        <div className="rounded-2xl p-3 border mt-1.5 backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-slate-200/80 dark:border-slate-700/80 shadow-lg text-xs flex flex-col gap-2 cursor-default" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-widest">
              Service
            </span>
            {!isEditing && (
              <button onClick={handleEdit} className="p-1 text-slate-400 hover:text-emerald-600 transition-colors" title="Edit Node">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          
          {isEditing ? (
            <div className="flex flex-col gap-2 w-48 mt-1">
              <input value={editData.name} onChange={(e) => setEditData({...editData, name: e.target.value})} placeholder="Service Name" className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-emerald-500 text-slate-900 dark:text-slate-100" />
              <input value={editData.category} onChange={(e) => setEditData({...editData, category: e.target.value})} placeholder="Category" className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-emerald-500 text-slate-900 dark:text-slate-100" />
              <input value={editData.url} onChange={(e) => setEditData({...editData, url: e.target.value})} placeholder="URL" className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-emerald-500 text-slate-900 dark:text-slate-100" />
              <div className="flex gap-2 justify-end mt-2">
                <button onClick={handleCancel} className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium transition-colors">Cancel</button>
                <button onClick={handleSave} className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded font-medium transition-colors shadow-sm">Save</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-slate-500 font-medium">Category</span>
                <span className="text-slate-700 dark:text-slate-300">{data.category || '—'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-500 font-medium">URL</span>
                <span className="text-slate-700 dark:text-slate-300">{data.url || '—'}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ServiceNode;
