import React from 'react';
import { Edge, GraphNode } from '../../types/graph';
import { useGraphStore } from '../../stores/graphStore';
import { useUIStore } from '../../stores/uiStore';
import { Edit2, Trash2 } from 'lucide-react';

interface EdgeEditorProps {
  edges: Edge[];
  onEdit: (edge: Edge) => void;
  onDelete: (edge: Edge) => void;
}

const getNodeLabel = (node: GraphNode) => {
  const d = node.data as any;
  const label = d.address || d.username || d.name || d.number || d.id;
  const capitalizedType = node.type.charAt(0).toUpperCase() + node.type.slice(1);
  return `[${capitalizedType}] ${label}`;
};

export const EdgeEditor: React.FC<EdgeEditorProps> = ({ edges, onEdit, onDelete }) => {
  const { nodes } = useGraphStore();
  const { isEditMode } = useUIStore();

  return (
    <div className="flex flex-col gap-2 mt-4">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">Manage Edges</h3>
      {edges.map(e => {
        const sourceNode = nodes.find(n => n.data.id === e.source_id);
        const targetNode = nodes.find(n => n.data.id === e.target_id);
        
        const sourceLabel = sourceNode ? getNodeLabel(sourceNode) : e.source_type;
        const targetLabel = targetNode ? getNodeLabel(targetNode) : e.target_type;

        return (
          <div key={e.id} className="flex items-center justify-between text-xs p-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
            <div className="flex-1 min-w-0 pr-2">
              <span className="font-semibold">{e.relation}</span>
              <div className="text-slate-500 truncate" title={`${sourceLabel} → ${targetLabel}`}>
                {sourceLabel} &rarr; {targetLabel}
              </div>
            </div>
            {isEditMode && (
              <div className="flex gap-2">
                <button onClick={() => onEdit(e)} className="text-slate-400 hover:text-blue-500">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onDelete(e)} className="text-slate-400 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )
      })}
      {edges.length === 0 && <p className="text-xs text-slate-500">No edges to manage.</p>}
    </div>
  );
};

export default EdgeEditor;
