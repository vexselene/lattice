import { useEffect, useState } from 'react';
import { useAuthStore } from './stores/authStore';
import { useUIStore } from './stores/uiStore';
import { useGraphStore } from './stores/graphStore';
import UnlockScreen from './components/auth/UnlockScreen';
import AutoLockTimer from './components/auth/AutoLockTimer';
import TopBar from './components/layout/TopBar';
import GraphCanvas from './components/graph/GraphCanvas';
import NodeDetailPanel from './components/sidebar/NodeDetailPanel';
import NodeForm from './components/forms/NodeForm';
import EdgeForm from './components/forms/EdgeForm';
import ConfirmDialog from './components/shared/ConfirmDialog';
import { Edge, GraphNode, NodeType } from './types/graph';
import { Plus } from 'lucide-react';

function App() {
  const { isUnlocked } = useAuthStore();
  const { theme } = useUIStore();
  const { fetchGraph, deleteNode, deleteEdge: storeDeleteEdge } = useGraphStore();

  const [nodeFormOpen, setNodeFormOpen] = useState(false);
  const [nodeFormNode, setNodeFormNode] = useState<GraphNode | null>(null);
  const [nodeFormType, setNodeFormType] = useState<NodeType | undefined>();

  const [edgeFormOpen, setEdgeFormOpen] = useState(false);
  const [edgeFormEdge, setEdgeFormEdge] = useState<Edge | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{ title: string; message: string; action: () => void } | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if (isUnlocked) {
      fetchGraph();
    }
  }, [isUnlocked, fetchGraph]);

  const handleCreateNode = () => {
    setNodeFormNode(null);
    setNodeFormType(undefined);
    setNodeFormOpen(true);
  };

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

  if (!isUnlocked) {
    return (
      <>
        <AutoLockTimer />
        <UnlockScreen />
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 transition-colors">
      <AutoLockTimer />
      <TopBar />
      
      <div className="flex flex-1 overflow-hidden relative">
        <GraphCanvas />
        <NodeDetailPanel 
          onEditNode={() => {
            // we have selectedNode in store, NodeDetailPanel assumes it's set
            // Let's get it from store
            const selected = useGraphStore.getState().selectedNode;
            if (selected) {
              setNodeFormNode(selected);
              setNodeFormOpen(true);
            }
          }}
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

        {/* FAB for creating nodes */}
        <button
          onClick={handleCreateNode}
          className="absolute bottom-6 left-6 p-4 bg-[#4F46E5] text-white rounded-full shadow-lg hover:bg-[#4338ca] transition-colors z-10"
          title="Create Node"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <NodeForm 
        isOpen={nodeFormOpen} 
        onClose={() => setNodeFormOpen(false)} 
        initialNode={nodeFormNode} 
        initialType={nodeFormType} 
      />
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
    </div>
  );
}

export default App;
