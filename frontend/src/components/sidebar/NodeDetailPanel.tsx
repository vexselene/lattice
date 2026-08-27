import React from 'react';
import { useGraphStore } from '../../stores/graphStore';
import { X, Trash2, Plus } from 'lucide-react';
import PasswordField from './PasswordField';
import ConnectionsList from './ConnectionsList';
import EdgeEditor from './EdgeEditor';
import { Edge } from '../../types/graph';

interface NodeDetailPanelProps {
  onAddEdge: () => void;
  onEditEdge: (edge: Edge) => void;
  onDeleteEdge: (edge: Edge) => void;
  onDeleteNode: () => void;
}

export const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({ onAddEdge, onEditEdge, onDeleteEdge, onDeleteNode }) => {
  const { selectedNode, setSelectedNode, edges } = useGraphStore();

  if (!selectedNode) return null;

  const nodeEdges = edges.filter(e => e.source_id === selectedNode.data.id || e.target_id === selectedNode.data.id);
  const data: any = selectedNode.data;

  return (
    <div className="w-80 border-l border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-slate-900/80 backdrop-blur-md shadow-sm h-full flex flex-col shrink-0 overflow-y-auto z-20">
      <div className="flex items-center justify-between p-4 border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 bg-transparent z-10">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100 capitalize">{selectedNode.type} Node</h2>
        <div className="flex gap-2">
          <button onClick={onDeleteNode} className="text-slate-400 hover:text-red-500" title="Delete Node"><Trash2 className="w-4 h-4" /></button>
          <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Render node data dynamically based on keys (simplified) */}
        <div className="flex flex-col gap-2">
          {Object.entries(data).map(([k, v]) => {
            if (k === 'id' || k === 'password_encrypted' || k === 'created_at' || k === 'updated_at') return null;
            return (
              <div key={k} className="flex flex-col">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{k.replace('_', ' ')}</span>
                <span className="text-sm text-slate-900 dark:text-slate-100">{String(v || '—')}</span>
              </div>
            );
          })}
        </div>

        {('password_encrypted' in data) && (
          <div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Password</span>
            <PasswordField nodeType={selectedNode.type} nodeId={data.id} />
          </div>
        )}

        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Connections</h3>
            <button onClick={onAddEdge} className="p-1 rounded bg-[#4F46E5]/10 text-[#4F46E5] hover:bg-[#4F46E5]/20" title="Add Connection">
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <ConnectionsList edges={nodeEdges} nodeId={data.id} />
        </div>

        <EdgeEditor edges={nodeEdges} onEdit={onEditEdge} onDelete={onDeleteEdge} />
      </div>
    </div>
  );
};

export default NodeDetailPanel;
