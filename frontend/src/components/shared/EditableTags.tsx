import React from 'react';
import { X } from 'lucide-react';
import { useGraphStore } from '../../stores/graphStore';
import clsx from 'clsx';

export interface EditableTagsProps {
  nodeId: string;
  tags?: string[] | null;
  isEditMode: boolean;
  size?: 'xs' | 'sm';
  className?: string;
  showEmptyFallback?: boolean;
}

export const EditableTags: React.FC<EditableTagsProps> = ({
  nodeId,
  tags,
  isEditMode,
  size = 'xs',
  className,
  showEmptyFallback = false,
}) => {
  const removeTag = useGraphStore((s) => s.removeTag);

  if (!tags || tags.length === 0) {
    if (showEmptyFallback) {
      return <span className="text-sm text-slate-500">—</span>;
    }
    return null;
  }

  const isXs = size === 'xs';

  return (
    <div className={clsx('flex flex-wrap gap-1', className)}>
      {tags.map((tag) => (
        <span
          key={tag}
          className={clsx(
            'group/tag relative bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 tracking-wider font-bold rounded-md transition-all duration-200 ease-out uppercase',
            isXs ? 'text-[9px] pl-1.5 py-0.5 pr-1.5' : 'text-xs px-2 py-0.5',
            isEditMode && (isXs ? 'hover:pr-6' : 'hover:pr-7')
          )}
        >
          {tag}
          {isEditMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(nodeId, tag);
              }}
              className="absolute top-1/2 -translate-y-1/2 right-0.5 text-slate-400 hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all opacity-0 group-hover/tag:opacity-100 flex items-center justify-center p-0.5 rounded-full z-10"
              title={`Remove ${tag}`}
            >
              <X className={isXs ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            </button>
          )}
        </span>
      ))}
    </div>
  );
};

export default EditableTags;
