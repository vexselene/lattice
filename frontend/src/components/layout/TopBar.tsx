
import { Sun, Moon, Lock } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { lockAuth } from '../../api/auth';
import SearchBar from './SearchBar';
import TypeFilterChips from './TypeFilterChips';

export const TopBar = () => {
  const { theme, toggleTheme } = useUIStore();
  const { logout } = useAuthStore();

  const handleLock = async () => {
    try {
      await lockAuth();
    } catch {}
    logout();
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white/85 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shadow-sm shrink-0 relative z-20">
      <div className="flex items-center gap-6">
        <div className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">
          Lattice
        </div>
        <SearchBar />
        <TypeFilterChips />
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button
          onClick={handleLock}
          className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          title="Lock Database"
        >
          <Lock className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default TopBar;
