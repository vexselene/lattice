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

  const handleToggleVisible = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (password !== null) {
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

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    let textToCopy = password;
    if (textToCopy === null) {
      setLoading(true);
      try {
        const res = await getNodePassword(nodeType, nodeId);
        textToCopy = res.password || '';
        setPassword(textToCopy);
      } catch (err) {
        console.error(err);
        return;
      } finally {
        setLoading(false);
      }
    }
    if (textToCopy !== null) {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative group/pwd mt-1">
      <input
        type={visible ? "text" : "password"}
        value={visible ? (password ?? '') : '••••••••••••'}
        readOnly
        className={`w-full pl-3 pr-16 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:outline-none ${
          visible ? 'select-all' : 'select-none'
        }`}
      />
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
        <button
          onClick={handleCopy}
          disabled={loading}
          className={`p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-opacity duration-150 ${
            (visible || copied) ? 'opacity-100' : 'opacity-0 group-hover/pwd:opacity-100'
          }`}
          title={copied ? "Copied!" : "Copy password"}
          type="button"
        >
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
        <button
          onClick={handleToggleVisible}
          disabled={loading}
          className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          title={visible ? "Hide password" : "Show password"}
          type="button"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

export default PasswordField;

