import React, { useState, useEffect } from 'react';
import { Copy, Trash2, X, Check, Camera } from 'lucide-react';
import { useGraphStore } from '../../stores/graphStore';
import { useUIStore } from '../../stores/uiStore';
import clsx from 'clsx';

export const SelectionActionDock: React.FC<{
  selectedNodeIds: Set<string>;
  onClearSelection: () => void;
  onOpenExport?: () => void;
}> = ({ selectedNodeIds, onClearSelection, onOpenExport }) => {
  const { nodes: storeNodes, deleteNode } = useGraphStore();
  const { isEditMode } = useUIStore();
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  if (selectedNodeIds.size < 1) return null;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const selectedNodes = storeNodes.filter(n => selectedNodeIds.has(n.data.id as string));
    const lines = selectedNodes.map(n => {
      const d = n.data as any;
      return d.address || d.username || d.name || d.number || n.data.id;
    });
    
    navigator.clipboard.writeText(lines.join('\n'))
      .then(() => setCopied(true))
      .catch(err => console.error('Failed to copy', err));
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditMode) return;
    
    setIsDeleting(true);
    const selectedNodes = storeNodes.filter(n => selectedNodeIds.has(n.data.id as string));
    
    try {
      // For safety, sequentially delete to avoid race conditions
      for (const node of selectedNodes) {
        await deleteNode(node.type as string, node.data.id as string);
      }
      onClearSelection();
    } catch (err) {
      console.error('Failed to delete nodes', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div 
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 transition-all duration-300 ease-out flex items-center shadow-lg bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-700 rounded-full py-1.5 px-2 gap-2 animate-in fade-in slide-in-from-bottom-4"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <div className="pl-3 pr-2 py-1 text-sm font-semibold text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 select-none">
        {selectedNodeIds.size} {selectedNodeIds.size === 1 ? 'node' : 'nodes'} selected
      </div>
      
      <button 
        onClick={handleCopy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200 text-sm font-medium"
        title="Copy Values"
      >
        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-indigo-500" />}
        {copied ? 'Copied!' : 'Copy'}
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpenExport?.();
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200 text-sm font-medium"
        title="Export Selected to Image"
      >
        <Camera className="w-4 h-4 text-teal-500" />
        Export
      </button>

      {isEditMode && (
        <button 
          onClick={handleDelete}
          disabled={isDeleting}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-red-600 dark:text-red-400 text-sm font-medium",
            isDeleting && "opacity-50 cursor-not-allowed"
          )}
          title="Delete Nodes"
        >
          <Trash2 className="w-4 h-4" />
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      )}

      <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

      <button 
        onClick={(e) => {
          e.stopPropagation();
          onClearSelection();
        }}
        className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        title="Deselect"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};

export default SelectionActionDock;
