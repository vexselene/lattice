import React, { useState, useEffect, useRef } from 'react';
import { Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCanvasStore } from '../../stores/canvasStore';
import { formatErrorMessage } from '../../api/canvas';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { CanvasSummary } from '../../api/canvas';

interface DeleteCanvasModalProps {
  canvas: CanvasSummary | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DeleteCanvasModal: React.FC<DeleteCanvasModalProps> = ({
  canvas,
  isOpen,
  onClose,
}) => {
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const { deleteCanvas } = useCanvasStore();

  useFocusTrap(modalRef, isOpen && canvas !== null, onClose, passwordInputRef);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setLocalError(null);
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!canvas) return;

    if (!password) {
      setLocalError('Password is required to delete this canvas');
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteCanvas(canvas.id, password);
      onClose();
    } catch (err: any) {
      setLocalError(formatErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && canvas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 selection:bg-[#E05D55]/20 selection:text-[#E05D55]">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Neubrutalist Dialog Container */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-md bg-white dark:bg-[#0E131F] border-2 border-slate-900 dark:border-slate-700 rounded-2xl shadow-[6px_6px_0_#E05D55] dark:shadow-[6px_6px_0_#E05D55] p-6 sm:p-8 flex flex-col gap-6 text-slate-900 dark:text-slate-100"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Close"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex flex-col select-none pr-8">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-8 h-8 rounded-lg bg-[#E05D55]/15 border border-[#E05D55]/30 flex items-center justify-center text-[#E05D55] shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Delete Canvas<span className="text-[#E05D55]">.</span>
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                Permanently delete &ldquo;{canvas.name}&rdquo;? This cannot be undone.
              </p>
            </div>

            {/* Error Message */}
            <AnimatePresence>
              {localError && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="text-xs font-medium text-[#E05D55] dark:text-[#f27e89] bg-[#E05D55]/10 border border-[#E05D55]/20 py-2 px-3 rounded-lg text-center"
                >
                  {localError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Confirm Password */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-mono tracking-wider uppercase text-slate-400 dark:text-slate-500">
                  Confirm Password
                </label>
                <div className="border-b-2 border-slate-200 dark:border-slate-800 focus-within:border-[#E05D55] dark:focus-within:border-[#E05D55] transition-colors pb-1">
                  <input
                    ref={passwordInputRef}
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (localError) setLocalError(null);
                    }}
                    placeholder="Enter canvas password to confirm"
                    disabled={isSubmitting}
                    className="w-full bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-sm font-medium focus:outline-none tracking-wider"
                    required
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !password}
                  className="px-5 py-2.5 rounded-lg bg-[#E05D55] hover:bg-[#c94e47] active:scale-95 text-white text-xs font-bold tracking-wide shadow-sm transition-all duration-150 disabled:opacity-40 disabled:hover:bg-[#E05D55] disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isSubmitting ? 'Deleting…' : 'Delete Canvas'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default DeleteCanvasModal;
