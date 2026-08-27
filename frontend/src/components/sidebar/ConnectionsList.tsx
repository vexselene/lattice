import React from 'react';
import { Edge } from '../../types/graph';

export const ConnectionsList: React.FC<{ edges: Edge[]; nodeId: string }> = ({ edges, nodeId }) => {
  return (
    <div className="flex flex-col gap-2 mt-2">
      {edges.map(e => {
        const isSource = e.source_id === nodeId;
        return (
          <div key={e.id} className="text-xs p-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
            <span className="font-semibold text-slate-600 dark:text-slate-400">
              {isSource ? 'To ' : 'From '} {isSource ? e.target_type : e.source_type}
            </span>
            <div className="text-slate-800 dark:text-slate-200 mt-1">{e.relation}</div>
            {e.notes && <div className="text-slate-500 mt-1 italic">{e.notes}</div>}
          </div>
        );
      })}
      {edges.length === 0 && <p className="text-xs text-slate-500">No connections.</p>}
    </div>
  );
};

export default ConnectionsList;
