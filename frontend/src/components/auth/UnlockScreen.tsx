import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { unlockAuth, setupAuth, checkStatus } from '../../api/auth';
import { Lock, Unlock } from 'lucide-react';

export const UnlockScreen = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);
  const [countdownSec, setCountdownSec] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setUnlocked, setSetup, isSetup, setAutoLock } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStatus()
      .then((status) => {
        setSetup(status.is_setup);
        setUnlocked(status.unlocked);
        if (status.auto_lock_minutes) {
          setAutoLock(status.auto_lock_minutes);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [setSetup, setUnlocked, setAutoLock]);

  // Live countdown timer for rate limiting
  useEffect(() => {
    if (!rateLimitedUntil) return;

    const updateCountdown = () => {
      const remainingMs = rateLimitedUntil - Date.now();
      if (remainingMs <= 0) {
        setRateLimitedUntil(null);
        setCountdownSec(0);
      } else {
        setCountdownSec(Math.ceil(remainingMs / 1000));
      }
    };

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [rateLimitedUntil]);

  const isRateLimited = rateLimitedUntil !== null && countdownSec > 0;
  const isDisabled = isRateLimited || isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRateLimited || isSubmitting) return;
    setIsSubmitting(true);
    setError('');

    try {
      if (!isSetup) {
        await setupAuth(password);
        setSetup(true);
      }
      await unlockAuth(password);
      setUnlocked(true);
    } catch (err: any) {
      let errorKey = '';
      let details: any = null;

      let rawMsg = typeof err === 'string' ? err : err?.message || '';
      try {
        const parsed = typeof err === 'object' && err !== null && 'error' in err ? err : JSON.parse(rawMsg);
        if (parsed && typeof parsed === 'object' && 'error' in parsed) {
          errorKey = parsed.error;
          details = parsed.details;
        }
      } catch {
        errorKey = rawMsg;
      }

      switch (errorKey) {
        case 'AlreadySetup':
          setSetup(true);
          setError('Vault is already set up. Please enter your master password.');
          break;
        case 'InvalidPassword':
          setError('Incorrect password');
          break;
        case 'RateLimited': {
          const ms = details?.wait_remaining_ms ?? 1000;
          const until = Date.now() + ms;
          setRateLimitedUntil(until);
          setCountdownSec(Math.ceil(ms / 1000));
          setError('');
          break;
        }
        case 'NotSetup':
          setError('Vault is not set up yet.');
          break;
        default:
          setError(
            typeof details === 'string'
              ? details
              : typeof err === 'string'
              ? err
              : err?.message || 'Failed to unlock'
          );
          break;
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return null;

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-sm w-full"
      >
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-[#4F46E5]/10 rounded-full">
            {isSetup ? (
              <Lock className="w-8 h-8 text-[#4F46E5]" />
            ) : (
              <Unlock className="w-8 h-8 text-[#4F46E5]" />
            )}
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-slate-900 dark:text-white">
          {isSetup ? 'Unlock Lattice' : 'Setup Master Password'}
        </h1>
        {isRateLimited ? (
          <p className="text-amber-500 dark:text-amber-400 text-sm text-center font-medium animate-pulse">
            Try again in {countdownSec}s
          </p>
        ) : error ? (
          <p className="text-red-500 text-sm text-center">{error}</p>
        ) : null}
        <div className="flex flex-col gap-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Master Password"
            disabled={isDisabled}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4F46E5] text-slate-900 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isDisabled}
          className="mt-2 w-full py-2 bg-[#4F46E5] hover:bg-[#4338ca] text-white rounded-md font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#4F46E5]"
        >
          {isSubmitting
            ? 'Decrypting…'
            : isRateLimited
            ? `Wait ${countdownSec}s`
            : isSetup
            ? 'Unlock'
            : 'Initialize'}
        </button>
      </form>
    </div>
  );
};

export default UnlockScreen;
