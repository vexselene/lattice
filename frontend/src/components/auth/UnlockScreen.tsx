import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { unlockAuth, setupAuth, checkStatus } from '../../api/auth';
import { Lock, Unlock } from 'lucide-react';

export const UnlockScreen = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { setUnlocked, setSetup, isSetup } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStatus().then(() => {
      // In a real flow, if it's not setup, we'd know from status or initial fetch.
      // Assuming our backend throws or returns setup status.
      // For simplicity, we just try to unlock.
      setLoading(false);
    }).catch(() => {
      setLoading(false);
      // Assume not setup if status fails, or handle it properly.
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (!isSetup) {
        // Try setup first if not setup
        await setupAuth(password);
        setSetup(true);
      }
      const res = await unlockAuth(password);
      if (res.session_token) {
        setUnlocked(true, res.session_token);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to unlock');
      if (err.response?.data?.detail === 'Already setup') {
        setSetup(true);
      }
    }
  };

  if (loading) return null;

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-sm w-full">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-[#4F46E5]/10 rounded-full">
            {isSetup ? <Lock className="w-8 h-8 text-[#4F46E5]" /> : <Unlock className="w-8 h-8 text-[#4F46E5]" />}
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-slate-900 dark:text-white">
          {isSetup ? 'Unlock Lattice' : 'Setup Master Password'}
        </h1>
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <div className="flex flex-col gap-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Master Password"
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4F46E5] text-slate-900 dark:text-slate-100"
            required
          />
        </div>
        <button
          type="submit"
          className="mt-2 w-full py-2 bg-[#4F46E5] hover:bg-[#4338ca] text-white rounded-md font-semibold transition-colors"
        >
          {isSetup ? 'Unlock' : 'Initialize'}
        </button>
      </form>
    </div>
  );
};

export default UnlockScreen;
