import React, { useState, useEffect } from 'react';
import { useGraphStore } from '../../stores/graphStore';
import { useUIStore } from '../../stores/uiStore';
import { X, Trash2, Plus, Edit2 } from 'lucide-react';
import PasswordField from './PasswordField';
import ConnectionsList from './ConnectionsList';
import EdgeEditor from './EdgeEditor';
import CopyFieldButton from '../shared/CopyFieldButton';
import { Edge } from '../../types/graph';
import { EditableTags } from '../shared/EditableTags';
import { ServiceDropdown, resolveOrCreateService } from '../shared/ServiceDropdown';
import { formatErrorMessage } from '../../api/nodes';

interface NodeDetailPanelProps {
  onAddEdge: () => void;
  onEditEdge: (edge: Edge) => void;
  onDeleteEdge: (edge: Edge) => void;
  onDeleteNode: () => void;
}

export const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({
  onAddEdge,
  onEditEdge,
  onDeleteEdge,
  onDeleteNode,
}) => {
  const { selectedNode, setSelectedNode, edges, services: storeServices } = useGraphStore();
  const { isEditMode } = useUIStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [isCreatingService, setIsCreatingService] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceUrl, setNewServiceUrl] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [serviceDetails, setServiceDetails] = useState<any>(null);

  const availableServices = storeServices || [];

  const selectedNodeType = selectedNode?.type;
  const selectedServiceId = (selectedNode?.data as any)?.service_id;

  // Sync editing state when selected node changes
  useEffect(() => {
    setIsEditing(false);
    setSaveError(null);
    if (selectedNode) {
      setEditData({
        ...selectedNode.data,
        password: '',
      });
      setIsCreatingService(false);
      setNewServiceName('');
      const sid = (selectedNode.data as any)?.service_id;
      if (sid) {
        const cur = availableServices.find((s: any) => (s.id || s.data?.id) === sid);
        setNewServiceUrl(cur?.url || (cur?.data as any)?.url || (selectedNode.data as any)?.service_url || '');
      } else {
        setNewServiceUrl('');
      }
    }
  }, [selectedNode?.type, selectedNode?.data?.id]);

  // Exit edit mode if global edit mode is toggled off
  useEffect(() => {
    if (!isEditMode) {
      setIsEditing(false);
      setSaveError(null);
    }
  }, [isEditMode]);

  // Fetch linked service details if needed
  useEffect(() => {
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

  const nodeEdges = edges.filter(
    (e) => e.source_id === selectedNode.data.id || e.target_id === selectedNode.data.id
  );
  const data: any = selectedNode.data;

  const matchedService = availableServices.find((s: any) => (s.id || s.data?.id) === data.service_id);
  const serviceName = data.service_name || matchedService?.name || (matchedService?.data as any)?.name || serviceDetails?.name || '';
  const serviceUrl = data.service_url || matchedService?.url || (matchedService?.data as any)?.url || serviceDetails?.url || '';

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSaveError(null);
    setEditData({
      ...selectedNode.data,
      password: '',
    });
    setIsCreatingService(false);
    setNewServiceName('');
    setNewServiceUrl('');
  };

  const handleSaveNode = async () => {
    setSaveError(null);
    try {
      const { updateNode } = await import('../../api/nodes');

      if (selectedNode.type === 'account') {
        const trimmedUsername = (editData.username || '').trim();
        if (!trimmedUsername) {
          setSaveError('Username is required');
          return;
        }

        const targetServiceId = await resolveOrCreateService({
          serviceId: editData.service_id,
          isCreatingNew: isCreatingService,
          newServiceName,
          newServiceUrl,
          availableServices,
          nodeId: data.id,
        });

        const updated = await updateNode('account', data.id, {
          username: trimmedUsername,
          service_id: targetServiceId,
          password_raw: editData.password || undefined,
        });

        setSelectedNode({ type: 'account', data: updated.data } as any);
      } else if (selectedNode.type === 'phone') {
        const trimmedNumber = (editData.number || '').trim();
        if (!trimmedNumber) {
          setSaveError('Phone number is required');
          return;
        }
        if (!/^[\d\s+\-()./ext]+$/i.test(trimmedNumber)) {
          setSaveError('Phone number contains invalid characters');
          return;
        }

        const updated = await updateNode('phone', data.id, {
          number: trimmedNumber,
          carrier: editData.carrier?.trim() || undefined,
        });

        setSelectedNode({ type: 'phone', data: updated.data } as any);
      } else if (selectedNode.type === 'email') {
        const trimmedAddress = (editData.address || '').trim();
        if (!trimmedAddress) {
          setSaveError('Email address is required');
          return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedAddress)) {
          setSaveError('Please enter a valid email address');
          return;
        }

        const updated = await updateNode('email', data.id, {
          address: trimmedAddress,
          provider: editData.provider?.trim() || undefined,
          password_raw: editData.password || undefined,
        });

        setSelectedNode({ type: 'email', data: updated.data } as any);
      }

      await useGraphStore.getState().fetchGraph();
      setIsEditing(false);
      setIsCreatingService(false);
      setNewServiceName('');
      setNewServiceUrl('');
    } catch (err: any) {
      console.error('[NodeDetailPanel] handleSaveNode error:', err);
      setSaveError(formatErrorMessage(err));
    }
  };

  return (
    <div className="w-80 border-l border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm h-full flex flex-col shrink-0 overflow-y-auto z-20">
      <div className="flex items-center justify-between p-4 border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 bg-white dark:bg-slate-900 z-10">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100 capitalize">
          {selectedNode.type} Node
        </h2>
        <div className="flex items-center gap-2">
          {!isEditing && isEditMode && (
            <button
              onClick={() => {
                setIsEditing(true);
                setSaveError(null);
                setEditData({
                  ...selectedNode.data,
                  password: '',
                });
              }}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              title="Edit Node"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          {isEditMode && (
            <button onClick={onDeleteNode} className="text-slate-400 hover:text-red-500" title="Delete Node">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setSelectedNode(null)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* ACCOUNT NODE */}
        {selectedNode.type === 'account' && (
          isEditing ? (
            <div className="flex flex-col gap-3">
              {/* Username */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Username</label>
                <input
                  value={editData.username || ''}
                  onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                  placeholder="Username"
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-purple-500 text-slate-900 dark:text-slate-100 text-sm"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Password</label>
                <input
                  type="password"
                  value={editData.password || ''}
                  onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                  placeholder="New Password (Optional)"
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-purple-500 text-slate-900 dark:text-slate-100 text-sm"
                />
              </div>

              {/* Service */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Service</label>
                <ServiceDropdown
                  serviceId={editData.service_id || ''}
                  onSelectServiceId={(id) => setEditData({ ...editData, service_id: id })}
                  isCreatingNew={isCreatingService}
                  setIsCreatingNew={setIsCreatingService}
                  newServiceName={newServiceName}
                  setNewServiceName={setNewServiceName}
                  newServiceUrl={newServiceUrl}
                  setNewServiceUrl={setNewServiceUrl}
                  availableServices={availableServices}
                  selectClassName="text-sm py-1.5"
                  inputClassName="text-sm py-1.5"
                />
              </div>

              {/* Tags (remove-only) */}
              {data.tags && data.tags.length > 0 && (
                <div className="flex flex-col gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tags</label>
                  <EditableTags nodeId={data.id} tags={data.tags} isEditMode={true} size="sm" />
                </div>
              )}

              {saveError && (
                <p className="text-xs text-red-500 leading-tight break-words">{saveError}</p>
              )}

              <div className="flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveNode}
                  disabled={
                    !editData.username?.trim() ||
                    (isCreatingService
                      ? !newServiceName.trim()
                      : !editData.service_id)
                  }
                  className="px-3 py-1.5 text-sm bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded font-medium transition-colors shadow-sm"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* 1. Username */}
              <div className="flex flex-col group">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Username</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100 break-all">
                    {data.username || '—'}
                  </span>
                  {!!data.username && <CopyFieldButton value={data.username} />}
                </div>
              </div>

              {/* 2. Password */}
              <div className="flex flex-col group">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Password</span>
                <PasswordField nodeType="account" nodeId={data.id} />
              </div>

              {/* 3. Service name */}
              <div className="flex flex-col group">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Service Name</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm text-slate-900 dark:text-slate-100 break-all">
                    {serviceName || '—'}
                  </span>
                  {!!serviceName && <CopyFieldButton value={serviceName} />}
                </div>
              </div>

              {/* 4. Service URL */}
              <div className="flex flex-col group">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Service URL</span>
                <div className="flex items-center gap-2 mt-0.5">
                  {serviceUrl ? (
                    <a
                      href={serviceUrl.startsWith('http') ? serviceUrl : `https://${serviceUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                    >
                      {serviceUrl}
                    </a>
                  ) : (
                    <span className="text-sm text-slate-500">—</span>
                  )}
                  {!!serviceUrl && <CopyFieldButton value={serviceUrl} />}
                </div>
              </div>

              {/* 5. Tags */}
              <div className="flex flex-col group pt-1 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Tags</span>
                <EditableTags
                  nodeId={data.id}
                  tags={data.tags}
                  isEditMode={isEditMode}
                  size="sm"
                  showEmptyFallback
                />
              </div>
            </div>
          )
        )}

        {/* PHONE NODE */}
        {selectedNode.type === 'phone' && (
          isEditing ? (
            <div className="flex flex-col gap-3">
              {/* Number */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Number</label>
                <input
                  value={editData.number || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^[\d\s+\-()./ext]*$/i.test(val)) {
                      setEditData({ ...editData, number: val });
                    }
                  }}
                  placeholder="Phone Number"
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-amber-500 text-slate-900 dark:text-slate-100 text-sm"
                />
              </div>

              {/* Carrier */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Carrier</label>
                <input
                  value={editData.carrier || ''}
                  onChange={(e) => setEditData({ ...editData, carrier: e.target.value })}
                  placeholder="Carrier"
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-amber-500 text-slate-900 dark:text-slate-100 text-sm"
                />
              </div>

              {/* Tags (remove-only) */}
              {data.tags && data.tags.length > 0 && (
                <div className="flex flex-col gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tags</label>
                  <EditableTags nodeId={data.id} tags={data.tags} isEditMode={true} size="sm" />
                </div>
              )}

              {saveError && (
                <p className="text-xs text-red-500 leading-tight break-words">{saveError}</p>
              )}

              <div className="flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveNode}
                  className="px-3 py-1.5 text-sm bg-amber-600 text-white hover:bg-amber-700 rounded font-medium transition-colors shadow-sm"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* 1. Number */}
              <div className="flex flex-col group">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Number</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100 break-all">
                    {data.number || '—'}
                  </span>
                  {!!data.number && <CopyFieldButton value={data.number} />}
                </div>
              </div>

              {/* 2. Carrier */}
              <div className="flex flex-col group">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Carrier</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm text-slate-700 dark:text-slate-300 break-all">
                    {data.carrier || '—'}
                  </span>
                  {!!data.carrier && <CopyFieldButton value={data.carrier} />}
                </div>
              </div>

              {/* 3. Tags */}
              <div className="flex flex-col group pt-1 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Tags</span>
                <EditableTags
                  nodeId={data.id}
                  tags={data.tags}
                  isEditMode={isEditMode}
                  size="sm"
                  showEmptyFallback
                />
              </div>
            </div>
          )
        )}

        {/* EMAIL NODE */}
        {selectedNode.type === 'email' && (
          isEditing ? (
            <div className="flex flex-col gap-3">
              {/* Email Address */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Email Address</label>
                <input
                  value={editData.address || ''}
                  onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                  placeholder="Email Address"
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                />
              </div>

              {/* Provider */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Provider</label>
                <input
                  value={editData.provider || ''}
                  onChange={(e) => setEditData({ ...editData, provider: e.target.value })}
                  placeholder="Provider"
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Password</label>
                <input
                  type="password"
                  value={editData.password || ''}
                  onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                  placeholder="New Password (Optional)"
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                />
              </div>

              {/* Tags (remove-only) */}
              {data.tags && data.tags.length > 0 && (
                <div className="flex flex-col gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tags</label>
                  <EditableTags nodeId={data.id} tags={data.tags} isEditMode={true} size="sm" />
                </div>
              )}

              {saveError && (
                <p className="text-xs text-red-500 leading-tight break-words">{saveError}</p>
              )}

              <div className="flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveNode}
                  className="px-3 py-1.5 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded font-medium transition-colors shadow-sm"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* 1. Email address */}
              <div className="flex flex-col group">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Email Address</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100 break-all">
                    {data.address || '—'}
                  </span>
                  {!!data.address && <CopyFieldButton value={data.address} />}
                </div>
              </div>

              {/* 2. Provider */}
              <div className="flex flex-col group">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Provider</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm text-slate-700 dark:text-slate-300 break-all">
                    {data.provider || '—'}
                  </span>
                  {!!data.provider && <CopyFieldButton value={data.provider} />}
                </div>
              </div>

              {/* 3. Password */}
              <div className="flex flex-col group">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Password</span>
                <PasswordField nodeType="email" nodeId={data.id} />
              </div>

              {/* 4. Tags */}
              <div className="flex flex-col group pt-1 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Tags</span>
                <EditableTags
                  nodeId={data.id}
                  tags={data.tags}
                  isEditMode={isEditMode}
                  size="sm"
                  showEmptyFallback
                />
              </div>
            </div>
          )
        )}

        {/* SERVICE NODE & OTHER FALLBACK */}
        {selectedNode.type !== 'account' && selectedNode.type !== 'phone' && selectedNode.type !== 'email' && (
          <div className="flex flex-col gap-3">
            {Object.entries(data).map(([k, v]) => {
              if (k === 'id' || k === 'password_encrypted' || k === 'created_at' || k === 'updated_at' || k === 'tags') return null;
              return (
                <div key={k} className="flex flex-col group">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{k.replace('_', ' ')}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm text-slate-900 dark:text-slate-100 break-all">{String(v || '—')}</span>
                    {!!v && <CopyFieldButton value={String(v)} />}
                  </div>
                </div>
              );
            })}
            <div className="flex flex-col group pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Tags</span>
              <EditableTags nodeId={data.id} tags={data.tags} isEditMode={isEditMode} size="sm" showEmptyFallback />
            </div>
          </div>
        )}

        {/* CONNECTIONS SECTION */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Connections</h3>
            {isEditMode && (
              <button
                onClick={onAddEdge}
                className="p-1 rounded bg-[#4F46E5]/10 text-[#4F46E5] hover:bg-[#4F46E5]/20"
                title="Add Connection"
              >
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
