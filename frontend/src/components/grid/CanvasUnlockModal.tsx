import React, { useState, useEffect, useRef } from 'react';
import { Lock, X } from 'lucide-react';
import { useCanvasStore } from '../../stores/canvasStore';
import type { CanvasSummary } from '../../api/canvas';

interface CanvasUnlockModalProps {
  canvas: CanvasSummary | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CanvasUnlockModal: React.FC<CanvasUnlockModalProps> = ({
  canvas,
  isOpen,
  onClose,
}) => {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const { openCanvas, error, setError } = useCanvasStore();

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(null);
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, canvas, setError]);

  if (!isOpen || !canvas) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await openCanvas(canvas.id, password);
      // Check if store state was updated to this canvas
      if (useCanvasStore.getState().activeCanvasId === canvas.id) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative flex flex-col gap-4 p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-sm w-full">
        {/* Close Button */}
        <button
          onClick={handleCancel}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors"
          title="Cancel"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Lock Icon */}
        <div className="flex justify-center mb-1">
          <div className="p-3.5 bg-[#4F46E5]/10 rounded-full">
            <Lock className="w-7 h-7 text-[#4F46E5]" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate" title={canvas.name}>
            {canvas.name}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Enter canvas password to unlock
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <p className="text-red-500 dark:text-red-400 text-xs text-center font-medium bg-red-50 dark:bg-red-950/40 py-2 px-3 rounded border border-red-200 dark:border-red-900">
            {error}
          </p>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-1">
          <div className="flex flex-col gap-1.5">
            <input
              ref={passwordInputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Canvas Password"
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4F46E5] text-slate-900 dark:text-slate-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              required
            />
          </div>

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="flex-1 py-2 px-4 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-md font-medium text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !password}
              className="flex-1 py-2 px-4 bg-[#4F46E5] hover:bg-[#4338ca] text-white rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#4F46E5]"
            >
              {isSubmitting ? 'Decrypting…' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CanvasUnlockModal;
