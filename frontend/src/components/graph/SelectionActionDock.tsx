import React, { useState, useEffect, useRef } from 'react';
import { Copy, Trash2, X, Check, Camera, Tag } from 'lucide-react';
import { useGraphStore } from '../../stores/graphStore';
import { useUIStore } from '../../stores/uiStore';
import clsx from 'clsx';

export const SelectionActionDock: React.FC<{
  selectedNodeIds: Set<string>;
  onClearSelection: () => void;
  onOpenExport?: () => void;
}> = ({ selectedNodeIds, onClearSelection, onOpenExport }) => {
  const { nodes: storeNodes, deleteNode, batchAddTag } = useGraphStore();
  const { isEditMode } = useUIStore();
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  useEffect(() => {
    if (isTagPopoverOpen && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [isTagPopoverOpen]);

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

  const handleAddTag = (tag: string) => {
    if (!isEditMode || !tag.trim()) return;
    batchAddTag(Array.from(selectedNodeIds), tag);
    setTagInput('');
    setIsTagPopoverOpen(false);
  };

  // Get all unique tags from the graph to show in quick-select
  const existingTags = Array.from(new Set(
    storeNodes.flatMap(n => n.data.tags || [])
  )).sort();

  return (
    <div 
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      {(isTagPopoverOpen && isEditMode) && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3 w-64 animate-in fade-in slide-in-from-bottom-2 mb-1">
          <div className="flex flex-col gap-2">
            <input
              ref={tagInputRef}
              type="text"
              placeholder="Type tag and press Enter..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag(tagInput);
                }
              }}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            {existingTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1 max-h-24 overflow-y-auto">
                {existingTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleAddTag(tag)}
                    className="px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => handleAddTag(tagInput)}
              disabled={!tagInput.trim()}
              className="mt-1 w-full flex items-center justify-center py-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Apply to {selectedNodeIds.size} node{selectedNodeIds.size > 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      <div className="transition-all duration-300 ease-out flex items-center shadow-lg bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-700 rounded-full py-1.5 px-2 gap-2 animate-in fade-in slide-in-from-bottom-4">
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

        {isEditMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsTagPopoverOpen(!isTagPopoverOpen);
            }}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors text-sm font-medium",
              isTagPopoverOpen 
                ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
            )}
            title="Add Tags"
          >
            <Tag className="w-4 h-4 text-indigo-500" />
            Tag
          </button>
        )}

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
            setIsTagPopoverOpen(false);
            onClearSelection();
          }}
          className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          title="Deselect"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default SelectionActionDock;
