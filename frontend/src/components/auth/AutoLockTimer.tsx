import { useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useCanvasStore } from '../../stores/canvasStore';
import { lockAuth } from '../../api/auth';

export const AutoLockTimer = () => {
  const { isUnlocked, autoLockMinutes, logout } = useAuthStore();

  useEffect(() => {
    if (!isUnlocked || autoLockMinutes <= 0) return;

    let timeoutId: number;

    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(async () => {
        try {
          await lockAuth();
        } catch (e) {}
        useCanvasStore.getState().resetCanvasState();
        logout();
      }, autoLockMinutes * 60 * 1000);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(name => document.addEventListener(name, resetTimer, true));

    resetTimer();

    return () => {
      window.clearTimeout(timeoutId);
      events.forEach(name => document.removeEventListener(name, resetTimer, true));
    };
  }, [isUnlocked, autoLockMinutes, logout]);

  return null;
};

export default AutoLockTimer;
