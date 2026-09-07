import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, useStore } from '@xyflow/react';
import { AccountNode as AccountNodeType } from '../../../types/graph';
import { User, Edit2, PanelRight, Trash2, X } from 'lucide-react';
import { useGraphStore } from '../../../stores/graphStore';
import { useUIStore } from '../../../stores/uiStore';
import CopyFieldButton from '../../shared/CopyFieldButton';
import PasswordField from '../../sidebar/PasswordField';
import clsx from 'clsx';
import { useNodeVisualState } from '../../../hooks/useVisualState';

import { NodeVisualState } from '../../../hooks/useVisualState';
import { AccountNodeExport } from './AccountNodeExport';

import { formatErrorMessage } from '../../../api/nodes';

export interface AccountNodeProps {
  data: AccountNodeType;
  id: string;
  exportMode?: boolean;
  theme?: 'dark' | 'light';
  visualState?: NodeVisualState;
}

export const AccountNode: React.FC<AccountNodeProps> = (props) => {
  const { data, id: _id, exportMode } = props;

  const { nodes: storeNodes, removeTempNode, deleteNode, setSelectedNode, collapseAllSignal, setExpandedNodeId, expandedNodeId } = useGraphStore();

  const availableServices = React.useMemo(() => {
    return storeNodes.filter((n) => n.type === 'service' && !(n.data as any).isEditing);
  }, [storeNodes]);

  const initialServiceId = React.useMemo(() => {
    if (data.service_id) return data.service_id;
    if ((data as any).pendingConnection) {
      const pc = (data as any).pendingConnection;
      if (pc.sourceType === 'service' && pc.sourceId) return pc.sourceId;
      if (pc.targetType === 'service' && pc.targetId) return pc.targetId;
    }
    return '';
  }, [data]);

  const [isExpanded, setIsExpanded] = useState((data as any).isExpanded || false);
  const [isEditing, setIsEditing] = useState((data as any).isEditing || false);
  const [editData, setEditData] = useState({
    username: data.username || '',
    service_id: initialServiceId,
    password: ''
  });
  const [isCreatingService, setIsCreatingService] = useState(
    availableServices.length === 0 && !initialServiceId
  );
  const [newServiceName, setNewServiceName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);


  useEffect(() => {
    if ((data as any).isEditing) {
      if (initialServiceId) {
        setEditData((prev) => ({ ...prev, service_id: initialServiceId }));
        setIsCreatingService(false);
      } else if (availableServices.length === 0) {
        setIsCreatingService(true);
      }
    }
  }, [(data as any).isEditing, initialServiceId, availableServices.length]);
  const { isEditMode: globalEditMode } = useUIStore();
  const connectionInProgress = useStore((s) => s.connection.inProgress);
  const isConnecting = connectionInProgress;

  const { opacity, filter, ringClass, isDimmed, isVisible } = useNodeVisualState(data.id, 'account');
  const isModalOpen = (data as any).isModalOpen === true;

  const prevCollapseSignal = useRef(collapseAllSignal);
  useEffect(() => {
    if (exportMode) return;
    if (collapseAllSignal !== prevCollapseSignal.current) {
      prevCollapseSignal.current = collapseAllSignal;
      if (!isEditing) { setIsExpanded(false); setExpandedNodeId(null); }
    }
  }, [collapseAllSignal, isEditing, setExpandedNodeId, exportMode]);

  useEffect(() => {
    if (exportMode) return;
    if (expandedNodeId !== data.id && !isEditing && isExpanded) {
      setIsExpanded(false);
    }
  }, [expandedNodeId, data.id, isEditing, isExpanded, exportMode]);

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setIsExpanded(true);
  };

  const handleOpenSidebar = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedNode({ type: 'account', data } as any);
  };




  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if ((data as any).isEditing) {
      removeTempNode(data.id);
    } else {
      deleteNode('account', data.id);
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaveError(null);

    const trimmedUsername = editData.username.trim();
    if (!trimmedUsername) {
      setSaveError('Username is required');
      return;
    }

    const isNewService = isCreatingService || availableServices.length === 0;
    const trimmedNewServiceName = newServiceName.trim();

    if (isNewService && !trimmedNewServiceName) {
      setSaveError('Please enter a service name');
      return;
    }
    if (!isNewService && !editData.service_id) {
      setSaveError('Please select a valid service');
      return;
    }

    try {
      const isNew = (data as any).isEditing;
      const { createNode, updateNode } = await import('../../../api/nodes');

      let targetServiceId = editData.service_id;

      // 1. If creating a new service inline, create it first
      if (isNewService) {
        const savedPositions = JSON.parse(localStorage.getItem('node_positions') || '{}');
        const currentPos = savedPositions[data.id] || { x: 100, y: 100 };
        const serviceX = currentPos.x - 220;
        const serviceY = currentPos.y;

        const newService = await createNode('service', {
          name: trimmedNewServiceName,
          position_x: serviceX,
          position_y: serviceY
        });

        if (!newService || !newService.id) {
          throw new Error('Failed to create service: no ID returned');
        }

        targetServiceId = newService.id;

        if (savedPositions[data.id]) {
          savedPositions[newService.id] = { x: serviceX, y: serviceY };
          localStorage.setItem('node_positions', JSON.stringify(savedPositions));
        }
      }

      // 2. Create or update the account with targetServiceId
      if (isNew) {
        const res = await createNode('account', {
          username: trimmedUsername,
          service_id: targetServiceId,
          password_raw: editData.password || undefined
        });
        const savedPositions = JSON.parse(localStorage.getItem('node_positions') || '{}');
        if (savedPositions[data.id]) {
          savedPositions[res.id] = savedPositions[data.id];
          delete savedPositions[data.id];
          localStorage.setItem('node_positions', JSON.stringify(savedPositions));
        }
        removeTempNode(data.id);
        
        let serviceConnected = false;
        if ((data as any).pendingConnection) {
          const { createEdge } = await import('../../../api/edges');
          const pc = (data as any).pendingConnection;
          if (pc.sourceId) {
            // Dragged from source handle: existing node → new account node
            await createEdge({
              source_type: pc.sourceType,
              source_id: pc.sourceId,
              target_type: 'account',
              target_id: res.id,
              relation: 'registered_with'
            });
            if (pc.sourceType === 'service' && pc.sourceId === targetServiceId) {
              serviceConnected = true;
            }
          } else if (pc.targetId) {
            // Dragged from target handle: new account node → existing node
            await createEdge({
              source_type: 'account',
              source_id: res.id,
              target_type: pc.targetType,
              target_id: pc.targetId,
              relation: 'registered_with'
            });
            if (pc.targetType === 'service' && pc.targetId === targetServiceId) {
              serviceConnected = true;
            }
          }
        }
        // Auto-connect to selected/new service if not already connected
        if (!serviceConnected && targetServiceId) {
          try {
            const { createEdge } = await import('../../../api/edges');
            await createEdge({
              source_type: 'service',
              source_id: targetServiceId,
              target_type: 'account',
              target_id: res.id,
              relation: 'registered_with'
            });
          } catch (edgeErr) {
            console.error('[AccountNode] auto-connect service edge error:', edgeErr);
          }
        }
      } else {
        await updateNode('account', data.id, {
          username: trimmedUsername,
          service_id: targetServiceId,
          password_raw: editData.password || undefined
        });
      }
      await useGraphStore.getState().fetchGraph();
      setIsEditing(false);
      setIsCreatingService(false);
      setNewServiceName('');
    } catch (err: any) {
      console.error('[AccountNode] Raw error:', JSON.stringify(err));
      console.error('[AccountNode] handleSave error:', err);
      setSaveError(formatErrorMessage(err));
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    if ((data as any).isEditing) {
      removeTempNode(data.id);
    } else {
      setIsEditing(false);
      setEditData({ username: data.username || '', service_id: data.service_id || '', password: '' });
      setIsCreatingService(false);
      setNewServiceName('');
      setSaveError(null);
    }
  };

  if (exportMode) {
    return <AccountNodeExport {...props} />;
  }

  if (!isVisible) return null;

  const hasService = Boolean(data.service_name || (data as any).service_name);
  const serviceName = data.service_name || (data as any).service_name || '';
  const serviceColor = data.service_color || (data as any).service_color || '#3B82F6';
  const isRightExpanded = hasService && (isPinned || isHovered);

  return (
    <div
      style={{
        opacity,
        filter,
      }}
      className={clsx(
        'relative flex flex-col w-max max-w-[320px] transition-all duration-300 ease-out',
        isDimmed && isModalOpen ? 'pointer-events-none' : 'cursor-pointer'
      )}
      onDoubleClick={(e) => {
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('cancel-node-click'));
        if (!isEditing) {
          const nextState = !isExpanded;
          setIsExpanded(nextState);
          if (nextState) {
            setExpandedNodeId(data.id);
          } else {
            setExpandedNodeId(null);
          }
        }
      }}
    >
      {/* Pill row — handles are anchored HERE so they never shift */}
      <div
        className={clsx(
          "group relative flex items-center cursor-pointer transition-all duration-150 ease-out select-none",
          ringClass
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Handle
          type="target"
          position={Position.Left}
          id="target-left"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className={clsx(
            "w-2.5 h-2.5 !bg-slate-400 transition-opacity duration-200 z-20",
            isConnecting ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="source-right"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className={clsx(
            "w-2.5 h-2.5 !bg-slate-400 transition-opacity duration-200 z-20",
            isConnecting ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        />

        {/* Fused single pill container — no gap or border between the two color zones */}
        <div
          className={clsx(
            "rounded-full flex items-stretch overflow-hidden border border-purple-200/80 dark:border-purple-800/60 drop-shadow-[0_2px_8px_rgba(168,85,247,0.15)] dark:drop-shadow-none transition-all duration-200 max-w-[300px]",
            isPinned && "ring-2 ring-purple-400/80 dark:ring-purple-500/80 ring-offset-1 dark:ring-offset-slate-900"
          )}
        >
          {/* Left segment - Account */}
          <div
            className={clsx(
              "py-1.5 pl-3 flex items-center gap-2 bg-purple-50 text-purple-950 dark:bg-purple-950 dark:text-purple-200 shrink-0",
              hasService ? "pr-2" : "pr-3"
            )}
          >
            <div className="p-1 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300 flex-shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm font-medium tracking-tight truncate max-w-[150px]">
              {isEditing ? (editData.username || 'New Account') : (data.username || 'New Account')}
            </span>
          </div>

          {/* Right segment - Linked Service */}
          {hasService && (
            <div
              className={clsx(
                "flex items-center transition-all duration-300 ease-in-out overflow-hidden shrink-0 relative pr-1",
                isRightExpanded ? "max-w-[140px] pl-2.5" : "max-w-[8px] pl-0"
              )}
              style={{
                backgroundColor: serviceColor,
              }}
              title={isPinned ? `Pinned: ${serviceName} (Click to collapse)` : `${serviceName} (Click to pin open)`}
            >
              <span
                className={clsx(
                  "text-xs font-semibold text-white tracking-wide truncate whitespace-nowrap transition-opacity duration-200",
                  isRightExpanded ? "opacity-100 delay-100" : "opacity-0 pointer-events-none w-0 inline-block"
                )}
              >
                {serviceName}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setIsPinned(p => !p); }}
                className={clsx(
                  "ml-1 p-0.5 rounded-full text-white/70 hover:text-white hover:bg-white/20 transition-all z-20",
                  isRightExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                title={isPinned ? "Unpin service" : "Pin service open"}
              >
                <div className={clsx("w-2.5 h-2.5 border-2 border-current rounded-full", isPinned ? "bg-current" : "bg-transparent")} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        className={clsx(
          'absolute top-full left-1/2 -translate-x-1/2 overflow-hidden transition-all duration-300 ease-out z-10',
          isExpanded ? 'max-h-[400px] opacity-100 mt-1.5' : 'max-h-0 opacity-0 mt-0'
        )}
      >
        <div
          className="rounded-xl p-2 border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-1 cursor-default w-max min-w-[120px] max-w-[220px] text-xs"
          onClick={(e) => e.stopPropagation()}
        >

          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-purple-100/80 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 text-[10px] font-bold uppercase tracking-widest">
              Account
            </span>
            <div className="flex items-center gap-1">
              {(!isEditing && globalEditMode) && (
                <button onClick={handleEdit} className="p-1 text-slate-400 hover:text-purple-600 transition-colors" title="Edit Node">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              {!isEditing && (
                <button onClick={handleOpenSidebar} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" title="Open Detail Panel">
                  <PanelRight className="w-3.5 h-3.5" />
                </button>
              )}
              {(!isEditing && globalEditMode) && (
                <button onClick={handleDelete} className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="Delete Node">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {isEditing ? (
            <div className="flex flex-col gap-2 w-full min-w-0 mt-1">
              <input
                value={editData.username}
                onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                placeholder="Username"
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-purple-500 text-slate-900 dark:text-slate-100"
              />
              {availableServices.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <select
                    value={isCreatingService ? '__new__' : editData.service_id}
                    onChange={(e) => {
                      if (e.target.value === '__new__') {
                        setIsCreatingService(true);
                      } else {
                        setIsCreatingService(false);
                        setEditData({ ...editData, service_id: e.target.value });
                      }
                    }}
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-purple-500 text-slate-900 dark:text-slate-100 text-xs"
                  >
                    <option value="">Select Service...</option>
                    <option value="__new__">+ Create new service...</option>
                    {availableServices.map((s: any) => (
                      <option key={s.data.id} value={s.data.id}>
                        {s.data.name || s.data.id}
                      </option>
                    ))}
                  </select>
                  {isCreatingService && (
                    <input
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      placeholder="New Service Name"
                      className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-purple-500 text-slate-900 dark:text-slate-100 text-xs"
                      autoFocus
                    />
                  )}
                </div>
              ) : (
                <input
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="Service Name (e.g. GitHub)"
                  className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-purple-500 text-slate-900 dark:text-slate-100 text-xs"
                  autoFocus
                />
              )}
              <input
                type="password"
                value={editData.password}
                onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                placeholder="Password (Optional)"
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-purple-500 text-slate-900 dark:text-slate-100"
              />
              {saveError && (
                <p className="text-[10px] text-red-500 leading-tight break-words">{saveError}</p>
              )}
              <div className="flex gap-2 justify-end mt-2">
                <button
                  onClick={handleCancel}
                  className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={
                    !editData.username.trim() ||
                    (isCreatingService || availableServices.length === 0
                      ? !newServiceName.trim()
                      : !editData.service_id)
                  }
                  className="px-3 py-1.5 bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded font-medium transition-colors shadow-sm"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              {('password_encrypted' in data && data.password_encrypted) && (
                <div className="mb-2">
                  <span className="text-[11px] font-medium leading-tight text-slate-500 mb-1 block">Account Password</span>
                  <PasswordField nodeType="account" nodeId={data.id} />
                </div>
              )}
              
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-col gap-1 group">
                  <span className="text-[11px] font-medium leading-tight text-slate-500">Linked Service</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-700 dark:text-slate-300 break-all">
                      {(availableServices.find((s) => s.data.id === data.service_id)?.data as any)?.name || data.service_id || '—'}
                    </span>
                    {!!data.service_id && <CopyFieldButton value={data.service_id} />}
                  </div>
                </div>

                {hasService && (availableServices.find((s) => s.data.id === data.service_id)?.data as any)?.category && (
                  <div className="flex flex-col gap-1 group">
                    <span className="text-[11px] font-medium leading-tight text-slate-500">Category</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-700 dark:text-slate-300 break-all">
                        {(availableServices.find((s) => s.data.id === data.service_id)?.data as any)?.category}
                      </span>
                      <CopyFieldButton value={(availableServices.find((s) => s.data.id === data.service_id)?.data as any)?.category} />
                    </div>
                  </div>
                )}

                {hasService && (availableServices.find((s) => s.data.id === data.service_id)?.data as any)?.url && (
                  <div className="flex flex-col gap-1 group">
                    <span className="text-[11px] font-medium leading-tight text-slate-500">URL</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-700 dark:text-slate-300 break-all">
                        {(availableServices.find((s) => s.data.id === data.service_id)?.data as any)?.url}
                      </span>
                      <CopyFieldButton value={(availableServices.find((s) => s.data.id === data.service_id)?.data as any)?.url} />
                    </div>
                  </div>
                )}
              </div>

              {data.tags && data.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                  {data.tags.map(tag => (
                    <span key={tag} className={`group/tag relative pl-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] uppercase tracking-wider font-bold rounded-md pr-1.5 transition-all duration-200 ease-out ${globalEditMode ? 'hover:pr-6' : ''}`}>
                      {tag}
                      {globalEditMode && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); useGraphStore.getState().removeTag(data.id, tag); }}
                          className="absolute top-1/2 -translate-y-1/2 right-0.5 text-slate-400 hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all opacity-0 group-hover/tag:opacity-100 flex items-center justify-center p-0.5 rounded-full z-10"
                          title="Remove Tag"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountNode;
