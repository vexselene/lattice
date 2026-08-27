import React, { useState } from 'react';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';
import { getNodePassword } from '../../api/nodes';
import { NodeType } from '../../types/graph';

interface PasswordFieldProps {
  nodeType: NodeType;
  nodeId: string;
}

export const PasswordField: React.FC<PasswordFieldProps> = ({ nodeType, nodeId }) => {
  const [password, setPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchPassword = async () => {
    if (password) {
      setVisible(!visible);
      return;
    }
    setLoading(true);
    try {
      const res = await getNodePassword(nodeType, nodeId);
      setPassword(res.password || '');
      setVisible(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 relative">
        <input
          type={visible ? "text" : "password"}
          value={password !== null ? password : '••••••••••••'}
          readOnly
          className="w-full pl-3 pr-10 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
        />
        <button
          onClick={fetchPassword}
          disabled={loading}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          type="button"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {password !== null && (
        <button
          onClick={handleCopy}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"
          type="button"
        >
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
};

export default PasswordField;
