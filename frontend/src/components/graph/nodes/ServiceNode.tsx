import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { ServiceNode as ServiceNodeType } from '../../../types/graph';
import { Server } from 'lucide-react';

export const ServiceNode: React.FC<{ data: ServiceNodeType }> = ({ data }) => {
  return (
    <div className="rounded-md border-2 border-[#059669] bg-white dark:bg-slate-900 shadow-sm min-w-[150px] p-3 text-slate-900 dark:text-slate-100 transition-colors">
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-[#059669]" />
      <div className="flex items-center gap-2 mb-2">
        <Server className="w-4 h-4 text-[#059669]" />
        <span className="font-semibold text-sm">Service</span>
      </div>
      <div className="text-xs text-slate-600 dark:text-slate-400 break-all">
        {data.name}
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-[#059669]" />
    </div>
  );
};

export default ServiceNode;
