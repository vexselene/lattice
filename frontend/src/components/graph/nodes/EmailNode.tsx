import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { EmailNode as EmailNodeType } from '../../../types/graph';
import { Mail } from 'lucide-react';

export const EmailNode: React.FC<{ data: EmailNodeType }> = ({ data }) => {
  return (
    <div className="rounded-md border-2 border-[#4F46E5] bg-white dark:bg-slate-900 shadow-sm min-w-[150px] p-3 text-slate-900 dark:text-slate-100 transition-colors">
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-[#4F46E5]" />
      <div className="flex items-center gap-2 mb-2">
        <Mail className="w-4 h-4 text-[#4F46E5]" />
        <span className="font-semibold text-sm">Email</span>
      </div>
      <div className="text-xs text-slate-600 dark:text-slate-400 break-all">
        {data.address}
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-[#4F46E5]" />
    </div>
  );
};

export default EmailNode;
