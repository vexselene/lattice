const { app, BrowserWindow, ipcMain, dialog, Menu, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const url = require('url');
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

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
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
