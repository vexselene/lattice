import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCanvasStore } from '../../stores/canvasStore';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { CanvasSummary } from '../../api/canvas';
import SpeederLoader from '../auth/SpeederLoader';

interface CanvasUnlockModalProps {
  canvas: CanvasSummary | null;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  containerRef?: React.RefObject<HTMLElement | null>;
  onSubmittingChange?: (submitting: boolean) => void;
}

export const CanvasUnlockModal: React.FC<CanvasUnlockModalProps> = ({
  canvas,
  isOpen = true,
  onClose,
  onSuccess,
  containerRef,
  onSubmittingChange,
}) => {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);

  const { openCanvas, error, setError } = useCanvasStore();

  const handleCancel = () => {
    if (isSubmitting) return;
    setError(null);
    onClose();
  };

  const trapRef = containerRef || fallbackRef;
  useFocusTrap(trapRef, isOpen, handleCancel, passwordInputRef);

  useEffect(() => {
    if (isOpen && canvas) {
      setPassword('');
      setError(null);
      setIsSubmitting(false);
      onSubmittingChange?.(false);
      requestAnimationFrame(() => {
        passwordInputRef.current?.focus();
      });
    }
  }, [isOpen, canvas, setError, onSubmittingChange]);

  // Refocus input when returning from failed submission
  useEffect(() => {
    if (!isSubmitting) {
      requestAnimationFrame(() => {
        passwordInputRef.current?.focus();
      });
    }
  }, [isSubmitting]);

  if (!isOpen || !canvas) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || isSubmitting) return;

    setIsSubmitting(true);
    onSubmittingChange?.(true);

    const startTime = Date.now();
    try {
      await openCanvas(canvas.id, password);

      // Maintain a smooth minimum beat for the speeder loader (500ms)
      const elapsed = Date.now() - startTime;
      if (elapsed < 500) {
        await new Promise((r) => setTimeout(r, 500 - elapsed));
      }

      if (!useCanvasStore.getState().error) {
        onSuccess?.();
      } else {
        setPassword('');
        setIsSubmitting(false);
        onSubmittingChange?.(false);
      }
    } catch {
      setPassword('');
      setIsSubmitting(false);
      onSubmittingChange?.(false);
    }
  };

  return (
    <div ref={fallbackRef} className="w-full flex flex-col items-center justify-center">
      <AnimatePresence mode="wait">
        {isSubmitting ? (
          <motion.div
            key="speeder-loader-view"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="flex flex-col items-center justify-center py-6"
          >
            <SpeederLoader />
            <p className="text-xs font-mono font-medium text-slate-400 dark:text-slate-500 mt-4 tracking-widest uppercase animate-pulse">
              Decrypting canvas…
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="unlock-form-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full flex flex-col items-center"
          >
            {/* Minimal Canvas Title Branding */}
            <div className="flex flex-col items-center text-center mb-8 select-none max-w-full">
              <h2
                className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white truncate max-w-full px-2"
                title={canvas.name}
              >
                {canvas.name}<span className="text-[#DE6B80]">.</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium tracking-wide">
                Enter canvas password to unlock
              </p>
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
                  ref={passwordInputRef}
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Canvas password"
                  disabled={isSubmitting}
                  autoFocus
                  className="w-full bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-base font-medium focus:outline-none pr-3 disabled:opacity-50 tracking-wider"
                  required
                />

                <button
                  type="submit"
                  disabled={!password || isSubmitting}
                  className="p-1 text-slate-400 hover:text-[#DE6B80] dark:hover:text-[#DE6B80] focus:text-[#DE6B80] disabled:opacity-20 disabled:hover:text-slate-400 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed group"
                  title="Unlock canvas"
                  aria-label="Unlock canvas"
                >
                  <ArrowRight
                    className={`w-5 h-5 transition-all duration-200 ${
                      password ? 'text-[#DE6B80] group-hover:translate-x-1' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Aesthetic Error Area */}
              <div className="h-8 flex items-center justify-center mt-3 text-center">
                <AnimatePresence>
                  {error && (
                    <motion.span
                      key="error"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-xs font-medium text-[#E05D55] dark:text-[#f27e89]"
                    >
                      {error}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CanvasUnlockModal;
