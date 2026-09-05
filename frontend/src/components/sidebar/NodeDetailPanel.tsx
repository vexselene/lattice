import React from 'react';
import { useGraphStore } from '../../stores/graphStore';
import { useUIStore } from '../../stores/uiStore';
import { X, Trash2, Plus } from 'lucide-react';
import PasswordField from './PasswordField';
import ConnectionsList from './ConnectionsList';
import EdgeEditor from './EdgeEditor';
import CopyFieldButton from '../shared/CopyFieldButton';
import { Edge } from '../../types/graph';

interface NodeDetailPanelProps {
  onAddEdge: () => void;
  onEditEdge: (edge: Edge) => void;
  onDeleteEdge: (edge: Edge) => void;
  onDeleteNode: () => void;
}

export const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({ onAddEdge, onEditEdge, onDeleteEdge, onDeleteNode }) => {
  const { selectedNode, setSelectedNode, edges } = useGraphStore();
  const { isEditMode } = useUIStore();
  const [serviceDetails, setServiceDetails] = React.useState<any>(null);

  const selectedNodeType = selectedNode?.type;
  const selectedServiceId = (selectedNode?.data as any)?.service_id;

  React.useEffect(() => {
    let isCurrent = true;
    if (selectedNodeType === 'account' && selectedServiceId) {
      import('../../api/nodes').then(({ getNode }) => {
        getNode('service', selectedServiceId)
          .then((res) => {
            if (isCurrent) setServiceDetails(res);
          })
          .catch((err) => {
            console.error('[NodeDetailPanel] failed to fetch service details:', err);
            if (isCurrent) setServiceDetails(null);
          });
      });
    } else {
      setServiceDetails(null);
    }
    return () => {
      isCurrent = false;
    };
  }, [selectedNodeType, selectedServiceId]);

  if (!selectedNode) return null;

  const nodeEdges = edges.filter(e => e.source_id === selectedNode.data.id || e.target_id === selectedNode.data.id);
  const data: any = selectedNode.data;

  return (
    <div className="w-80 border-l border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm h-full flex flex-col shrink-0 overflow-y-auto z-20">
      <div className="flex items-center justify-between p-4 border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 bg-transparent z-10">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100 capitalize">{selectedNode.type} Node</h2>
        <div className="flex gap-2">
          {isEditMode && <button onClick={onDeleteNode} className="text-slate-400 hover:text-red-500" title="Delete Node"><Trash2 className="w-4 h-4" /></button>}
          <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {selectedNode.type === 'account' ? (
          <div className="flex flex-col gap-4">
            {/* Account Fields */}
            <div className="flex flex-col gap-2.5">
              <h3 className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                Account Details
              </h3>

              <div className="flex flex-col group">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Username</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100 break-all">{data.username || '—'}</span>
                  {!!data.username && <CopyFieldButton value={data.username} />}
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Password</span>
                <PasswordField nodeType="account" nodeId={data.id} />
              </div>

              <div className="flex flex-col group">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Notes</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-700 dark:text-slate-300 break-words whitespace-pre-wrap">{data.notes || '—'}</span>
                  {!!data.notes && <CopyFieldButton value={data.notes} />}
                </div>
              </div>

              <div className="flex flex-col group">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tags</span>
                {data.tags && data.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {data.tags.map((tag: string) => (
                      <span key={tag} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs rounded-md">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-slate-500">—</span>
                )}
              </div>

              {data.primary_email_id && (
                <div className="flex flex-col group">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Primary Email ID</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-700 dark:text-slate-300 break-all">{data.primary_email_id}</span>
                    <CopyFieldButton value={data.primary_email_id} />
                  </div>
                </div>
              )}
            </div>

            {/* Linked Service Fields */}
            {(data.service_id || data.service_name || serviceDetails) && (
              <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: serviceDetails?.color || data.service_color || '#3B82F6' }}
                  />
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Linked Service
                  </h3>
                </div>

                <div className="flex flex-col group">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Name</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 break-all">
                      {serviceDetails?.name || data.service_name || data.service_id || '—'}
                    </span>
                    {!!(serviceDetails?.name || data.service_name) && (
                      <CopyFieldButton value={serviceDetails?.name || data.service_name} />
                    )}
                  </div>
                </div>

                <div className="flex flex-col group">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Color</span>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-700 shrink-0"
                      style={{ backgroundColor: serviceDetails?.color || data.service_color || '#3B82F6' }}
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300 font-mono">
                      {serviceDetails?.color || data.service_color || '—'}
                    </span>
                    {!!(serviceDetails?.color || data.service_color) && (
                      <CopyFieldButton value={serviceDetails?.color || data.service_color} />
                    )}
                  </div>
                </div>

                <div className="flex flex-col group">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Category</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {serviceDetails?.category || '—'}
                    </span>
                    {!!serviceDetails?.category && <CopyFieldButton value={serviceDetails.category} />}
                  </div>
                </div>

                <div className="flex flex-col group">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">URL</span>
                  <div className="flex items-center gap-2">
                    {serviceDetails?.url ? (
                      <a
                        href={serviceDetails.url.startsWith('http') ? serviceDetails.url : `https://${serviceDetails.url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                      >
                        {serviceDetails.url}
                      </a>
                    ) : (
                      <span className="text-sm text-slate-500">—</span>
                    )}
                    {!!serviceDetails?.url && <CopyFieldButton value={serviceDetails.url} />}
                  </div>
                </div>

                <div className="flex flex-col group">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Icon</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-700 dark:text-slate-300 break-all">
                      {serviceDetails?.icon_url || '—'}
                    </span>
                    {!!serviceDetails?.icon_url && <CopyFieldButton value={serviceDetails.icon_url} />}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {Object.entries(data).map(([k, v]) => {
              if (k === 'id' || k === 'password_encrypted' || k === 'created_at' || k === 'updated_at') return null;
              return (
                <div key={k} className="flex flex-col group">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{k.replace('_', ' ')}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-900 dark:text-slate-100 break-all">{String(v || '—')}</span>
                    {!!v && <CopyFieldButton value={String(v)} />}
                  </div>
                </div>
              );
            })}

            {('password_encrypted' in data) && (
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Password</span>
                <PasswordField nodeType={selectedNode.type} nodeId={data.id} />
              </div>
            )}
          </div>
        )}

        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Connections</h3>
            {isEditMode && (
              <button onClick={onAddEdge} className="p-1 rounded bg-[#4F46E5]/10 text-[#4F46E5] hover:bg-[#4F46E5]/20" title="Add Connection">
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
          <ConnectionsList edges={nodeEdges} nodeId={data.id} />
        </div>

        <EdgeEditor edges={nodeEdges} onEdit={onEditEdge} onDelete={onDeleteEdge} />
      </div>
    </div>
  );
};

export default NodeDetailPanel;
