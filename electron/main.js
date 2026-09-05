const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const url = require('url');
const native = require('../native');

// Initialize native app data directory with Electron userData
native.initApp(app.getPath('userData'));

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

// Minimal static HTTP server for the built frontend.
// Serving from http://localhost instead of file:// avoids the stricter canvas
// security policy that taints canvases when drawImage() is used with blob URLs.
const MIME_TYPES = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.css':  'text/css',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.json': 'application/json',
};

const DIST_DIR = path.join(__dirname, '../frontend/dist');

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let pathname = url.parse(req.url).pathname;
      // Normalise and default to index.html for SPA routing
      if (!pathname || pathname === '/') pathname = '/index.html';
      const filePath = path.join(DIST_DIR, pathname);

      // Security: ensure the resolved path stays within DIST_DIR
      if (!filePath.startsWith(DIST_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          // SPA fallback: serve index.html for any unknown path
          fs.readFile(path.join(DIST_DIR, 'index.html'), (err2, fallback) => {
            if (err2) { res.writeHead(404); res.end('Not found'); return; }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(fallback);
          });
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
    });

    // Port 0 lets the OS pick a free port
    server.listen(0, '127.0.0.1', () => {
      resolve(server.address().port);
    });
  });
}

async function createWindow() {
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
    const port = await startStaticServer();
    win.loadURL(`http://127.0.0.1:${port}`);
  }
}

app.whenReady().then(() => {
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
