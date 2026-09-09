const { contextBridge, ipcRenderer } = require('electron');
const native = require('../native');

// Expose safe, isolated API bridge to renderer
contextBridge.exposeInMainWorld('api', {
  // Setup & Auth
  cmdAuthSetup: (password) => native.cmdAuthSetup(password),
  cmdAuthUnlock: (password) => native.cmdAuthUnlock(password),
  cmdAuthLock: () => native.cmdAuthLock(),
  cmdAuthStatus: () => native.cmdAuthStatus(),
  cmdUpdateSettings: (autoLockMinutes) => native.cmdUpdateSettings(autoLockMinutes),

  // Graph / Nodes / Edges / Search
  cmdGetGraph: () => native.cmdGetGraph(),
  cmdGetNodes: (nodeType, skip, limit) => native.cmdGetNodes(nodeType, skip, limit),
  cmdGetNode: (nodeType, nodeId) => native.cmdGetNode(nodeType, nodeId),
  cmdCreateNode: (nodeType, data) => native.cmdCreateNode(nodeType, data),
  cmdUpdateNode: (nodeType, nodeId, data) => native.cmdUpdateNode(nodeType, nodeId, data),
  cmdDeleteNode: (nodeType, nodeId) => native.cmdDeleteNode(nodeType, nodeId),
  cmdGetNodePassword: (nodeType, nodeId) => native.cmdGetNodePassword(nodeType, nodeId),
  cmdUpdateNodePosition: (nodeType, nodeId, x, y) => native.cmdUpdateNodePosition(nodeType, nodeId, x, y),
  cmdGetEdges: (nodeType, nodeId) => native.cmdGetEdges(nodeType, nodeId),
  cmdCreateEdge: (edge) => native.cmdCreateEdge(edge),
  cmdUpdateEdge: (edgeId, payload) => native.cmdUpdateEdge(edgeId, payload),
  cmdDeleteEdge: (edgeId) => native.cmdDeleteEdge(edgeId),
  cmdGetSubgraph: (nodeType, nodeId, depth) => native.cmdGetSubgraph(nodeType, nodeId, depth),
  cmdSearch: (query, types) => native.cmdSearch(query, types),
  cmdGeneratePassword: () => native.cmdGeneratePassword(),

  // Canvas Lifecycle
  cmdListCanvases: () => native.cmdListCanvases(),
  cmdCreateCanvas: (name, password) => native.cmdCreateCanvas(name, password),
  cmdOpenCanvas: (id, password) => native.cmdOpenCanvas(id, password),
  cmdCloseCanvas: () => native.cmdCloseCanvas(),
  cmdRenameCanvas: (id, newName) => native.cmdRenameCanvas(id, newName),
  cmdDuplicateCanvas: (id, originalPassword, newPassword) =>
    native.cmdDuplicateCanvas(id, originalPassword, newPassword),
  cmdDeleteCanvas: (id, password) => native.cmdDeleteCanvas(id, password),
  cmdExportCanvas: (id, destinationPath) => native.cmdExportCanvas(id, destinationPath),
  cmdImportCanvas: (sourcePath) => native.cmdImportCanvas(sourcePath),

  // Dialogs
  showSaveDialog: (defaultFileName) => ipcRenderer.invoke('show-save-dialog', defaultFileName),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),

  // Export
  exportSaveFile: (content, defaultFilename) =>
    ipcRenderer.invoke('export-save-file', { content, defaultFilename }),
});
