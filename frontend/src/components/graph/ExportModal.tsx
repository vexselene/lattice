import React, { useState, useEffect, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { Download, X, Image as ImageIcon, Eye, Info, Check } from 'lucide-react';
import clsx from 'clsx';
import { graphToSvgString } from '../../lib/exportRenderer';
import { ExportMode } from '../../lib/exportSelection';
import { useUIStore } from '../../stores/uiStore';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialScope?: 'all' | 'dimmed' | 'isolated' | 'full' | 'selected';
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  initialScope = 'all',
}) => {
  const { getNodes, getEdges } = useReactFlow();
  const theme = useUIStore((s) => s.theme);

  const [fileName, setFileName] = useState('lattice-export');
  const [format, setFormat] = useState<'png' | 'svg'>('png');
  const [scale, setScale] = useState<number>(2);
  const [mode, setMode] = useState<ExportMode>('all');
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [includeBackground, setIncludeBackground] = useState(true);
  const [keepHighlightRings, setKeepHighlightRings] = useState(false);
  const [ringScope, setRingScope] = useState<'all' | 'selected' | 'none'>('selected');
  const [edgeStyle, setEdgeStyle] = useState<'normal' | 'dashed' | 'highlighted'>('highlighted');
  const [edgeStyleApplyTo, setEdgeStyleApplyTo] = useState<'all' | 'selected' | 'nonSelected'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [savedFilePath, setSavedFilePath] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync initial mode on open
  useEffect(() => {
    if (isOpen) {
      setSavedFilePath(null);
      setSaveError(null);
      if (initialScope === 'selected' || initialScope === 'isolated') {
        setMode('isolated');
      } else if (initialScope === 'dimmed') {
        setMode('dimmed');
      } else {
        setMode('all');
      }
    }
  }, [isOpen, initialScope]);

  // Synchronously compute SVG string on render / options change without mutating canvas state
  const svgString = useMemo(() => {
    if (!isOpen) return '';
    try {
      const nodes = getNodes();
      const edges = getEdges();
      return graphToSvgString(nodes, edges, mode, {
        theme: theme === 'dark' ? 'dark' : 'light',
        showEdgeLabels,
        includeBackground,
        keepHighlightRings,
        ringScope,
        edgeStyle,
        edgeStyleApplyTo,
      });
    } catch (err) {
      console.error('Failed to generate SVG preview:', err);
      return '';
    }
  }, [
    isOpen,
    mode,
    showEdgeLabels,
    includeBackground,
    keepHighlightRings,
    ringScope,
    edgeStyle,
    edgeStyleApplyTo,
    theme,
    getNodes,
    getEdges,
  ]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!svgString) return;
    setIsSaving(true);
    setSaveError(null);
    setSavedFilePath(null);

    try {
      const defaultFilename = `${fileName || 'lattice-export'}.${format}`;
      let contentToSave = '';

      if (format === 'svg') {
        contentToSave = svgString;
      } else {
        // Off-screen canvas conversion
        contentToSave = await new Promise<string>((resolve, reject) => {
          const img = new Image();
          // Use data URI instead of Blob URI to comply with strict CSP (img-src data: is allowed, blob: is blocked)
          const blobUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);

          img.onload = () => {
            try {
              const parser = new DOMParser();
              const doc = parser.parseFromString(svgString, 'image/svg+xml');
              const svgEl = doc.querySelector('svg');
              const baseWidth = parseFloat(svgEl?.getAttribute('width') || '800');
              const baseHeight = parseFloat(svgEl?.getAttribute('height') || '600');

              const canvas = document.createElement('canvas');
              canvas.width = baseWidth * scale;
              canvas.height = baseHeight * scale;
              const ctx = canvas.getContext('2d');

              if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const pngUrl = canvas.toDataURL('image/png');
                resolve(pngUrl);
              } else {
                reject(new Error('Failed to get canvas 2d context'));
              }
            } catch (e) {
              reject(e);
            }
          };

          img.onerror = () => {
            reject(new Error('Failed to load SVG into image for canvas rasterization'));
          };

          img.src = blobUrl;
        });
      }

      if (window.api?.exportSaveFile) {
        const res = await window.api.exportSaveFile(contentToSave, defaultFilename);
        if (!res.canceled && res.filePath) {
          setSavedFilePath(res.filePath);
        }
      } else {
        // Fallback for browser testing
        const blob = format === 'svg'
          ? new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
          : await (await fetch(contentToSave)).blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = defaultFilename;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        setSavedFilePath(`Downloaded as ${defaultFilename}`);
      }
    } catch (err: any) {
      console.error('Export save error:', err);
      setSaveError(err?.message || 'Failed to save export file');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-semibold text-base">
            <ImageIcon className="w-5 h-5 text-indigo-500" />
            Export Graph Preview
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Options on Left, Live SVG Preview on Right */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 p-6 overflow-y-auto">
          {/* Options Column */}
          <div className="md:col-span-5 flex flex-col gap-4">
            {/* File Name */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                File Name
              </label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                placeholder="lattice-export"
              />
            </div>

            {/* Format & Resolution */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Format
                </label>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  <button
                    onClick={() => setFormat('png')}
                    className={clsx(
                      'flex-1 text-xs font-medium py-1.5 rounded-md transition-colors',
                      format === 'png'
                        ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    )}
                  >
                    PNG
                  </button>
                  <button
                    onClick={() => setFormat('svg')}
                    className={clsx(
                      'flex-1 text-xs font-medium py-1.5 rounded-md transition-colors',
                      format === 'svg'
                        ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    )}
                  >
                    SVG
                  </button>
                </div>
              </div>

              {format === 'png' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Resolution
                  </label>
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    {[1, 2, 3].map((s) => (
                      <button
                        key={s}
                        onClick={() => setScale(s)}
                        className={clsx(
                          'flex-1 text-xs font-medium py-1.5 rounded-md transition-colors',
                          scale === s
                            ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        )}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Scope / Mode - 3 States: All / Dimmed / Isolated */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Export Mode
              </label>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button
                  onClick={() => setMode('all')}
                  className={clsx(
                    'flex-1 text-xs font-medium py-1.5 rounded-md transition-colors',
                    mode === 'all'
                      ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  )}
                  title="Full graph with all nodes & edges at normal opacity"
                >
                  All
                </button>
                <button
                  onClick={() => setMode('dimmed')}
                  className={clsx(
                    'flex-1 text-xs font-medium py-1.5 rounded-md transition-colors',
                    mode === 'dimmed'
                      ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  )}
                  title="Full graph with active chain highlighted and unselected dimmed"
                >
                  Dimmed
                </button>
                <button
                  onClick={() => setMode('isolated')}
                  className={clsx(
                    'flex-1 text-xs font-medium py-1.5 rounded-md transition-colors',
                    mode === 'isolated'
                      ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  )}
                  title="Only selected nodes and fully connected edges; unselected hidden"
                >
                  Isolated
                </button>
              </div>
            </div>

            {/* Controls for Dimmed / Isolated Modes */}
            {mode !== 'all' && (
              <div className="flex flex-col gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-150">
                {/* Highlight Rings Control */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Highlight Rings
                  </label>
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    {(['all', 'selected', 'none'] as const).map((scope) => (
                      <button
                        key={scope}
                        type="button"
                        onClick={() => setRingScope(scope)}
                        className={clsx(
                          'flex-1 text-xs font-medium py-1.5 rounded-md capitalize transition-colors',
                          ringScope === scope
                            ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        )}
                      >
                        {scope}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Edge Style Control */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Edge Style
                  </label>
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    {(['normal', 'dashed', 'highlighted'] as const).map((style) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => setEdgeStyle(style)}
                        className={clsx(
                          'flex-1 text-xs font-medium py-1.5 rounded-md capitalize transition-colors',
                          edgeStyle === style
                            ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        )}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Apply To Control */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Apply to
                  </label>
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setEdgeStyleApplyTo('all')}
                      className={clsx(
                        'flex-1 text-xs font-medium py-1.5 rounded-md transition-colors',
                        edgeStyleApplyTo === 'all'
                          ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      )}
                    >
                      All edges
                    </button>
                    <button
                      type="button"
                      onClick={() => setEdgeStyleApplyTo('selected')}
                      className={clsx(
                        'flex-1 text-xs font-medium py-1.5 rounded-md transition-colors',
                        edgeStyleApplyTo === 'selected'
                          ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      )}
                    >
                      Selected edges
                    </button>
                    <button
                      type="button"
                      onClick={() => setEdgeStyleApplyTo('nonSelected')}
                      className={clsx(
                        'flex-1 text-xs font-medium py-1.5 rounded-md transition-colors',
                        edgeStyleApplyTo === 'nonSelected'
                          ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      )}
                    >
                      Non-selected edges
                    </button>
                  </div>
                  {mode === 'isolated' && edgeStyleApplyTo === 'nonSelected' && (
                    <div className="text-[11px] leading-tight text-amber-600 dark:text-amber-400 mt-1 flex items-start gap-1">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>This may render nothing if there are no neighbor edges in the current selection.</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Toggles */}
            <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                  Render Edge Labels
                </span>
                <div
                  className={clsx(
                    'w-9 h-5 rounded-full transition-colors flex items-center px-0.5',
                    showEdgeLabels ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'
                  )}
                >
                  <div
                    className={clsx(
                      'w-4 h-4 bg-white rounded-full transition-transform shadow-sm',
                      showEdgeLabels ? 'translate-x-4' : 'translate-x-0'
                    )}
                  />
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={showEdgeLabels}
                  onChange={(e) => setShowEdgeLabels(e.target.checked)}
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                  Include Canvas Background
                </span>
                <div
                  className={clsx(
                    'w-9 h-5 rounded-full transition-colors flex items-center px-0.5',
                    includeBackground ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'
                  )}
                >
                  <div
                    className={clsx(
                      'w-4 h-4 bg-white rounded-full transition-transform shadow-sm',
                      includeBackground ? 'translate-x-4' : 'translate-x-0'
                    )}
                  />
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={includeBackground}
                  onChange={(e) => setIncludeBackground(e.target.checked)}
                />
              </label>

              {mode === 'all' && (
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                    Keep Highlight Rings
                  </span>
                  <div
                    className={clsx(
                      'w-9 h-5 rounded-full transition-colors flex items-center px-0.5',
                      keepHighlightRings ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'
                    )}
                  >
                    <div
                      className={clsx(
                        'w-4 h-4 bg-white rounded-full transition-transform shadow-sm',
                        keepHighlightRings ? 'translate-x-4' : 'translate-x-0'
                      )}
                    />
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={keepHighlightRings}
                    onChange={(e) => setKeepHighlightRings(e.target.checked)}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Live SVG Preview Column */}
          <div className="md:col-span-7 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-indigo-500" />
                Live Vector Preview
              </span>
            </div>

            <div className="flex-1 min-h-[300px] max-h-[420px] bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl overflow-auto p-3 flex items-center justify-center shadow-inner">
              {svgString ? (
                <div
                  className="w-full h-full flex items-center justify-center overflow-auto [&>svg]:max-w-full [&>svg]:max-h-[380px] [&>svg]:h-auto [&>svg]:w-auto [&>svg]:rounded-lg [&>svg]:shadow-sm"
                  dangerouslySetInnerHTML={{ __html: svgString }}
                />
              ) : (
                <div className="text-xs text-slate-400">No nodes to preview</div>
              )}
            </div>
          </div>
        </div>

        {/* Saved Path Notification Banner */}
        {savedFilePath && (
          <div className="mx-6 mb-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>File exported and saved successfully</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0 font-medium">Saved to:</span>
              <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 bg-white/80 dark:bg-black/40 px-2.5 py-1.5 rounded border border-emerald-200 dark:border-emerald-900/50 break-all select-all flex-1 shadow-sm">
                {savedFilePath}
              </span>
            </div>
          </div>
        )}

        {saveError && (
          <div className="mx-6 mb-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
            <span>Error: {saveError}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end items-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!svgString || isSaving}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {isSaving ? 'Exporting...' : `Save (${format.toUpperCase()})`}
          </button>
        </div>
      </div>
    </div>
  );
};
