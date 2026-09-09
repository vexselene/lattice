
import { Sun, Moon, Lock, Eye, Edit2 } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useCanvasStore } from '../../stores/canvasStore';
import SearchBar from './SearchBar';
import TypeFilterChips from './TypeFilterChips';
import clsx from 'clsx';

export const TopBar = () => {
  const { theme, toggleTheme, isEditMode, toggleEditMode } = useUIStore();
  const { closeCanvas } = useCanvasStore();

  const handleCloseCanvas = async () => {
    try {
      await closeCanvas();
    } catch (err) {
      console.error('Failed to close canvas:', err);
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800/80 shadow-sm shrink-0 relative z-20">
      <div className="flex items-center gap-6">
        <div className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">
          Lattice
        </div>
        <SearchBar />
        <TypeFilterChips />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-full mr-2">
          <button
            onClick={() => isEditMode && toggleEditMode()}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200",
              !isEditMode ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            )}
            title="View Mode"
          >
            <Eye className="w-3.5 h-3.5" />
            View
          </button>
          <button
            onClick={() => !isEditMode && toggleEditMode()}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200",
              isEditMode ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            )}
            title="Edit Mode"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit
          </button>
        </div>
        
        <button
          onClick={toggleTheme}
          className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button
          onClick={handleCloseCanvas}
          className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors rounded-md"
          title="Lock Canvas"
        >
          <Lock className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default TopBar;
