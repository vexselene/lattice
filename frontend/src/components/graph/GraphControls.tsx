import React from 'react';
import { useReactFlow } from '@xyflow/react';
import { ZoomIn, ZoomOut, Maximize, LayoutDashboard } from 'lucide-react';


export const GraphControls: React.FC<{ onLayout: () => void }> = ({ onLayout }) => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className="absolute bottom-4 right-4 z-10 flex gap-2">
      <button
        onClick={() => zoomIn()}
        className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        title="Zoom In"
      >
        <ZoomIn className="w-5 h-5 text-slate-700 dark:text-slate-300" />
      </button>
      <button
        onClick={() => zoomOut()}
        className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        title="Zoom Out"
      >
        <ZoomOut className="w-5 h-5 text-slate-700 dark:text-slate-300" />
      </button>
      <button
        onClick={() => fitView({ duration: 500 })}
        className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        title="Fit View"
      >
        <Maximize className="w-5 h-5 text-slate-700 dark:text-slate-300" />
      </button>
      <button
        onClick={onLayout}
        className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        title="Auto Layout"
      >
        <LayoutDashboard className="w-5 h-5 text-slate-700 dark:text-slate-300" />
      </button>
    </div>
  );
};

export default GraphControls;
