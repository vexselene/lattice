import React, { useState, useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { useCanvasStore } from '../../stores/canvasStore';
import { formatErrorMessage } from '../../api/canvas';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface CreateCanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateCanvasModal: React.FC<CreateCanvasModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const { createCanvas } = useCanvasStore();

  useFocusTrap(modalRef, isOpen, onClose, nameInputRef);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setPassword('');
      setConfirmPassword('');
      setLocalError(null);
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
      await createCanvas(trimmedName, password);
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

        {/* Plus Icon */}
        <div className="flex justify-center mb-1">
          <div className="p-3.5 bg-[#4F46E5]/10 rounded-full">
            <Plus className="w-7 h-7 text-[#4F46E5]" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Create New Canvas
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Choose a name and password for this canvas
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
              Canvas Name
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Work Investigation"
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4F46E5] text-slate-900 dark:text-slate-100 text-sm disabled:opacity-50"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Canvas Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4F46E5] text-slate-900 dark:text-slate-100 text-sm disabled:opacity-50"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm Password"
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4F46E5] text-slate-900 dark:text-slate-100 text-sm disabled:opacity-50"
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
              disabled={isSubmitting || !name.trim() || !password}
              className="flex-1 py-2 px-4 bg-[#4F46E5] hover:bg-[#4338ca] text-white rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#4F46E5]"
            >
              {isSubmitting ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCanvasModal;
