import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { unlockAuth, setupAuth, checkStatus } from '../../api/auth';
import { ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import VaultLoader from './VaultLoader';

export const UnlockScreen = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);
  const [countdownSec, setCountdownSec] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setUnlocked, setSetup, isSetup, setAutoLock } = useAuthStore();
  const [statusLoading, setStatusLoading] = useState(true);
  const [minBeatDone, setMinBeatDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Minimum aesthetic beat for initial loader
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinBeatDone(true);
    }, 850);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    checkStatus()
      .then((status) => {
        setSetup(status.is_setup);
        setUnlocked(status.unlocked);
        if (status.auto_lock_minutes) {
          setAutoLock(status.auto_lock_minutes);
        }
        setStatusLoading(false);
      })
      .catch(() => {
        setStatusLoading(false);
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
  const showLoader = statusLoading || !minBeatDone || isSubmitting;

  // Auto focus input when form becomes ready
  useEffect(() => {
    if (!showLoader) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [showLoader]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || isDisabled) return;
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

      const rawMsg = typeof err === 'string' ? err : err?.message || '';
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
          setError('Vault is already set up. Enter master password.');
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
      setPassword('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#FAF8F9] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 transition-colors selection:bg-[#DE6B80]/20 selection:text-[#DE6B80]">
      <AnimatePresence mode="wait">
        {showLoader ? (
          <motion.div
            key="vault-loader"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="flex flex-col items-center justify-center"
          >
            <VaultLoader />
          </motion.div>
        ) : (
          <motion.div
            key="vault-form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex flex-col items-center justify-center w-full max-w-sm px-6"
          >
            {/* Minimal Branding */}
            <div className="flex flex-col items-center text-center mb-8 select-none">
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Lattice<span className="text-[#DE6B80]">.</span>
              </h1>
              {!isSetup && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium tracking-wide">
                  Set up master password to initialize vault
                </p>
              )}
            </div>

            {/* Minimal Password Field with integrated Arrow Button */}
            <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
              <div
                className={`relative flex items-center w-full border-b-2 transition-colors duration-200 pb-2 ${
                  error
                    ? 'border-[#E05D55]'
                    : 'border-slate-300 dark:border-slate-700 focus-within:border-[#DE6B80] dark:focus-within:border-[#DE6B80]'
                }`}
              >
                <input
                  ref={inputRef}
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder={isSetup ? 'Master password' : 'Create master password'}
                  disabled={isDisabled}
                  autoFocus
                  className="w-full bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-base font-medium focus:outline-none pr-3 disabled:opacity-50 tracking-wider"
                  required
                />

                <button
                  type="submit"
                  disabled={!password || isDisabled}
                  className="p-1 text-slate-400 hover:text-[#DE6B80] dark:hover:text-[#DE6B80] focus:text-[#DE6B80] disabled:opacity-20 disabled:hover:text-slate-400 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed group"
                  title={isSetup ? 'Unlock vault' : 'Initialize vault'}
                  aria-label={isSetup ? 'Unlock vault' : 'Initialize vault'}
                >
                  <ArrowRight
                    className={`w-5 h-5 transition-all duration-200 ${
                      password ? 'text-[#DE6B80] group-hover:translate-x-1' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Aesthetic Error / Rate limit notification */}
              <div className="h-8 flex items-center justify-center mt-3 text-center">
                <AnimatePresence>
                  {isRateLimited ? (
                    <motion.span
                      key="rate-limit"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-xs font-mono font-medium text-amber-500 dark:text-amber-400"
                    >
                      Try again in {countdownSec}s
                    </motion.span>
                  ) : error ? (
                    <motion.span
                      key="error"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-xs font-medium text-[#E05D55] dark:text-[#f27e89]"
                    >
                      {error}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UnlockScreen;
