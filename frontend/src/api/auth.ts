import { apiClient } from './client';

export const setupAuth = async (master_password: string) => {
  const { data } = await apiClient.post('/auth/setup', { master_password });
  return data;
};

export const unlockAuth = async (master_password: string) => {
  const { data } = await apiClient.post('/auth/unlock', { master_password });
  return data; // { session_token, expires_at }
};

export const lockAuth = async () => {
  const { data } = await apiClient.post('/auth/lock');
  return data;
};

export const checkStatus = async () => {
  const { data } = await apiClient.get('/auth/status');
  return data; // { unlocked, auto_lock_minutes }
};

export const updateSettings = async (auto_lock_minutes: number) => {
  const { data } = await apiClient.patch('/auth/settings', { auto_lock_minutes });
  return data;
};
