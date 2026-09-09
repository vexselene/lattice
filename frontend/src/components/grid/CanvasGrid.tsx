import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Lock, ArrowUp, Menu, Pencil, Copy, Download, Trash2 } from 'lucide-react';
import { useCanvasStore } from '../../stores/canvasStore';
import type { CanvasSummary } from '../../api/canvas';
import { getCardVariant, formatCanvasDate } from '../../lib/cardVariants';
import GridTopBar from './GridTopBar';
import CreateCanvasModal from './CreateCanvasModal';
import RenameCanvasModal from './RenameCanvasModal';
import DuplicateCanvasModal from './DuplicateCanvasModal';
import DeleteCanvasModal from './DeleteCanvasModal';

export const CanvasGrid: React.FC = () => {
  const {
    canvases,
    isLoadingCanvases,
    exportCanvas,
    unlockingCanvas,
    setUnlockingCanvas,
    activeCanvasId,
    closingCanvasId,
  } = useCanvasStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Per-card menu and modal states
  const [activeMenuCanvasId, setActiveMenuCanvasId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<CanvasSummary | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<CanvasSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CanvasSummary | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      setShowScrollTop(scrollContainerRef.current.scrollTop > 200);
    }
  };

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Close dropdown on click outside, Escape key, and trap Tab within menu
  useEffect(() => {
    if (!activeMenuCanvasId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        setActiveMenuCanvasId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setActiveMenuCanvasId(null);
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
  }, [activeMenuCanvasId]);

  const filteredCanvases = useMemo(() => {
    if (!searchQuery.trim()) return canvases;
    const q = searchQuery.toLowerCase().trim();
    return canvases.filter((c) => c.name.toLowerCase().includes(q));
  }, [canvases, searchQuery]);

  return (
    <div
      aria-hidden={activeCanvasId !== null}
      className={`flex flex-col h-full w-full bg-[#F8FAFC] dark:bg-[#0B0F19] overflow-hidden text-slate-900 dark:text-slate-100 transition-colors ${
        activeCanvasId !== null ? 'pointer-events-none' : ''
      }`}
    >
      {/* Top Bar */}
      <GridTopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isSearchOpen={isSearchOpen}
        onToggleSearch={() => {
          setIsSearchOpen((prev) => !prev);
          if (isSearchOpen) {
            setSearchQuery('');
          }
        }}
      />

      {/* Grid Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 sm:p-8 md:p-10 relative"
      >
        <div className="max-w-7xl mx-auto">
          {isLoadingCanvases && canvases.length === 0 ? (
            <div className="flex items-center justify-center py-24 text-slate-400 dark:text-slate-600 text-sm">
              Loading canvases…
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {/* Tile 1: Create New Canvas (re-styled) */}
              <button
                onClick={() => setCreateModalOpen(true)}
                className="aspect-square flex flex-col items-center justify-center p-6 neubrutalist-create-tile cursor-pointer group"
                title="Create new canvas"
              >
                <div className="w-[54px] h-[54px] rounded-full bg-white dark:bg-slate-800 border-2 border-[#475569] dark:border-slate-500 group-hover:border-[#1a1a1a] dark:group-hover:border-white group-hover:scale-105 transition-all mb-3 flex items-center justify-center shadow-sm">
                  <Plus className="w-6 h-6 text-[#475569] dark:text-slate-400 group-hover:text-[#1a1a1a] dark:group-hover:text-white transition-colors" />
                </div>
                <span className="text-sm font-medium text-[#475569] dark:text-slate-400 group-hover:text-[#1a1a1a] dark:group-hover:text-white transition-colors">
                  Create new canvas
                </span>
              </button>

              {/* Remaining Tiles: Square cards for each canvas */}
              {filteredCanvases.map((canvas, index) => {
                const variant = getCardVariant(index);
                const { date, time } = formatCanvasDate(
                  canvas.modified_at || canvas.modifiedAt || canvas.created_at || canvas.createdAt
                );

                const isOpening = unlockingCanvas?.id === canvas.id;
                const isActive = activeCanvasId === canvas.id;
                const isClosing = closingCanvasId === canvas.id;
                const isEnlarged = isOpening || isActive;

                return (
                  <motion.div
                    key={canvas.id}
                    onClick={() => {
                      if (activeCanvasId !== null || unlockingCanvas !== null) return;
                      setUnlockingCanvas(canvas);
                    }}
                    initial={false}
                    animate={
                      isEnlarged
                        ? { scale: 1.08, y: -6, zIndex: 20 }
                        : { scale: 1, y: 0, zIndex: 1 }
                    }
                    whileHover={
                      !isEnlarged && !isClosing
                        ? { scale: 1.03, y: -4, transition: { duration: 0.2, ease: 'easeOut' } }
                        : undefined
                    }
                    whileTap={
                      !isEnlarged && !isClosing
                        ? { scale: 0.99, transition: { duration: 0.1 } }
                        : undefined
                    }
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className={`aspect-square relative flex items-center justify-center neubrutalist-card ${variant.cardClassName} cursor-pointer group`}
                  >
                    {/* Pattern Layer */}
                    <div
                      className={`absolute inset-0 pointer-events-none ${variant.patternClassName}`}
                      aria-hidden="true"
                    />

                    {/* Top-left: Date and Time */}
                    <div className="absolute top-5 left-6 z-10 flex flex-col text-left font-mono select-none pointer-events-none">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 opacity-[0.35]">
                        {date}
                      </span>
                      {time && (
                        <span className="text-[11px] font-medium text-slate-900 dark:text-slate-100 opacity-[0.20]">
                          {time}
                        </span>
                      )}
                    </div>

                    {/* Top-right: Three-dot context menu trigger restyled with accent color */}
                    <div className="absolute top-4 right-4 z-20">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuCanvasId((prev) => (prev === canvas.id ? null : canvas.id));
                        }}
                        className="p-1.5 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                        style={{ color: 'var(--card-accent)' }}
                        title="Canvas options"
                        aria-label="Canvas options"
                      >
                        <Menu className="w-5 h-5" />
                      </button>

                      {/* Popover Dropdown */}
                      {activeMenuCanvasId === canvas.id && (
                        <div
                          ref={menuRef}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-30"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuCanvasId(null);
                              setRenameTarget(canvas);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 flex items-center gap-2.5 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5 text-slate-400" />
                            Rename
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuCanvasId(null);
                              setDuplicateTarget(canvas);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 flex items-center gap-2.5 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            Duplicate
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              setActiveMenuCanvasId(null);
                              try {
                                await exportCanvas(canvas.id);
                              } catch (err) {
                                console.error('Failed to export canvas:', err);
                              }
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 flex items-center gap-2.5 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5 text-slate-400" />
                            Export
                          </button>
                          <div className="my-1 border-t border-slate-100 dark:border-slate-700/60" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuCanvasId(null);
                              setDeleteTarget(canvas);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Center Padlock Icon Badge */}
                    <div className="w-12 h-12 rounded-full bg-[#f8fafc] dark:bg-slate-800 border-2 border-[#1a1a1a] dark:border-slate-600 flex items-center justify-center shadow-[0_0_12px_rgba(0,0,0,0.18)] dark:shadow-[0_0_14px_rgba(0,0,0,0.7)] group-hover:scale-105 group-hover:shadow-[0_0_18px_rgba(0,0,0,0.28)] dark:group-hover:shadow-[0_0_20px_rgba(0,0,0,0.85)] transition-all z-10">
                      <Lock className="w-5 h-5 text-[#1a1a1a] dark:text-slate-200" />
                    </div>

                    {/* Bottom-left Canvas Name */}
                    <div className="absolute bottom-5 left-6 text-left max-w-[85%] z-10">
                      <span
                        className="block text-base font-bold text-slate-900 dark:text-slate-100 truncate"
                        title={canvas.name}
                      >
                        {canvas.name}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Empty search results message */}
          {searchQuery && filteredCanvases.length === 0 && (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
              No canvases matching &ldquo;{searchQuery}&rdquo;
            </div>
          )}
        </div>

        {/* Scroll To Top Button */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-full shadow-lg hover:shadow-xl hover:bg-slate-50 dark:hover:bg-slate-750 transition-all text-xs font-medium"
            title="Scroll to top"
          >
            <ArrowUp className="w-4 h-4" />
            Back to top
          </button>
        )}
      </div>

      {/* Modals */}
      <CreateCanvasModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

      <RenameCanvasModal
        canvas={renameTarget}
        isOpen={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
      />
      <DuplicateCanvasModal
        canvas={duplicateTarget}
        isOpen={duplicateTarget !== null}
        onClose={() => setDuplicateTarget(null)}
      />
      <DeleteCanvasModal
        canvas={deleteTarget}
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default CanvasGrid;
