import React, { useState } from 'react';
import { KeyRound, Copy, Check } from 'lucide-react';
import { generatePassword } from '../../api/search';

export const PasswordGenerator: React.FC<{ onApply?: (pwd: string) => void }> = ({ onApply }) => {
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    try {
      const pwd = await generatePassword();
      setPassword(pwd);
      setCopied(false);
      if (onApply) onApply(pwd);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopy = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Generate Password</span>
        <button onClick={handleGenerate} className="flex items-center gap-1 text-xs text-[#4F46E5] hover:underline" type="button">
          <KeyRound className="w-3 h-3" />
          Generate
        </button>
      </div>
      {password && (
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 border border-slate-200 dark:border-slate-700 rounded text-sm font-mono text-slate-800 dark:text-slate-200">
          <span>{password}</span>
          <button onClick={handleCopy} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" type="button">
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  );
};

export default PasswordGenerator;
