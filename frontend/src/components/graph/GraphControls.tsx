import React, { useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { ZoomIn, ZoomOut, Maximize, LayoutDashboard, Layers, Filter, GitFork } from 'lucide-react';
import clsx from 'clsx';

export const GraphControls: React.FC<{ onLayout: () => void }> = ({ onLayout }) => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const btnClass = "w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-300";

  return (
    <div className="absolute bottom-4 right-4 z-10 flex gap-2">
      <button onClick={() => zoomIn()} className={btnClass} title="Zoom In">
        <ZoomIn className="w-5 h-5" />
      </button>
      <button onClick={() => zoomOut()} className={btnClass} title="Zoom Out">
        <ZoomOut className="w-5 h-5" />
      </button>

      {/* Multi-Select Wrapper (Shared Hover Container) */}
      <div 
        className="relative flex flex-col items-center"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Popover Card (Bridged with pb-2) */}
        <div 
          className={clsx(
            "absolute bottom-full left-1/2 -translate-x-1/2 pb-2 transition-all duration-200 origin-bottom",
            (isHovered || isPinned) ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
          )}
        >
          <div className="flex gap-2">
            <div className={clsx(btnClass, "!text-slate-400 dark:!text-slate-500 font-mono font-bold text-xs select-none")} title="Selected Count">
              0
            </div>
            <button className={btnClass} title="Isolate Selected">
              <Filter className="w-5 h-5" />
            </button>
            <button className={btnClass} title="Focus Chains">
              <GitFork className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Trigger Button */}
        <button 
          onClick={() => setIsPinned(!isPinned)}
          className={clsx(
            btnClass, 
            isPinned && "!bg-indigo-50 dark:!bg-indigo-900/30 !border-indigo-200 dark:!border-indigo-800 text-indigo-600 dark:text-indigo-400"
          )}
          title="Multi-Select Tools"
        >
          <Layers className="w-5 h-5" />
        </button>
      </div>

      <button onClick={() => fitView({ duration: 500 })} className={btnClass} title="Fit View">
        <Maximize className="w-5 h-5" />
      </button>
      <button onClick={onLayout} className={btnClass} title="Auto Layout">
        <LayoutDashboard className="w-5 h-5" />
      </button>
    </div>
  );
};

export default GraphControls;
