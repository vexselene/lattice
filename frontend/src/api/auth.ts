import { invoke } from '@tauri-apps/api/core';

export interface AuthStatus {
  is_setup: boolean;
  unlocked: boolean;
  auto_lock_minutes: number;
}

export const setupAuth = async (password: string): Promise<void> => {
  await invoke('cmd_auth_setup', { password });
};

export const unlockAuth = async (password: string): Promise<void> => {
  await invoke('cmd_auth_unlock', { password });
};

export const lockAuth = async (): Promise<void> => {
  await invoke('cmd_auth_lock');
};

export const checkStatus = async (): Promise<AuthStatus> => {
  return await invoke<AuthStatus>('cmd_auth_status');
};

export const updateSettings = async (autoLockMinutes: number): Promise<void> => {
  await invoke('cmd_update_settings', { autoLockMinutes });
};
