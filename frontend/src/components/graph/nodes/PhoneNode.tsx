import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { PhoneNode as PhoneNodeType } from '../../../types/graph';
import { Smartphone } from 'lucide-react';

export const PhoneNode: React.FC<{ data: PhoneNodeType }> = ({ data }) => {
  return (
    <div className="rounded-md border-2 border-[#EA580C] bg-white dark:bg-slate-900 shadow-sm min-w-[150px] p-3 text-slate-900 dark:text-slate-100 transition-colors">
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-[#EA580C]" />
      <div className="flex items-center gap-2 mb-2">
        <Smartphone className="w-4 h-4 text-[#EA580C]" />
        <span className="font-semibold text-sm">Phone</span>
      </div>
      <div className="text-xs text-slate-600 dark:text-slate-400 break-all">
        {data.number}
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-[#EA580C]" />
    </div>
  );
};

export default PhoneNode;
