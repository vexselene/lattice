
import { Search } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

export const SearchBar = () => {
  const { searchQuery, setSearchQuery } = useUIStore();

  return (
    <div className="relative flex items-center w-64">
      <Search className="absolute left-3 w-4 h-4 text-slate-400" />
      <input
        type="text"
        placeholder="Search nodes..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full pl-9 pr-4 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full focus:outline-none focus:ring-2 focus:ring-[#4F46E5] text-slate-900 dark:text-slate-100 transition-colors"
      />
    </div>
  );
};

export default SearchBar;
