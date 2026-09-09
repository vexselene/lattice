import { useEffect, useState } from 'react';
import { useAuthStore } from './stores/authStore';
import { useUIStore } from './stores/uiStore';
import { useGraphStore } from './stores/graphStore';
import UnlockScreen from './components/auth/UnlockScreen';
import AutoLockTimer from './components/auth/AutoLockTimer';
import TopBar from './components/layout/TopBar';
import GraphCanvas from './components/graph/GraphCanvas';
import NodeDetailPanel from './components/sidebar/NodeDetailPanel';
import EdgeForm from './components/forms/EdgeForm';
import ConfirmDialog from './components/shared/ConfirmDialog';
import { Edge, GraphNode } from './types/graph';
import { Plus, Mail, User, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useCanvasStore } from './stores/canvasStore';
import CanvasGrid from './components/grid/CanvasGrid';

function App() {
  const { isUnlocked } = useAuthStore();
  const { activeCanvasId, fetchCanvases } = useCanvasStore();
  const { theme, isEditMode } = useUIStore();
  const { fetchGraph, deleteNode, deleteEdge: storeDeleteEdge } = useGraphStore();

  const [edgeFormOpen, setEdgeFormOpen] = useState(false);
  const [edgeFormEdge, setEdgeFormEdge] = useState<Edge | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{ title: string; message: string; action: () => void } | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // When transitioning into state 2 for the first time after vault unlock,
  // call canvasStore.fetchCanvases() once so the grid has data without a manual refresh
  useEffect(() => {
    if (isUnlocked) {
      fetchCanvases();
    }
  }, [isUnlocked, fetchCanvases]);

  // When a canvas is active, fetch its graph data
  useEffect(() => {
    if (isUnlocked && activeCanvasId) {
      fetchGraph();
    }
  }, [isUnlocked, activeCanvasId, fetchGraph]);

  const handleDeleteNode = (node: GraphNode) => {
    setConfirmData({
      title: 'Delete Node',
      message: 'Are you sure you want to delete this node and all its connections?',
      action: async () => {
        await deleteNode(node.type, node.data.id);
        setConfirmOpen(false);
      }
    });
    setConfirmOpen(true);
  };

  const handleDeleteEdge = (edge: Edge) => {
    setConfirmData({
      title: 'Delete Connection',
      message: 'Are you sure you want to delete this connection?',
      action: async () => {
        await storeDeleteEdge(edge.id);
        setConfirmOpen(false);
      }
    });
    setConfirmOpen(true);
  };

  // State 1: Vault locked -> UnlockScreen
  if (!isUnlocked) {
    return (
      <>
        <AutoLockTimer />
        <UnlockScreen />
      </>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#F8FAFC] dark:bg-[#0B0F19]">
      <AutoLockTimer />
      <CanvasGrid />

      <AnimatePresence>
        {activeCanvasId !== null && (
          <motion.div
            key="graph-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex flex-col bg-[#F8FAFC] dark:bg-[#0B0F19] overflow-hidden text-slate-900 dark:text-slate-100 transition-colors"
          >
            <TopBar />
      
      <div className="flex flex-1 overflow-hidden relative">
        <GraphCanvas />
        <NodeDetailPanel 
          onAddEdge={() => {
            setEdgeFormEdge(null);
            setEdgeFormOpen(true);
          }}
          onEditEdge={(edge) => {
            setEdgeFormEdge(edge);
            setEdgeFormOpen(true);
          }}
          onDeleteEdge={handleDeleteEdge}
          onDeleteNode={() => {
            const selected = useGraphStore.getState().selectedNode;
            if (selected) handleDeleteNode(selected);
          }}
        />

        {/* Speed-Dial FAB */}
        {isEditMode && (
          <div className="absolute bottom-6 left-6 flex flex-col items-center gap-3 z-20 group">
            <div className="flex flex-col gap-3 transition-all duration-300 ease-out origin-bottom scale-0 opacity-0 translate-y-8 pointer-events-none group-hover:scale-100 group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto">
              <button draggable onDragStart={(e) => e.dataTransfer.setData('application/reactflow/type', 'phone')} className="relative group/btn p-2.5 rounded-full shadow-md bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700/50 transition-colors cursor-grab active:cursor-grabbing">
                <Smartphone className="w-5 h-5" />
                <span className="absolute left-full ml-3 px-2 py-1 rounded bg-slate-800 text-white text-[11px] font-medium tracking-wide opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap">Phone</span>
              </button>
              <button draggable onDragStart={(e) => e.dataTransfer.setData('application/reactflow/type', 'account')} className="relative group/btn p-2.5 rounded-full shadow-md bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700/50 transition-colors cursor-grab active:cursor-grabbing">
                <User className="w-5 h-5" />
                <span className="absolute left-full ml-3 px-2 py-1 rounded bg-slate-800 text-white text-[11px] font-medium tracking-wide opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap">Account</span>
              </button>
              <button draggable onDragStart={(e) => e.dataTransfer.setData('application/reactflow/type', 'email')} className="relative group/btn p-2.5 rounded-full shadow-md bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-700/50 transition-colors cursor-grab active:cursor-grabbing">
                <Mail className="w-5 h-5" />
                <span className="absolute left-full ml-3 px-2 py-1 rounded bg-slate-800 text-white text-[11px] font-medium tracking-wide opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap">Email</span>
              </button>
            </div>
            <div
              className="p-3.5 bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer"
              title="Create Node"
            >
              <Plus className="w-5 h-5 transition-transform duration-300 group-hover:rotate-45" />
            </div>
          </div>
        )}
      </div>

      <EdgeForm 
        isOpen={edgeFormOpen} 
        onClose={() => setEdgeFormOpen(false)} 
        initialEdge={edgeFormEdge} 
      />
      <ConfirmDialog 
        isOpen={confirmOpen} 
        title={confirmData?.title || ''} 
        message={confirmData?.message || ''} 
        onConfirm={() => confirmData?.action()} 
        onCancel={() => setConfirmOpen(false)} 
      />
    </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
