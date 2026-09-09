import React, { useState, useRef, useEffect } from 'react';
import { Search, Lock, MoreVertical, Upload, Settings, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useCanvasStore } from '../../stores/canvasStore';
import { lockAuth } from '../../api/auth';

interface GridTopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isSearchOpen: boolean;
  onToggleSearch: () => void;
}

export const GridTopBar: React.FC<GridTopBarProps> = ({
  searchQuery,
  onSearchChange,
  isSearchOpen,
  onToggleSearch,
}) => {
  const { logout } = useAuthStore();
  const { importCanvas } = useCanvasStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setMenuOpen(false);
        return;
      }
      if (e.key === 'Tab' && menuRef.current) {
        const focusables = Array.from(
          menuRef.current.querySelectorAll<HTMLElement>('button:not([disabled])')
        );
        if (focusables.length > 0) {
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const handleLock = async () => {
    try {
      await lockAuth();
    } catch {}
    useCanvasStore.getState().resetCanvasState();
    logout();
  };

  const handleImport = async () => {
    setMenuOpen(false);
    try {
      await importCanvas();
    } catch (err) {
      console.error('Failed to import canvas:', err);
    }
  };

  return (
    <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800/80 shadow-sm shrink-0 relative z-20">
      {/* LEFT: branding only */}
      <div className="flex items-center gap-6">
        <div className="font-bold text-xl tracking-tight text-slate-900 dark:text-white select-none">
          Lattice
        </div>
      </div>

      {/* RIGHT: Search icon, Lock icon, Three-dot menu icon in order */}
      <div className="flex items-center gap-2">
        {/* Search */}
        {isSearchOpen ? (
          <div className="flex items-center relative mr-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search canvases..."
              className="w-48 sm:w-64 pl-8 pr-7 py-1 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-[#4F46E5] text-slate-900 dark:text-slate-100"
            />
            <button
              onClick={() => {
                if (searchQuery) {
                  onSearchChange('');
                } else {
                  onToggleSearch();
                }
              }}
              className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Close search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onToggleSearch}
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors rounded-md"
            title="Search canvases"
          >
            <Search className="w-5 h-5" />
          </button>
        )}

        {/* Lock */}
        <button
          onClick={handleLock}
          className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors rounded-md"
          title="Lock Vault"
        >
          <Lock className="w-5 h-5" />
        </button>

        {/* Three-dot menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors rounded-md"
            title="Options"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-30">
              <button
                onClick={handleImport}
                className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 flex items-center gap-2.5 transition-colors"
              >
                <Upload className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                Import canvas
              </button>
              <button
                disabled
                className="w-full text-left px-3 py-2 text-sm text-slate-400 dark:text-slate-500 cursor-not-allowed flex items-center gap-2.5"
                title="Settings (coming soon)"
              >
                <Settings className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                Settings
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GridTopBar;
