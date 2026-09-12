import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Lock, ArrowUp, Menu, Pencil, Copy, KeyRound, Download, Trash2, GripVertical, X } from 'lucide-react';
import { useCanvasStore } from '../../stores/canvasStore';
import type { CanvasSummary } from '../../api/canvas';
import { getCardVariant, formatCanvasDate } from '../../lib/cardVariants';
import GridTopBar from './GridTopBar';
import CreateCanvasModal from './CreateCanvasModal';
import RenameCanvasModal from './RenameCanvasModal';
import DuplicateCanvasModal from './DuplicateCanvasModal';
import ChangeCanvasPasswordModal from './ChangeCanvasPasswordModal';
import DeleteCanvasModal from './DeleteCanvasModal';

export const CanvasGrid: React.FC = () => {
  const draggedIdRef = useRef<string | null>(null);
  const {
    canvases,
    isLoadingCanvases,
    exportCanvas,
    unlockingCanvas,
    setUnlockingCanvas,
    activeCanvasId,
    closingCanvasId,
    sortMode,
    reorderCanvases,
  } = useCanvasStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isArranging, setIsArranging] = useState(false);
  const [orderedCanvases, setOrderedCanvases] = useState<CanvasSummary[]>([]);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // Per-card menu and modal states
  const [activeMenuCanvasId, setActiveMenuCanvasId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<CanvasSummary | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<CanvasSummary | null>(null);
  const [changePasswordTarget, setChangePasswordTarget] = useState<CanvasSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CanvasSummary | null>(null);

  // Keyboard navigation & selection states
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pendingFocusIdRef = useRef<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

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

  const sortedCanvases = useMemo(() => {
    const list = [...canvases];
    if (sortMode === 'recent') {
      return list.sort((a, b) => {
        const timeA =
          new Date(a.modified_at || a.modifiedAt || a.created_at || a.createdAt || '').getTime() || 0;
        const timeB =
          new Date(b.modified_at || b.modifiedAt || b.created_at || b.createdAt || '').getTime() || 0;
        return timeB - timeA;
      });
    }
    // 'manual' mode: sorted by order_index ASC
    return list.sort((a, b) => {
      const ordA = a.order_index ?? a.orderIndex ?? 0;
      const ordB = b.order_index ?? b.orderIndex ?? 0;
      return ordA - ordB;
    });
  }, [canvases, sortMode]);

  const filteredCanvases = useMemo(() => {
    if (!searchQuery.trim()) return sortedCanvases;
    const q = searchQuery.toLowerCase().trim();
    return sortedCanvases.filter((c) => c.name.toLowerCase().includes(q));
  }, [sortedCanvases, searchQuery]);

  useEffect(() => {
    setOrderedCanvases(filteredCanvases);
  }, [filteredCanvases]);

  useEffect(() => {
    if (sortMode !== 'manual' && isArranging) {
      setIsArranging(false);
    }
  }, [sortMode, isArranging]);

  const handleToggleArranging = async () => {
    if (isArranging) {
      setIsArranging(false);
      const orderedIds = orderedCanvases.map((c) => c.id);
      try {
        await reorderCanvases(orderedIds);
      } catch (err) {
        console.error('Failed to reorder canvases:', err);
      }
    } else {
      setIsArranging(true);
    }
  };

  // Handle focus when a new canvas is created
  const handleCanvasCreated = (created: CanvasSummary) => {
    setSelectedId(created.id);
    pendingFocusIdRef.current = created.id;
  };

  // Focus newly created canvas once rendered
  useEffect(() => {
    if (!pendingFocusIdRef.current) return;
    const id = pendingFocusIdRef.current;

    const tryFocus = () => {
      const cardEl = cardRefs.current.get(id);
      if (cardEl) {
        cardEl.focus();
        cardEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        pendingFocusIdRef.current = null;
        return true;
      }
      return false;
    };

    if (!tryFocus()) {
      const timer = setTimeout(tryFocus, 60);
      return () => clearTimeout(timer);
    }
  }, [filteredCanvases]);

  // Helper to get dynamic columns count
  const getColumnCount = (): number => {
    if (!gridRef.current) return 1;
    const children = Array.from(gridRef.current.children) as HTMLElement[];
    if (children.length <= 1) return 1;
    const firstTop = children[0].offsetTop;
    let count = 0;
    for (const child of children) {
      if (child.offsetTop === firstTop) {
        count++;
      } else {
        break;
      }
    }
    return Math.max(1, count);
  };

  // Focus item by index
  const focusItemByIndex = (index: number, items: string[]) => {
    const id = items[index];
    if (!id) return;
    setSelectedId(id);
    if (id === '__create__') {
      createButtonRef.current?.focus();
      createButtonRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      const el = cardRefs.current.get(id);
      if (el) {
        el.focus();
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  };

  // Global keyboard navigation for canvas grid
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      if (
        isArranging ||
        createModalOpen ||
        unlockingCanvas !== null ||
        activeCanvasId !== null ||
        activeMenuCanvasId !== null ||
        renameTarget !== null ||
        duplicateTarget !== null ||
        changePasswordTarget !== null ||
        deleteTarget !== null
      ) {
        return;
      }

      const currentCanvases = sortMode === 'manual' ? orderedCanvases : filteredCanvases;
      const items = ['__create__', ...currentCanvases.map((c) => c.id)];
      const totalItems = items.length;
      if (totalItems === 0) return;

      const currentIndex = selectedId !== null ? items.indexOf(selectedId) : -1;

      switch (e.key) {
        case 'ArrowRight': {
          e.preventDefault();
          if (currentIndex < 0) {
            focusItemByIndex(0, items);
          } else if (currentIndex < totalItems - 1) {
            focusItemByIndex(currentIndex + 1, items);
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (currentIndex < 0) {
            focusItemByIndex(0, items);
          } else if (currentIndex > 0) {
            focusItemByIndex(currentIndex - 1, items);
          }
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const cols = getColumnCount();
          if (currentIndex < 0) {
            focusItemByIndex(0, items);
          } else if (currentIndex + cols < totalItems) {
            focusItemByIndex(currentIndex + cols, items);
          } else {
            const lastRowStartIndex = Math.floor((totalItems - 1) / cols) * cols;
            if (currentIndex < lastRowStartIndex) {
              focusItemByIndex(totalItems - 1, items);
            }
          }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const cols = getColumnCount();
          if (currentIndex < 0) {
            focusItemByIndex(0, items);
          } else if (currentIndex >= cols) {
            focusItemByIndex(currentIndex - cols, items);
          }
          break;
        }
        case 'Home': {
          e.preventDefault();
          focusItemByIndex(0, items);
          break;
        }
        case 'End': {
          e.preventDefault();
          focusItemByIndex(totalItems - 1, items);
          break;
        }
        case 'Enter':
        case ' ': {
          if (selectedId === '__create__') {
            if (document.activeElement !== createButtonRef.current) {
              e.preventDefault();
              setCreateModalOpen(true);
            }
          } else if (selectedId) {
            const target = filteredCanvases.find((c) => c.id === selectedId);
            if (target) {
              e.preventDefault();
              setUnlockingCanvas(target);
            }
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          setSelectedId(null);
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    selectedId,
    filteredCanvases,
    orderedCanvases,
    sortMode,
    isArranging,
    createModalOpen,
    unlockingCanvas,
    activeCanvasId,
    activeMenuCanvasId,
    renameTarget,
    duplicateTarget,
    changePasswordTarget,
    deleteTarget,
  ]);

  const renderCanvasCard = (canvas: CanvasSummary, index: number) => {
    const variant = getCardVariant(canvas.colorIndex);
    const { date, time } = formatCanvasDate(
      canvas.modified_at || canvas.modifiedAt || canvas.created_at || canvas.createdAt
    );

    const isOpening = unlockingCanvas?.id === canvas.id;
    const isActive = activeCanvasId === canvas.id;
    const isClosing = closingCanvasId === canvas.id;
    const isEnlarged = isOpening || isActive;
    const isSelected = selectedId === canvas.id;

    let dropIndicatorClass = '';
    if (dropIndex !== null) {
      if (dropIndex === index) dropIndicatorClass = 'drop-left';
      else if (dropIndex === orderedCanvases.length && index === orderedCanvases.length - 1) dropIndicatorClass = 'drop-right';
    }

    const cardProps = {
      ref: (el: HTMLElement | null) => {
        if (el) cardRefs.current.set(canvas.id, el);
        else cardRefs.current.delete(canvas.id);
      },
      role: 'button' as const,
      tabIndex: isArranging ? -1 : 0,
      'aria-label': `Open ${canvas.name} canvas`,
      onClick: () => {
        if (isArranging) return;
        setSelectedId(canvas.id);
        if (activeCanvasId !== null || unlockingCanvas !== null) return;
        setUnlockingCanvas(canvas);
      },
      onFocus: () => {
        if (!isArranging) setSelectedId(canvas.id);
      },
      draggable: isArranging,
      onDragStart: ((e: React.DragEvent<HTMLDivElement>) => {
        if (!isArranging) return;
        draggedIdRef.current = canvas.id;
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.classList.add('opacity-40');
      }) as any,
      onDragEnter: ((e: React.DragEvent<HTMLDivElement>) => {
        if (!isArranging || !draggedIdRef.current || draggedIdRef.current === canvas.id) return;
        e.preventDefault();
      }) as any,
      onDragOver: ((e: React.DragEvent<HTMLDivElement>) => {
        if (!isArranging || !draggedIdRef.current || draggedIdRef.current === canvas.id) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const isLeft = x < rect.width / 2;
        
        const newDropIndex = isLeft ? index : index + 1;
        if (dropIndex !== newDropIndex) {
          setDropIndex(newDropIndex);
        }
      }) as any,
      onDragLeave: (() => {
        // Only clear if we actually leave the card bounds to avoid flickering
      }) as any,
      onDrop: ((e: React.DragEvent<HTMLDivElement>) => {
        if (!isArranging || !draggedIdRef.current) return;
        e.preventDefault();
        
        if (draggedIdRef.current !== canvas.id && dropIndex !== null) {
          const draggedIdx = orderedCanvases.findIndex(c => c.id === draggedIdRef.current);
          
          if (draggedIdx !== -1) {
            const newOrder = [...orderedCanvases];
            const [removed] = newOrder.splice(draggedIdx, 1);
            
            let actualInsertIdx = dropIndex;
            if (draggedIdx < dropIndex) {
              actualInsertIdx -= 1;
            }
            
            newOrder.splice(actualInsertIdx, 0, removed);
            setOrderedCanvases(newOrder);
          }
        }
        draggedIdRef.current = null;
        setDropIndex(null);
      }) as any,
      onDragEnd: ((e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('opacity-40');
        draggedIdRef.current = null;
        setDropIndex(null);
      }) as any,
      initial: false,
      animate: isEnlarged
        ? { scale: 1.08, y: -6, zIndex: 20 }
        : isSelected && !isClosing && !isArranging
        ? { scale: 1.03, y: -4, zIndex: 10 }
        : { scale: 1, y: 0, zIndex: 1 },
      whileHover:
        !isEnlarged && !isClosing && !isArranging
          ? { scale: 1.03, y: -4, transition: { duration: 0.2, ease: 'easeOut' as const } }
          : undefined,
      whileTap:
        !isEnlarged && !isClosing && !isArranging
          ? { scale: 0.99, transition: { duration: 0.1 } }
          : undefined,
      transition: { duration: 0.25, ease: 'easeOut' as const },
      className: `aspect-square relative flex items-center justify-center neubrutalist-card ${dropIndicatorClass} ${variant.cardClassName} ${
        isArranging
          ? 'cursor-grab active:cursor-grabbing border-2 !border-dashed !border-slate-400 dark:!border-slate-500'
          : 'cursor-pointer'
      } group outline-none transition-all duration-200 ${
        isSelected && !isArranging
          ? 'is-selected ring-2 ring-[#DE6B80] ring-offset-2 ring-offset-[#F8FAFC] dark:ring-offset-[#0B0F19]'
          : 'focus-visible:ring-2 focus-visible:ring-[#DE6B80] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8FAFC] dark:focus-visible:ring-offset-[#0B0F19]'
      }`,
    };

    const cardInner = (
      <>
        {/* Pattern Layer */}
        <div
          className={`absolute inset-0 overflow-hidden pointer-events-none ${variant.patternClassName}`}
          style={{ borderRadius: 'calc(16px - 3px)' }}
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

        {/* Top-right: Three-dot context menu trigger (hidden while arranging) */}
        {!isArranging && (
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuCanvasId(null);
                    setChangePasswordTarget(canvas);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 flex items-center gap-2.5 transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  Change Password
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
        )}

        {/* Center Padlock Icon Badge */}
        <div className="w-12 h-12 rounded-full bg-[#f8fafc] dark:bg-slate-800 border-2 border-[#1a1a1a] dark:border-slate-600 flex items-center justify-center shadow-[0_0_12px_rgba(0,0,0,0.18)] dark:shadow-[0_0_14px_rgba(0,0,0,0.7)] group-hover:scale-105 group-hover:shadow-[0_0_18px_rgba(0,0,0,0.28)] dark:group-hover:shadow-[0_0_20px_rgba(0,0,0,0.85)] transition-all z-10 pointer-events-none">
          <Lock className="w-5 h-5 text-[#1a1a1a] dark:text-slate-200" />
        </div>

        {/* Bottom-left Canvas Name */}
        <div className={`absolute bottom-5 left-6 text-left z-10 pointer-events-none ${isArranging ? 'max-w-[70%]' : 'max-w-[85%]'}`}>
          <span
            className="block text-base font-bold text-slate-900 dark:text-slate-100 truncate"
            title={canvas.name}
          >
            {canvas.name}
          </span>
        </div>

        {/* Bottom-right: Grip icon while arranging */}
        {isArranging && (
          <div className="absolute bottom-5 right-5 z-20 pointer-events-none text-slate-500 dark:text-slate-400">
            <GripVertical className="w-5 h-5" />
          </div>
        )}
      </>
    );

    return (
      <motion.div
        key={canvas.id}
        {...cardProps}
      >
        {cardInner}
      </motion.div>
    );
  };

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
        onClick={(e) => {
          if (!(e.target as Element).closest('.neubrutalist-card, .neubrutalist-create-tile, button')) {
            setSelectedId(null);
          }
        }}
        className="flex-1 overflow-y-auto p-6 sm:p-8 md:p-10 relative select-none"
      >
        <div className="w-full">
          {isLoadingCanvases && canvases.length === 0 ? (
            <div className="flex items-center justify-center py-24 text-slate-400 dark:text-slate-600 text-sm">
              Loading canvases…
            </div>
          ) : (
            <div ref={gridRef} className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-6">
              {/* Tile 1: Create New Canvas (re-styled) */}
              <button
                ref={createButtonRef}
                tabIndex={0}
                role="button"
                aria-label="Create new canvas"
                onClick={() => {
                  setSelectedId('__create__');
                  setCreateModalOpen(true);
                }}
                onFocus={() => setSelectedId('__create__')}
                className={`aspect-square flex flex-col items-center justify-center p-6 neubrutalist-create-tile cursor-pointer group outline-none transition-all duration-200 ${
                  selectedId === '__create__'
                    ? 'is-selected ring-2 ring-[#DE6B80] ring-offset-2 ring-offset-[#F8FAFC] dark:ring-offset-[#0B0F19]'
                    : 'focus-visible:ring-2 focus-visible:ring-[#DE6B80] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8FAFC] dark:focus-visible:ring-offset-[#0B0F19]'
                }`}
                title="Create new canvas"
              >
                <div className={`w-[54px] h-[54px] rounded-full bg-white dark:bg-slate-800 border-2 transition-all mb-3 flex items-center justify-center shadow-sm ${
                  selectedId === '__create__'
                    ? 'border-[#1a1a1a] dark:border-white scale-105'
                    : 'border-[#475569] dark:border-slate-500 group-hover:border-[#1a1a1a] dark:group-hover:border-white group-hover:scale-105'
                }`}>
                  <Plus className={`w-6 h-6 transition-colors ${
                    selectedId === '__create__'
                      ? 'text-[#1a1a1a] dark:text-white'
                      : 'text-[#475569] dark:text-slate-400 group-hover:text-[#1a1a1a] dark:group-hover:text-white'
                  }`} />
                </div>
                <span className={`text-sm font-medium transition-colors ${
                  selectedId === '__create__'
                    ? 'text-[#1a1a1a] dark:text-white'
                    : 'text-[#475569] dark:text-slate-400 group-hover:text-[#1a1a1a] dark:group-hover:text-white'
                }`}>
                  Create new canvas
                </span>
              </button>

              {/* Remaining Tiles: Square cards for each canvas */}
              {sortMode === 'manual' 
                ? orderedCanvases.map((canvas, idx) => renderCanvasCard(canvas, idx))
                : filteredCanvases.map((canvas, idx) => renderCanvasCard(canvas, idx))
              }
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

        {/* Floating FAB for Arranging in Manual Mode */}
        {sortMode === 'manual' && (
          <button
            onClick={handleToggleArranging}
            className={`fixed bottom-6 right-6 z-30 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-105 active:scale-95 cursor-pointer outline-none ${
              isArranging
                ? 'bg-[#1a1a1a] text-white dark:bg-white dark:text-[#1a1a1a]'
                : 'bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
            title={isArranging ? 'Done arranging (save order)' : 'Arrange canvases'}
            aria-label={isArranging ? 'Done arranging' : 'Arrange canvases'}
          >
            {isArranging ? <X className="w-5 h-5" /> : <Pencil className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* Modals */}
      <CreateCanvasModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleCanvasCreated}
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
      <ChangeCanvasPasswordModal
        canvas={changePasswordTarget}
        isOpen={changePasswordTarget !== null}
        onClose={() => setChangePasswordTarget(null)}
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
