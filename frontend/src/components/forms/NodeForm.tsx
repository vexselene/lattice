import React, { useState, useEffect } from 'react';
import { NodeType, GraphNode } from '../../types/graph';
import { createNode, updateNode, formatErrorMessage } from '../../api/nodes';
import { useGraphStore } from '../../stores/graphStore';
import PasswordGenerator from '../shared/PasswordGenerator';
import { X } from 'lucide-react';

interface NodeFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialNode?: GraphNode | null;
  initialType?: NodeType;
}

export const NodeForm: React.FC<NodeFormProps> = ({ isOpen, onClose, initialNode, initialType }) => {
  const { fetchGraph, nodes } = useGraphStore();
  const [type, setType] = useState<NodeType>(initialNode?.type || initialType || 'email');
  const [formData, setFormData] = useState<any>({});
  const [error, setError] = useState<string | null>(null);
  const [isCreatingService, setIsCreatingService] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');

  const services = nodes.filter((n) => n.type === 'service');
  
  useEffect(() => {
    setError(null);
    setNewServiceName('');
    if (initialNode) {
      setType(initialNode.type);
      setFormData(initialNode.data);
      setIsCreatingService(false);
    } else {
      const defaultType = initialType || 'email';
      setType(defaultType);
      setFormData({});
      setIsCreatingService(services.length === 0);
    }
  }, [initialNode, initialType, isOpen, services.length]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let submitData = { ...formData };

    try {
      if (type === 'account') {
        const isNewService = isCreatingService || services.length === 0;
        let targetServiceId = formData.service_id;

        if (isNewService) {
          const trimmedServiceName = newServiceName.trim();
          if (!trimmedServiceName) {
            setError('Please enter a service name');
            return;
          }

          const newService = await createNode('service', { name: trimmedServiceName });
          if (!newService || !newService.id) {
            throw new Error('Failed to create service: no ID returned');
          }
          targetServiceId = newService.id;
        }

        if (!targetServiceId) {
          setError('Please select a valid service');
          return;
        }

        submitData.service_id = targetServiceId;
      }

      let res: any;
      if (initialNode) {
        res = await updateNode(type, initialNode.data.id, submitData);
      } else {
        res = await createNode(type, submitData);
        if (type === 'account' && submitData.service_id && res?.id) {
          try {
            const { createEdge } = await import('../../api/edges');
            await createEdge({
              source_type: 'service',
              source_id: submitData.service_id,
              target_type: 'account',
              target_id: res.id,
              relation: 'registered_with',
            });
          } catch (edgeErr) {
            console.error('[NodeForm] auto-connect service edge error:', edgeErr);
          }
        }
      }
      await fetchGraph();
      onClose();
    } catch (err: any) {
      console.error('[NodeForm] Raw error:', JSON.stringify(err));
      console.error('[NodeForm] handleSubmit error:', err);
      setError(formatErrorMessage(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-w-md w-full overflow-hidden flex flex-col max-h-full">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {initialNode ? `Edit ${type} Node` : 'Create Node'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex flex-col gap-4">
          {!initialNode && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Type</span>
              <select
                value={type}
                onChange={(e) => {
                  const newType = e.target.value as NodeType;
                  setType(newType);
                  if (newType === 'account' && services.length === 0) {
                    setIsCreatingService(true);
                  }
                }}
                className="p-2 bg-slate-50 dark:bg-slate-800 border rounded text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700"
              >
                <option value="email">Email</option>
                <option value="account">Account</option>
                <option value="phone">Phone</option>
              </select>
            </label>
          )}

          {/* Type specific fields */}
          {type === 'email' && (
            <>
              <input name="address" value={formData.address || ''} onChange={handleChange} placeholder="Email Address" required className="p-2 border rounded bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
              <input name="provider" value={formData.provider || ''} onChange={handleChange} placeholder="Provider (e.g., Google)" className="p-2 border rounded bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
              <input name="password" type="password" value={formData.password || ''} onChange={handleChange} placeholder={initialNode ? "New Password (leave empty to keep)" : "Password"} className="p-2 border rounded bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
            </>
          )}

          {type === 'phone' && (
            <>
              <input name="number" value={formData.number || ''} onChange={handleChange} placeholder="Phone Number" required className="p-2 border rounded bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
              <input name="carrier" value={formData.carrier || ''} onChange={handleChange} placeholder="Carrier" className="p-2 border rounded bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
            </>
          )}

          {type === 'account' && (
            <>
              <input name="username" value={formData.username || ''} onChange={handleChange} placeholder="Username" required className="p-2 border rounded bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
              {services.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <select
                    name="service_id"
                    value={isCreatingService ? '__new__' : (formData.service_id || '')}
                    onChange={(e) => {
                      if (e.target.value === '__new__') {
                        setIsCreatingService(true);
                      } else {
                        setIsCreatingService(false);
                        handleChange(e);
                      }
                    }}
                    required={!isCreatingService}
                    className="p-2 border rounded bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                  >
                    <option value="">Select Service...</option>
                    <option value="__new__">+ Create new service...</option>
                    {services.map((s: any) => (
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
                      required
                      className="p-2 border rounded bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      autoFocus
                    />
                  )}
                </div>
              ) : (
                <input
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="Service Name (e.g. GitHub)"
                  required
                  className="p-2 border rounded bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  autoFocus
                />
              )}
              <input name="primary_email_id" value={formData.primary_email_id || ''} onChange={handleChange} placeholder="Primary Email ID (Optional)" className="p-2 border rounded bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
              <input name="password" type="password" value={formData.password || ''} onChange={handleChange} placeholder={initialNode ? "New Password (leave empty to keep)" : "Password"} className="p-2 border rounded bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
            </>
          )}

          <textarea name="notes" value={formData.notes || ''} onChange={handleChange} placeholder="Notes" className="p-2 border rounded bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white min-h-[80px]" />

          {(type === 'email' || type === 'account') && (
            <PasswordGenerator onApply={(pwd) => setFormData({ ...formData, password: pwd })} />
          )}

          {error && (
            <p className="text-xs text-red-500 font-medium">{error}</p>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">Cancel</button>
            <button
              type="submit"
              disabled={
                type === 'account' && (
                  isCreatingService || services.length === 0
                    ? !newServiceName.trim()
                    : !formData.service_id
                )
              }
              className="px-4 py-2 text-sm bg-[#4F46E5] text-white rounded hover:bg-[#4338ca] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NodeForm;
