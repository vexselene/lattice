export interface AuthStatus {
  is_setup: boolean;
  unlocked: boolean;
  auto_lock_minutes: number;
}

export const setupAuth = async (password: string): Promise<void> => {
  if (window.api?.cmdAuthSetup) {
    await window.api.cmdAuthSetup(password);
  }
};

export const unlockAuth = async (password: string): Promise<void> => {
  if (window.api?.cmdAuthUnlock) {
    await window.api.cmdAuthUnlock(password);
  }
};

export const lockAuth = async (): Promise<void> => {
  if (window.api?.cmdAuthLock) {
    await window.api.cmdAuthLock();
  }
};

export const checkStatus = async (): Promise<AuthStatus> => {
  if (window.api?.cmdAuthStatus) {
    const res = await window.api.cmdAuthStatus();
    return {
      is_setup: res.isSetup ?? res.is_setup ?? false,
      unlocked: res.unlocked ?? false,
      auto_lock_minutes: res.autoLockMinutes ?? res.auto_lock_minutes ?? 15,
    };
  }
  return { is_setup: false, unlocked: false, auto_lock_minutes: 15 };
};

export const updateSettings = async (autoLockMinutes: number): Promise<void> => {
  if (window.api?.cmdUpdateSettings) {
    await window.api.cmdUpdateSettings(autoLockMinutes);
  }
};
