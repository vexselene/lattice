
import { useState, useRef, useEffect } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useGraphStore } from '../../stores/graphStore';
import { NodeType } from '../../types/graph';
import { ChevronDown, X } from 'lucide-react';
import clsx from 'clsx';

const TYPES: { id: NodeType; label: string; color: string }[] = [
  { id: 'email', label: 'Email', color: 'hover:border-[#4F46E5] hover:text-[#4F46E5]' },
  { id: 'account', label: 'Account', color: 'hover:border-[#7C3AED] hover:text-[#7C3AED]' },
  { id: 'phone', label: 'Phone', color: 'hover:border-[#EA580C] hover:text-[#EA580C]' },
];

export const TypeFilterChips = () => {
  const { typeFilters, toggleTypeFilter, tagFilters, toggleTagFilter, clearTagFilters } = useUIStore();
  const { nodes: storeNodes } = useGraphStore();
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const tagMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagMenuRef.current && !tagMenuRef.current.contains(e.target as Node)) {
        setIsTagMenuOpen(false);
      }
    };
    if (isTagMenuOpen) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => window.removeEventListener('click', handleClickOutside);
  }, [isTagMenuOpen]);

  const existingTags = Array.from(new Set(
    storeNodes.flatMap(n => n.data.tags || [])
  )).sort();

  return (
    <div className="flex items-center gap-2 relative">
      {TYPES.map((t) => {
        const isActive = typeFilters.includes(t.id);
        return (
          <button
            key={t.id}
            onClick={() => toggleTypeFilter(t.id)}
            className={clsx(
              'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
              isActive
                ? 'bg-slate-200 dark:bg-slate-700 border-transparent text-slate-900 dark:text-slate-100'
                : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400',
              !isActive && t.color
            )}
          >
            {t.label}
          </button>
        );
      })}

      <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

      <div className="relative" ref={tagMenuRef}>
        <button
          onClick={() => setIsTagMenuOpen(!isTagMenuOpen)}
          className={clsx(
            'px-3 py-1 text-xs font-medium rounded-full border transition-colors flex items-center gap-1.5',
            tagFilters.length > 0
              ? 'bg-indigo-100 dark:bg-indigo-900/40 border-transparent text-indigo-700 dark:text-indigo-300'
              : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
          )}
        >
          <span className="truncate max-w-[100px]">
            {tagFilters.length === 0 ? 'Tags' : tagFilters.length === 1 ? tagFilters[0] : `${tagFilters.length} Tags`}
          </span>
          <ChevronDown className={clsx("w-3 h-3 transition-transform", isTagMenuOpen && "rotate-180")} />
        </button>

        {isTagMenuOpen && (
          <div className="absolute top-full right-0 mt-1.5 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2">
            <div className="px-3 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <span>Filter by Tag</span>
              {tagFilters.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearTagFilters();
                  }}
                  className="hover:text-red-500 transition-colors p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700/50 -mr-1"
                  title="Clear all filters"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="max-h-[120px] overflow-y-auto flex flex-col p-1">
              {existingTags.length === 0 ? (
                <div className="px-3 py-4 text-xs text-center text-slate-400 dark:text-slate-500">
                  No tags found in graph
                </div>
              ) : (
                existingTags.map(tag => {
                  const isSelected = tagFilters.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTagFilter(tag)}
                      className={clsx(
                        "px-3 py-1.5 text-xs text-left rounded-md transition-colors font-medium flex items-center justify-between",
                        isSelected 
                          ? "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                          : "hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300"
                      )}
                    >
                      <span className="truncate">{tag}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TypeFilterChips;
