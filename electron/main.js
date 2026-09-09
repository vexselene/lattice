const { app, BrowserWindow, ipcMain, dialog, Menu, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const url = require('url');

// Single-instance lock enforcement
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow = null;

  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Focus or restore existing window when a second instance launch is attempted
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  const native = require('../native');
  const userDataPath = app.getPath('userData');

  // Initialize native app data directory with Electron userData
  native.initApp(userDataPath);

  // IPC Handler for file export with native save dialog
  ipcMain.handle('export-save-file', async (event, { content, defaultFilename }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const ext = path.extname(defaultFilename).slice(1).toLowerCase();
    const filters = ext === 'svg'
      ? [{ name: 'SVG Image', extensions: ['svg'] }]
      : [{ name: 'PNG Image', extensions: ['png'] }];

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: defaultFilename,
      filters,
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    let buffer;
    if (typeof content === 'string' && content.startsWith('data:image/')) {
      const base64Data = content.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      buffer = Buffer.from(content, 'utf8');
    }

    await fs.promises.writeFile(filePath, buffer);
    return { canceled: false, filePath };
  });

  // IPC Handlers for canvas bundle export/import dialogs
  ipcMain.handle('show-save-dialog', async (event, defaultFileName) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: defaultFileName || 'canvas.lattice',
      filters: [{ name: 'Lattice Canvas Bundle', extensions: ['lattice'] }],
    });
    if (canceled || !filePath) {
      return null;
    }
    return filePath;
  });

  ipcMain.handle('show-open-dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Lattice Canvas Bundle', extensions: ['lattice'] }],
    });
    if (canceled || !filePaths || filePaths.length === 0) {
      return null;
    }
    return filePaths[0];
  });

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    if (process.env.VITE_DEV_SERVER_URL) {
      mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
      mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
    }
  }

  app.whenReady().then(() => {
    const defaultMenu = Menu.getApplicationMenu();
    Menu.setApplicationMenu(null);
    let menuVisible = false;

    globalShortcut.register('CommandOrControl+Shift+M', () => {
      menuVisible = !menuVisible;
      Menu.setApplicationMenu(menuVisible ? defaultMenu : null);
    });

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
