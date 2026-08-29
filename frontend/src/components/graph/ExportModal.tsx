import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Download } from 'lucide-react';
import clsx from 'clsx';
import { useReactFlow } from '@xyflow/react';
import { exportCanvas } from '../../utils/exportCanvas';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialScope?: 'full' | 'selected';
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, initialScope = 'full' }) => {
  const reactFlowInstance = useReactFlow();
  
  const [fileName, setFileName] = useState('lattice-export');
  const [format, setFormat] = useState<'png' | 'svg'>('png');
  const [scale, setScale] = useState<number>(2);
  const [scope, setScope] = useState<'full' | 'selected'>(initialScope);
  const [mode, setMode] = useState<'isolated' | 'dimmed'>('isolated');
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [includeBackground, setIncludeBackground] = useState(true);

  // Sync scope when opened with a new initialScope
  useEffect(() => {
    if (isOpen) {
      setScope(initialScope);
    }
  }, [isOpen, initialScope]);

  if (!isOpen) return null;

  const handleExport = async () => {
    const themeBgColor = document.documentElement.classList.contains('dark') ? '#0B0F19' : '#F8FAFC';
    await exportCanvas({
      reactFlowInstance,
      fileName,
      format,
      pixelRatio: scale,
      scope,
      mode,
      showEdgeLabels,
      includeBackground,
      themeBgColor
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-semibold">
            <ImageIcon className="w-5 h-5 text-indigo-500" />
            Export Graph
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[80vh]">
          {/* File Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">File Name</label>
            <input 
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              placeholder="lattice-export"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Format */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Format</label>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button onClick={() => setFormat('png')} className={clsx("flex-1 text-xs font-medium py-1.5 rounded-md transition-colors", format === 'png' ? "bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>PNG</button>
                <button onClick={() => setFormat('svg')} className={clsx("flex-1 text-xs font-medium py-1.5 rounded-md transition-colors", format === 'svg' ? "bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>SVG</button>
              </div>
            </div>

            {/* Scale */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Quality</label>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                {[1, 2, 3].map(s => (
                  <button 
                    key={s} 
                    onClick={() => setScale(s)} 
                    className={clsx("flex-1 text-xs font-medium py-1.5 rounded-md transition-colors", scale === s ? "bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Scope */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Scope</label>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button onClick={() => setScope('full')} className={clsx("flex-1 text-xs font-medium py-1.5 rounded-md transition-colors", scope === 'full' ? "bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>Full Graph</button>
              <button onClick={() => setScope('selected')} className={clsx("flex-1 text-xs font-medium py-1.5 rounded-md transition-colors", scope === 'selected' ? "bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>Selected Only</button>
            </div>
          </div>

          {/* Subgraph Style (if selected) */}
          {scope === 'selected' && (
            <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Subgraph Style</label>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button onClick={() => setMode('isolated')} className={clsx("flex-1 text-xs font-medium py-1.5 rounded-md transition-colors", mode === 'isolated' ? "bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>Isolated (Hide Unselected)</button>
                <button onClick={() => setMode('dimmed')} className={clsx("flex-1 text-xs font-medium py-1.5 rounded-md transition-colors", mode === 'dimmed' ? "bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>Dimmed Context</button>
              </div>
            </div>
          )}

          {/* Toggles */}
          <div className="flex flex-col gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Render Edge Labels</span>
              <div className={clsx("w-10 h-6 rounded-full transition-colors flex items-center px-1", showEdgeLabels ? "bg-indigo-500" : "bg-slate-200 dark:bg-slate-700")}>
                <div className={clsx("w-4 h-4 bg-white rounded-full transition-transform shadow-sm", showEdgeLabels ? "translate-x-4" : "translate-x-0")} />
              </div>
              <input type="checkbox" className="hidden" checked={showEdgeLabels} onChange={(e) => setShowEdgeLabels(e.target.checked)} />
            </label>

            <label className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Include Canvas Background</span>
              <div className={clsx("w-10 h-6 rounded-full transition-colors flex items-center px-1", includeBackground ? "bg-indigo-500" : "bg-slate-200 dark:bg-slate-700")}>
                <div className={clsx("w-4 h-4 bg-white rounded-full transition-transform shadow-sm", includeBackground ? "translate-x-4" : "translate-x-0")} />
              </div>
              <input type="checkbox" className="hidden" checked={includeBackground} onChange={(e) => setIncludeBackground(e.target.checked)} />
            </label>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
            Cancel
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
            <Download className="w-4 h-4" />
            Export Now
          </button>
        </div>
      </div>
    </div>
  );
};
