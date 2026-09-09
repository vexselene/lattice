import React, { useState, useEffect, useRef } from 'react';
import { Pencil, X } from 'lucide-react';
import { useCanvasStore } from '../../stores/canvasStore';
import { formatErrorMessage } from '../../api/canvas';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { CanvasSummary } from '../../api/canvas';

interface RenameCanvasModalProps {
  canvas: CanvasSummary | null;
  isOpen: boolean;
  onClose: () => void;
}

export const RenameCanvasModal: React.FC<RenameCanvasModalProps> = ({
  canvas,
  isOpen,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const { renameCanvas } = useCanvasStore();

  useFocusTrap(modalRef, isOpen, onClose);

  useEffect(() => {
    if (isOpen && canvas) {
      setName(canvas.name);
      setLocalError(null);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, canvas]);

  if (!isOpen || !canvas) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setLocalError('Canvas name cannot be empty');
      return;
    }

    if (trimmed === canvas.name) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      await renameCanvas(canvas.id, trimmed);
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

        {/* Icon */}
        <div className="flex justify-center mb-1">
          <div className="p-3.5 bg-[#4F46E5]/10 rounded-full">
            <Pencil className="w-7 h-7 text-[#4F46E5]" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Rename Canvas
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Enter a new name for &ldquo;{canvas.name}&rdquo;
          </p>
        </div>

        {/* Error Display */}
        {localError && (
          <p className="text-red-500 dark:text-red-400 text-xs text-center font-medium bg-red-50 dark:bg-red-950/40 py-2 px-3 rounded border border-red-200 dark:border-red-900">
            {localError}
          </p>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-1">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Canvas Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Canvas name"
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4F46E5] text-slate-900 dark:text-slate-100 text-sm disabled:opacity-50"
              required
            />
          </div>

          <div className="flex gap-2 mt-1">
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
              disabled={isSubmitting || !name.trim()}
              className="flex-1 py-2 px-4 bg-[#4F46E5] hover:bg-[#4338ca] text-white rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#4F46E5]"
            >
              {isSubmitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RenameCanvasModal;
