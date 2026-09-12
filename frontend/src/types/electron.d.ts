import { NodeType, GraphData, GraphNode, Edge, EdgeRelation } from './graph';

export interface EdgeCreatePayload {
  source_type: NodeType;
  source_id: string;
  target_type: NodeType;
  target_id: string;
  relation: EdgeRelation;
  notes?: string;
}

export interface EdgeUpdatePayload {
  relation?: EdgeRelation;
  notes?: string;
}

export interface ExportSaveResult {
  canceled: boolean;
  filePath?: string;
}

export interface CanvasSummary {
  id: string;
  name: string;
  createdAt: string;
  modifiedAt: string;
  created_at?: string;
  modified_at?: string;
  colorIndex: number;
  orderIndex: number;
  color_index?: number;
  order_index?: number;
}

export interface LatticeApi {
  // Setup & Auth
  cmdAuthSetup: (password: string) => Promise<void>;
  cmdAuthUnlock: (password: string) => Promise<void>;
  cmdAuthLock: () => void | Promise<void>;
  cmdAuthStatus: () => any | Promise<any>;
  cmdUpdateSettings: (autoLockMinutes: number) => void | Promise<void>;
  cmdGeneratePassword: () => any | Promise<any>;

  // Canvas Lifecycle
  cmdListCanvases: () => CanvasSummary[] | Promise<CanvasSummary[]>;
  cmdCreateCanvas: (name: string, password: string) => Promise<CanvasSummary>;
  cmdOpenCanvas: (id: string, password: string) => Promise<void>;
  cmdCloseCanvas: () => void | Promise<void>;
  cmdRenameCanvas: (id: string, newName: string) => void | Promise<void>;
  cmdDuplicateCanvas: (id: string, originalPassword: string, newPassword?: string | null) => Promise<CanvasSummary>;
  cmdChangeCanvasPassword: (id: string, oldPassword: string, newPassword: string) => Promise<void>;
  cmdDeleteCanvas: (id: string, password: string) => Promise<void>;
  cmdExportCanvas: (id: string, destinationPath: string) => void | Promise<void>;
  cmdImportCanvas: (sourcePath: string) => CanvasSummary | Promise<CanvasSummary>;
  cmdReorderCanvases: (orderedIds: string[]) => void | Promise<void>;

  // Dialogs
  showSaveDialog: (defaultFileName?: string) => Promise<string | null>;
  showOpenDialog: () => Promise<string | null>;

  // Graph / Nodes / Edges / Search
  cmdGetGraph: () => GraphData | Promise<GraphData>;
  cmdGetNodes: (nodeType: string, skip?: number, limit?: number) => GraphNode[] | Promise<GraphNode[]>;
  cmdGetNode: (nodeType: string, nodeId: string) => GraphNode | Promise<GraphNode>;
  cmdCreateNode: (nodeType: string, data: any) => GraphNode | Promise<GraphNode>;
  cmdUpdateNode: (nodeType: string, nodeId: string, data: any) => GraphNode | Promise<GraphNode>;
  cmdDeleteNode: (nodeType: string, nodeId: string) => void | Promise<void>;
  cmdGetNodePassword: (nodeType: string, nodeId: string) => string | null | Promise<string | null>;
  cmdUpdateNodePosition: (nodeType: string, nodeId: string, x: number, y: number) => void | Promise<void>;
  cmdGetEdges: (nodeType?: string, nodeId?: string) => Edge[] | Promise<Edge[]>;
  cmdCreateEdge: (edge: EdgeCreatePayload) => Edge | Promise<Edge>;
  cmdUpdateEdge: (edgeId: string, payload: EdgeUpdatePayload) => Edge | Promise<Edge>;
  cmdDeleteEdge: (edgeId: string) => void | Promise<void>;
  cmdGetSubgraph: (nodeType: string, nodeId: string, depth?: number) => { edges: any[] } | Promise<{ edges: any[] }>;
  cmdSearch: (query: string, types?: string[]) => GraphNode[] | Promise<GraphNode[]>;

  // Export
  exportSaveFile: (content: string, defaultFilename: string) => Promise<ExportSaveResult>;
}

declare global {
  interface Window {
    api?: LatticeApi;
  }
}
