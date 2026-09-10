import React, { useState, useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCanvasStore } from '../../stores/canvasStore';
import { formatErrorMessage } from '../../api/canvas';
import { useFocusTrap } from '../../hooks/useFocusTrap';

import type { CanvasSummary } from '../../api/canvas';

interface CreateCanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (canvas: CanvasSummary) => void;
}

export const CreateCanvasModal: React.FC<CreateCanvasModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const shouldRestoreFocusRef = useRef(true);

  const { createCanvas } = useCanvasStore();

  useFocusTrap(
    modalRef,
    isOpen,
    onClose,
    nameInputRef,
    () => shouldRestoreFocusRef.current
  );

  useEffect(() => {
    if (isOpen) {
      setName('');
      setPassword('');
      setConfirmPassword('');
      setLocalError(null);
      shouldRestoreFocusRef.current = true;
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setLocalError('Canvas name is required');
      return;
    }

    if (!password) {
      setLocalError('Canvas password is required');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createCanvas(trimmedName, password);
      shouldRestoreFocusRef.current = false;
      onCreated?.(created);
      onClose();
    } catch (err: any) {
      setLocalError(formatErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 selection:bg-[#DE6B80]/20 selection:text-[#DE6B80]">
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
            className="relative z-10 w-full max-w-md bg-white dark:bg-[#0E131F] border-2 border-slate-900 dark:border-slate-700 rounded-2xl shadow-[6px_6px_0_#DE6B80] dark:shadow-[6px_6px_0_#DE6B80] p-6 sm:p-8 flex flex-col gap-6 text-slate-900 dark:text-slate-100"
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
                <div className="w-8 h-8 rounded-lg bg-[#DE6B80]/15 border border-[#DE6B80]/30 flex items-center justify-center text-[#DE6B80] shrink-0">
                  <Plus className="w-4 h-4" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  New Canvas<span className="text-[#DE6B80]">.</span>
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Create an encrypted workspace protected by password
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
              {/* Canvas Name */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-mono tracking-wider uppercase text-slate-400 dark:text-slate-500">
                  Canvas Name
                </label>
                <div className="border-b-2 border-slate-200 dark:border-slate-800 focus-within:border-[#DE6B80] dark:focus-within:border-[#DE6B80] transition-colors pb-1">
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (localError) setLocalError(null);
                    }}
                    placeholder="e.g. Project Orion"
                    disabled={isSubmitting}
                    className="w-full bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-sm font-medium focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-mono tracking-wider uppercase text-slate-400 dark:text-slate-500">
                  Canvas Password
                </label>
                <div className="border-b-2 border-slate-200 dark:border-slate-800 focus-within:border-[#DE6B80] dark:focus-within:border-[#DE6B80] transition-colors pb-1">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (localError) setLocalError(null);
                    }}
                    placeholder="Password"
                    disabled={isSubmitting}
                    className="w-full bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-sm font-medium focus:outline-none tracking-wider"
                    required
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-mono tracking-wider uppercase text-slate-400 dark:text-slate-500">
                  Confirm Password
                </label>
                <div className="border-b-2 border-slate-200 dark:border-slate-800 focus-within:border-[#DE6B80] dark:focus-within:border-[#DE6B80] transition-colors pb-1">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (localError) setLocalError(null);
                    }}
                    placeholder="Repeat password"
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
                  disabled={isSubmitting || !name.trim() || !password || !confirmPassword}
                  className="px-5 py-2.5 rounded-lg bg-[#DE6B80] hover:bg-[#c9586d] active:scale-95 text-white text-xs font-bold tracking-wide shadow-sm transition-all duration-150 disabled:opacity-40 disabled:hover:bg-[#DE6B80] disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isSubmitting ? 'Creating…' : 'Create Canvas'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CreateCanvasModal;
