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

  // Export
  exportSaveFile: (content, defaultFilename) =>
    ipcRenderer.invoke('export-save-file', { content, defaultFilename }),
});
