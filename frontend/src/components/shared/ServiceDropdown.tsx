import React, { useMemo } from 'react';
import clsx from 'clsx';

export interface ServiceDropdownProps {
  serviceId: string;
  onSelectServiceId: (id: string) => void;
  isCreatingNew: boolean;
  setIsCreatingNew: (creating: boolean) => void;
  newServiceName: string;
  setNewServiceName: (name: string) => void;
  newServiceUrl?: string;
  setNewServiceUrl?: (url: string) => void;
  availableServices?: any[];
  selectClassName?: string;
  inputClassName?: string;
}

export const ServiceDropdown: React.FC<ServiceDropdownProps> = ({
  serviceId,
  onSelectServiceId,
  isCreatingNew,
  setIsCreatingNew,
  newServiceName,
  setNewServiceName,
  newServiceUrl = '',
  setNewServiceUrl,
  availableServices = [],
  selectClassName,
  inputClassName,
}) => {
  const defaultSelectClass =
    'w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-purple-500 text-slate-900 dark:text-slate-100 text-xs';
  const defaultInputClass =
    'w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded outline-none focus:border-purple-500 text-slate-900 dark:text-slate-100 text-xs';

  // Normalize services so both flat objects { id, name, url } and graph nodes { data: { id, name, url } } work
  const normalizedServices = useMemo(() => {
    return (availableServices || []).map((s: any) => ({
      id: String(s.id || s.data?.id || ''),
      name: String(s.name || s.data?.name || s.id || s.data?.id || ''),
      url: String(s.url || s.data?.url || ''),
    })).filter((s) => Boolean(s.id));
  }, [availableServices]);

  // Selected service if one is chosen
  const selectedService = useMemo(() => {
    return normalizedServices.find((s) => s.id === serviceId);
  }, [normalizedServices, serviceId]);

  // Keep URL in sync when existing service is selected
  const displayedUrl = isCreatingNew ? newServiceUrl : (selectedService?.url || newServiceUrl || '');

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {/* 1. Service Dropdown (ALWAYS visible) */}
      <select
        value={isCreatingNew ? '__new__' : (serviceId || '')}
        onChange={(e) => {
          const val = e.target.value;
          if (val === '__new__') {
            setIsCreatingNew(true);
            onSelectServiceId('');
            if (setNewServiceUrl) setNewServiceUrl('');
          } else {
            setIsCreatingNew(false);
            onSelectServiceId(val);
            const matched = normalizedServices.find((s) => s.id === val);
            if (setNewServiceUrl) {
              setNewServiceUrl(matched?.url || '');
            }
          }
        }}
        className={clsx(defaultSelectClass, selectClassName)}
      >
        <option value="">Select Service...</option>
        <option value="__new__">+ Create new service...</option>
        {normalizedServices.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      {/* 2. When creating a new service inline */}
      {isCreatingNew && (
        <div className="flex flex-col gap-1.5 p-2 bg-slate-50/50 dark:bg-slate-900/50 rounded border border-purple-200 dark:border-purple-900/50">
          <input
            value={newServiceName}
            onChange={(e) => {
              const val = e.target.value;
              setNewServiceName(val);
              // Auto-fill URL if the typed name matches an existing service case-insensitively
              const matched = normalizedServices.find(
                (s) => s.name.trim().toLowerCase() === val.trim().toLowerCase()
              );
              if (matched && setNewServiceUrl && matched.url) {
                setNewServiceUrl(matched.url);
              }
            }}
            placeholder="Service Name (e.g. Google)"
            className={clsx(defaultInputClass, inputClassName)}
            autoFocus
          />
          {setNewServiceUrl && (
            <input
              value={newServiceUrl}
              onChange={(e) => setNewServiceUrl(e.target.value)}
              placeholder="Service URL (e.g. google.com)"
              className={clsx(defaultInputClass, inputClassName)}
            />
          )}
        </div>
      )}

      {/* 3. When an existing service is selected, show its URL (read-only/auto-filled) */}
      {!isCreatingNew && Boolean(serviceId) && (
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-400 font-medium">Service URL</span>
          <input
            value={displayedUrl}
            readOnly
            placeholder="No URL configured for this service"
            className={clsx(
              defaultInputClass,
              inputClassName,
              "opacity-80 bg-slate-100 dark:bg-slate-900 cursor-not-allowed text-slate-600 dark:text-slate-400"
            )}
            title="Service URL (linked from service)"
          />
        </div>
      )}
    </div>
  );
};

export async function resolveOrCreateService({
  serviceId,
  isCreatingNew,
  newServiceName,
  newServiceUrl,
  availableServices,
  nodeId,
  fallbackPosition,
}: {
  serviceId: string;
  isCreatingNew: boolean;
  newServiceName: string;
  newServiceUrl?: string;
  availableServices: any[];
  nodeId?: string;
  fallbackPosition?: { x: number; y: number };
}): Promise<string> {
  const normalizedServices = (availableServices || []).map((s: any) => ({
    id: String(s.id || s.data?.id || ''),
    name: String(s.name || s.data?.name || s.id || s.data?.id || ''),
    url: String(s.url || s.data?.url || ''),
  })).filter((s) => Boolean(s.id));

  // If user selected an existing service from the dropdown
  if (!isCreatingNew) {
    if (!serviceId) {
      throw new Error('Please select a valid service');
    }
    return serviceId;
  }

  // If user opted to create a new service
  const trimmedName = newServiceName.trim();
  if (!trimmedName) {
    throw new Error('Please enter a service name');
  }

  // Case-insensitive match check: if a service with the same name exists, REUSE IT
  const existingMatch = normalizedServices.find(
    (s) => s.name.trim().toLowerCase() === trimmedName.toLowerCase()
  );

  if (existingMatch && existingMatch.id) {
    // If user entered a URL and existing service didn't have one, update it
    if (newServiceUrl?.trim() && !existingMatch.url) {
      try {
        const { updateNode } = await import('../../api/nodes');
        await updateNode('service', existingMatch.id, { url: newServiceUrl.trim() });
      } catch (err) {
        console.error('Failed to update service url on existing match:', err);
      }
    }
    return existingMatch.id;
  }

  // Otherwise create new service
  const { createNode } = await import('../../api/nodes');
  const { useGraphStore } = await import('../../stores/graphStore');
  const graphNodes = useGraphStore.getState().nodes;
  const existingNode = nodeId ? graphNodes.find(n => n.data.id === nodeId) : null;
  const currentPos = (existingNode?.data ? { x: (existingNode.data as any).position_x ?? 0, y: (existingNode.data as any).position_y ?? 0 } : null) || fallbackPosition || { x: 100, y: 100 };
  const serviceX = currentPos.x - 220;
  const serviceY = currentPos.y;

  const newService = await createNode('service', {
    name: trimmedName,
    url: newServiceUrl?.trim() || undefined,
    position_x: serviceX,
    position_y: serviceY,
  });

  if (!newService || !newService.id) {
    throw new Error('Failed to create service: no ID returned');
  }

  // Refresh services in graph store so all components see the newly created service immediately
  try {
    await useGraphStore.getState().fetchServices();
  } catch (err) {
    console.error('Failed to fetch services after creation:', err);
  }

  return newService.id;
}

export default ServiceDropdown;
