import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface Props {
  value: string;
}

export const CopyFieldButton: React.FC<Props> = ({ value }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  
  return (
    <button 
      onClick={handleCopy} 
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 focus:outline-none" 
      title="Copy value"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

export default CopyFieldButton;
