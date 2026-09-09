import React, { useState, useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';
import { useCanvasStore } from '../../stores/canvasStore';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { CanvasSummary } from '../../api/canvas';

interface CanvasUnlockModalProps {
  canvas: CanvasSummary | null;
  isOpen?: boolean;
  onClose: () => void;
  containerRef?: React.RefObject<HTMLElement | null>;
  onSubmittingChange?: (submitting: boolean) => void;
}

export const CanvasUnlockModal: React.FC<CanvasUnlockModalProps> = ({
  canvas,
  isOpen = true,
  onClose,
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
    }
  }, [isOpen, canvas, setError, onSubmittingChange]);

  if (!isOpen || !canvas) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || isSubmitting) return;

    setIsSubmitting(true);
    onSubmittingChange?.(true);
    try {
      await openCanvas(canvas.id, password);
    } finally {
      setIsSubmitting(false);
      onSubmittingChange?.(false);
    }
  };

  return (
    <div ref={fallbackRef} className="flex flex-col gap-4 w-full">
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
            readOnly={isSubmitting}
            autoFocus
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
            disabled={!password}
            aria-busy={isSubmitting}
            className={`flex-1 py-2 px-4 bg-[#4F46E5] hover:bg-[#4338ca] text-white rounded-md font-medium text-sm transition-colors ${
              isSubmitting
                ? 'opacity-75 cursor-wait'
                : !password
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            {isSubmitting ? 'Decrypting…' : 'Unlock'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CanvasUnlockModal;
