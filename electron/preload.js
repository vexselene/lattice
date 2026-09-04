const { contextBridge } = require('electron');
const native = require('../native');

// Expose safe, isolated API bridge to renderer
contextBridge.exposeInMainWorld('api', {
  // Setup & Auth
  cmdAuthSetup: (password) => native.cmdAuthSetup(password),
  cmdAuthUnlock: (password) => native.cmdAuthUnlock(password),
  cmdAuthLock: () => native.cmdAuthLock(),
  cmdAuthStatus: () => native.cmdAuthStatus(),
  cmdUpdateSettings: (autoLockMinutes) => native.cmdUpdateSettings(autoLockMinutes),

  // Utils
  cmdGeneratePassword: () => native.cmdGeneratePassword(),
});
