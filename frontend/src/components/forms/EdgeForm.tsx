import React, { useState, useEffect } from 'react';
import { Edge, GraphNode } from '../../types/graph';
import { createEdge, updateEdge } from '../../api/edges';
import { useGraphStore } from '../../stores/graphStore';
import { X } from 'lucide-react';

interface EdgeFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialEdge?: Edge | null;
}

const getNodeLabel = (node: GraphNode) => {
  const d = node.data as any;
  const label = d.address || d.username || d.name || d.number || d.id;
  const capitalizedType = node.type.charAt(0).toUpperCase() + node.type.slice(1);
  return `[${capitalizedType}] ${label}`;
};

export const EdgeForm: React.FC<EdgeFormProps> = ({ isOpen, onClose, initialEdge }) => {
  const { fetchGraph, nodes } = useGraphStore();
  const [formData, setFormData] = useState<any>({});
  
  useEffect(() => {
    if (initialEdge) {
      setFormData(initialEdge);
    } else {
      if (nodes.length >= 2) {
        setFormData({
          source_id: nodes[0].data.id,
          source_type: nodes[0].type,
          target_id: nodes[1].data.id,
          target_type: nodes[1].type,
          relation: 'registered_with'
        });
      } else if (nodes.length === 1) {
        setFormData({
          source_id: nodes[0].data.id,
          source_type: nodes[0].type,
          target_id: nodes[0].data.id,
          target_type: nodes[0].type,
          relation: 'registered_with'
        });
      } else {
        setFormData({
          relation: 'registered_with'
        });
      }
    }
  }, [initialEdge, isOpen, nodes]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNodeChange = (e: React.ChangeEvent<HTMLSelectElement>, isSource: boolean) => {
    const selectedId = e.target.value;
    const selectedNode = nodes.find(n => n.data.id === selectedId);
    if (selectedNode) {
      if (isSource) {
        setFormData({ ...formData, source_id: selectedId, source_type: selectedNode.type });
      } else {
        setFormData({ ...formData, target_id: selectedId, target_type: selectedNode.type });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (initialEdge) {
        await updateEdge(initialEdge.id, { relation: formData.relation, notes: formData.notes });
      } else {
        await createEdge(formData);
      }
      await fetchGraph();
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-w-md w-full overflow-hidden flex flex-col max-h-full">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {initialEdge ? 'Edit Connection' : 'Create Connection'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex flex-col gap-4">
          {!initialEdge && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Source</span>
                <select value={formData.source_id || ''} onChange={(e) => handleNodeChange(e, true)} required className="p-2 bg-slate-50 dark:bg-slate-800 border rounded text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700">
                  <option value="" disabled>Select a node</option>
                  {nodes.map(n => (
                    <option key={n.data.id} value={n.data.id}>{getNodeLabel(n)}</option>
                  ))}
                </select>
              </label>
              
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Target</span>
                <select value={formData.target_id || ''} onChange={(e) => handleNodeChange(e, false)} required className="p-2 bg-slate-50 dark:bg-slate-800 border rounded text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700">
                  <option value="" disabled>Select a node</option>
                  {nodes.map(n => (
                    <option key={n.data.id} value={n.data.id}>{getNodeLabel(n)}</option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Relation</span>
            <select name="relation" value={formData.relation || ''} onChange={handleChange} className="p-2 bg-slate-50 dark:bg-slate-800 border rounded text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700">
              <option value="registered_with">Registered With</option>
              <option value="recovery_for">Recovery For</option>
              <option value="uses_username">Uses Username</option>
              <option value="linked_account">Linked Account</option>
            </select>
          </label>

          <textarea name="notes" value={formData.notes || ''} onChange={handleChange} placeholder="Notes" className="p-2 border rounded bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white min-h-[80px]" />

          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm bg-[#4F46E5] text-white rounded hover:bg-[#4338ca]">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EdgeForm;
