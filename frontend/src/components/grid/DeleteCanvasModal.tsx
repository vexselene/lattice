import React, { useState, useEffect, useRef } from 'react';
import { Trash2, X } from 'lucide-react';
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

  useFocusTrap(modalRef, isOpen, onClose, passwordInputRef);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setLocalError(null);
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen || !canvas) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

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
    <div ref={modalRef} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative flex flex-col gap-4 p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-sm w-full">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors"
          title="Cancel"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Destructive Red Icon */}
        <div className="flex justify-center mb-1">
          <div className="p-3.5 bg-red-100 dark:bg-red-950/50 rounded-full text-red-600 dark:text-red-400">
            <Trash2 className="w-7 h-7" />
          </div>
        </div>

        {/* Title & Warning */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Delete Canvas
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            Delete &ldquo;<span className="font-semibold text-slate-900 dark:text-white">{canvas.name}</span>&rdquo;? This cannot be undone.
          </p>
        </div>

        {/* Error Display */}
        {localError && (
          <p className="text-red-500 dark:text-red-400 text-xs text-center font-medium bg-red-50 dark:bg-red-950/40 py-2 px-3 rounded border border-red-200 dark:border-red-900">
            {localError}
          </p>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-1">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Confirm with Canvas Password
            </label>
            <input
              ref={passwordInputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Canvas password"
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-slate-100 text-sm disabled:opacity-50"
              required
            />
          </div>

          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2 px-4 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-md font-medium text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !password}
              className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Deleting…' : 'Delete Canvas'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeleteCanvasModal;
