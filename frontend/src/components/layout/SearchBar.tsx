import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useGraphStore } from '../../stores/graphStore';
import clsx from 'clsx';

export const SearchBar = () => {
  const { searchQuery, setSearchQuery } = useUIStore();
  const { nodes } = useGraphStore();
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsFocused(true);
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
        setIsFocused(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'email': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300';
      case 'account': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300';
      case 'service': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300';
      case 'phone': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const results = searchQuery.trim() === '' ? [] : nodes.filter(n => {
    const d = n.data as any;
    const label = (d.address || d.username || d.name || d.number || '').toLowerCase();
    return label.includes(searchQuery.toLowerCase());
  }).slice(0, 8);

  const handleSelect = (nodeId: string) => {
    window.dispatchEvent(new CustomEvent('flyToNode', { detail: { id: nodeId } }));
    setIsFocused(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative flex flex-col w-64">
      <div className="relative flex items-center w-full">
        <Search className="absolute left-3 w-4 h-4 text-slate-400 z-10" />
        <input
          ref={inputRef}
          type="search"
          autoComplete="new-password"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-1p-ignore="true"
          data-lpignore="true"
          data-form-type="other"
          placeholder="Search nodes... (⌘K)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results.length > 0) {
              handleSelect(results[0].data.id as string);
            }
          }}
          className="w-full pl-9 pr-4 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full focus:outline-none focus:ring-2 focus:ring-[#4F46E5] text-slate-900 dark:text-slate-100 transition-colors z-10"
        />
      </div>

      {isFocused && results.length > 0 && (
        <div className="absolute top-full left-0 mt-2 w-full max-h-64 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1">
          {results.map(n => {
            const d = n.data as any;
            const label = d.address || d.username || d.name || d.number || d.id;
            return (
              <button
                key={d.id}
                onClick={() => handleSelect(d.id)}
                className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
              >
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate pr-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                  {label}
                </span>
                <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider flex-shrink-0", getBadgeColor(n.type || ''))}>
                  {n.type}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
