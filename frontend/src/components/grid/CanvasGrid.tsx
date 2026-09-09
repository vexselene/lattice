import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Lock, ArrowUp, ArrowLeft, MoreVertical, Pencil, Copy, Download, Trash2 } from 'lucide-react';
import { useCanvasStore } from '../../stores/canvasStore';
import type { CanvasSummary } from '../../api/canvas';
import GridTopBar from './GridTopBar';
import CanvasUnlockModal from './CanvasUnlockModal';
import CreateCanvasModal from './CreateCanvasModal';
import RenameCanvasModal from './RenameCanvasModal';
import DuplicateCanvasModal from './DuplicateCanvasModal';
import DeleteCanvasModal from './DeleteCanvasModal';

export const CanvasGrid: React.FC = () => {
  const {
    canvases,
    isLoadingCanvases,
    exportCanvas,
    activeCanvasId,
    closingCanvasId,
    setClosingCanvasId,
  } = useCanvasStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedCanvas, setSelectedCanvas] = useState<CanvasSummary | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Synchronize selectedCanvas when activeCanvasId is set (e.g. direct load)
  useEffect(() => {
    if (activeCanvasId) {
      const found = canvases.find((c) => c.id === activeCanvasId);
      if (found && (!selectedCanvas || selectedCanvas.id !== activeCanvasId)) {
        setSelectedCanvas(found);
      }
    }
  }, [activeCanvasId, canvases, selectedCanvas]);

  // When canvas is locked via TopBar, closingCanvasId is set in the store.
  // We trigger setSelectedCanvas(null) to initiate the Framer Motion layoutId shrink-back.
  useEffect(() => {
    if (closingCanvasId) {
      setSelectedCanvas(null);
      const timer = setTimeout(() => {
        setClosingCanvasId(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [closingCanvasId, setClosingCanvasId]);

  // Per-card menu and modal states
  const [activeMenuCanvasId, setActiveMenuCanvasId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<CanvasSummary | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<CanvasSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CanvasSummary | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const expandedContainerRef = useRef<HTMLDivElement>(null);
  const [isSubmittingUnlock, setIsSubmittingUnlock] = useState(false);

  const handleCloseUnlock = () => {
    if (isSubmittingUnlock || activeCanvasId !== null || closingCanvasId) return;
    useCanvasStore.getState().setError(null);
    setSelectedCanvas(null);
  };

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
              {/* Tile 1: Create New Canvas (unmodified) */}
              <button
                onClick={() => setCreateModalOpen(true)}
                className="aspect-square flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 hover:bg-slate-100/60 dark:hover:bg-slate-800/50 hover:border-slate-400 dark:hover:border-slate-500 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all cursor-pointer group shadow-sm hover:shadow"
                title="Create new canvas"
              >
                <div className="p-3.5 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 group-hover:scale-105 transition-transform mb-3">
                  <Plus className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Create new canvas
                </span>
              </button>

              {/* Remaining Tiles: Square cards for each canvas */}
              {filteredCanvases.map((canvas) => (
                <motion.div
                  key={canvas.id}
                  layoutId={`canvas-card-${canvas.id}`}
                  onClick={() => {
                    if (closingCanvasId || activeCanvasId !== null) return;
                    setSelectedCanvas(canvas);
                  }}
                  className="aspect-square relative flex flex-col items-center justify-center p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm hover:shadow-md transition-colors cursor-pointer group"
                >
                  {/* Three-dot menu button in corner */}
                  <div className="absolute top-3 right-3 z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuCanvasId((prev) => (prev === canvas.id ? null : canvas.id));
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Canvas options"
                    >
                      <MoreVertical className="w-4 h-4" />
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

                  {/* Center Padlock Icon */}
                  <div className="p-3.5 rounded-full bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/50 group-hover:scale-105 transition-transform">
                    <Lock className="w-7 h-7 text-slate-400 dark:text-slate-500" />
                  </div>

                  {/* Bottom-right Canvas Name */}
                  <div className="absolute bottom-4 right-4 text-right max-w-[85%]">
                    <span
                      className="block text-sm font-medium text-slate-800 dark:text-slate-200 truncate"
                      title={canvas.name}
                    >
                      {canvas.name}
                    </span>
                  </div>
                </motion.div>
              ))}
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
      {/* Expanded Canvas Card Overlay (Shared Layout) */}
      <AnimatePresence>
        {selectedCanvas && (
          <motion.div
            key="canvas-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={activeCanvasId === null && !closingCanvasId ? handleCloseUnlock : undefined}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30"
          />
        )}
        {selectedCanvas && (
          <motion.div
            ref={expandedContainerRef}
            key={`expanded-${selectedCanvas.id}`}
            layoutId={`canvas-card-${selectedCanvas.id}`}
            className="fixed inset-0 z-40 bg-white dark:bg-slate-900 overflow-hidden flex flex-col items-center justify-center"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Top-left back arrow button */}
            {activeCanvasId === null && !closingCanvasId && (
              <motion.button
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ delay: 0.15, duration: 0.2 }}
                onClick={handleCloseUnlock}
                disabled={isSubmittingUnlock}
                className="absolute top-5 left-5 sm:top-6 sm:left-8 z-30 p-2.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Back to grid"
                aria-label="Back to grid"
              >
                <ArrowLeft className="w-5 h-5" />
              </motion.button>
            )}

            {/* Content: Password form when unlocking, or Lock icon & title when active / closing */}
            {activeCanvasId === null && !closingCanvasId ? (
              <div className="flex-1 flex items-center justify-center p-6 w-full">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  transition={{ delay: 0.2, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full max-w-sm"
                >
                  <CanvasUnlockModal
                    canvas={selectedCanvas}
                    isOpen={true}
                    onClose={handleCloseUnlock}
                    containerRef={expandedContainerRef}
                    onSubmittingChange={setIsSubmittingUnlock}
                  />
                </motion.div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center relative w-full h-full">
                {/* Center Padlock Icon */}
                <div className="p-3.5 rounded-full bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/50">
                  <Lock className="w-7 h-7 text-slate-400 dark:text-slate-500" />
                </div>

                {/* Bottom-right Canvas Name */}
                <div className="absolute bottom-4 right-4 text-right max-w-[85%]">
                  <span
                    className="block text-sm font-medium text-slate-800 dark:text-slate-200 truncate"
                    title={selectedCanvas.name}
                  >
                    {selectedCanvas.name}
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
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
