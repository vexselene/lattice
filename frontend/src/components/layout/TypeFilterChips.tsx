
import { useUIStore } from '../../stores/uiStore';
import { NodeType } from '../../types/graph';
import clsx from 'clsx';

const TYPES: { id: NodeType; label: string; color: string }[] = [
  { id: 'email', label: 'Email', color: 'hover:border-[#4F46E5] hover:text-[#4F46E5]' },
  { id: 'account', label: 'Account', color: 'hover:border-[#7C3AED] hover:text-[#7C3AED]' },
  { id: 'service', label: 'Service', color: 'hover:border-[#059669] hover:text-[#059669]' },
  { id: 'phone', label: 'Phone', color: 'hover:border-[#EA580C] hover:text-[#EA580C]' },
];

export const TypeFilterChips = () => {
  const { typeFilters, toggleTypeFilter } = useUIStore();

  return (
    <div className="flex items-center gap-2">
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
    </div>
  );
};

export default TypeFilterChips;
