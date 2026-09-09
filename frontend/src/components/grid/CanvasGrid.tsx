import React, { useState, useMemo, useRef } from 'react';
import { Plus, Lock, ArrowUp } from 'lucide-react';
import { useCanvasStore } from '../../stores/canvasStore';
import type { CanvasSummary } from '../../api/canvas';
import GridTopBar from './GridTopBar';
import CanvasUnlockModal from './CanvasUnlockModal';
import CreateCanvasModal from './CreateCanvasModal';

export const CanvasGrid: React.FC = () => {
  const { canvases, isLoadingCanvases } = useCanvasStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedCanvas, setSelectedCanvas] = useState<CanvasSummary | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      setShowScrollTop(scrollContainerRef.current.scrollTop > 200);
    }
  };

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredCanvases = useMemo(() => {
    if (!searchQuery.trim()) return canvases;
    const q = searchQuery.toLowerCase().trim();
    return canvases.filter((c) => c.name.toLowerCase().includes(q));
  }, [canvases, searchQuery]);

  return (
    <div className="flex flex-col h-full w-full bg-[#F8FAFC] dark:bg-[#0B0F19] overflow-hidden text-slate-900 dark:text-slate-100 transition-colors">
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
              {/* Tile 1: Create New Canvas */}
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
                <div
                  key={canvas.id}
                  onClick={() => setSelectedCanvas(canvas)}
                  className="aspect-square relative flex flex-col items-center justify-center p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="p-3.5 rounded-full bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/50 group-hover:scale-105 transition-transform">
                    <Lock className="w-7 h-7 text-slate-400 dark:text-slate-500" />
                  </div>
                  <div className="absolute bottom-4 right-4 text-right max-w-[85%]">
                    <span
                      className="block text-sm font-medium text-slate-800 dark:text-slate-200 truncate"
                      title={canvas.name}
                    >
                      {canvas.name}
                    </span>
                  </div>
                </div>
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
      <CanvasUnlockModal
        canvas={selectedCanvas}
        isOpen={selectedCanvas !== null}
        onClose={() => setSelectedCanvas(null)}
      />
    </div>
  );
};

export default CanvasGrid;
