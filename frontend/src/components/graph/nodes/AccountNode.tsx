import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { AccountNode as AccountNodeType } from '../../../types/graph';
import { User } from 'lucide-react';

export const AccountNode: React.FC<{ data: AccountNodeType }> = ({ data }) => {
  return (
    <div className="rounded-md border-2 border-[#7C3AED] bg-white dark:bg-slate-900 shadow-sm min-w-[150px] p-3 text-slate-900 dark:text-slate-100 transition-colors">
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-[#7C3AED]" />
      <div className="flex items-center gap-2 mb-2">
        <User className="w-4 h-4 text-[#7C3AED]" />
        <span className="font-semibold text-sm">Account</span>
      </div>
      <div className="text-xs text-slate-600 dark:text-slate-400 break-all">
        {data.username}
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-[#7C3AED]" />
    </div>
  );
};

export default AccountNode;
