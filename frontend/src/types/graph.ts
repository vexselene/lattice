export type NodeType = 'email' | 'phone' | 'service' | 'account';
export type EdgeRelation = 'registered_with' | 'recovery_for' | 'uses_username' | 'linked_account';

export interface BaseNode {
  id: string;
  position_x: number;
  position_y: number;
  notes?: string | null;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface EmailNode extends BaseNode {
  address: string;
  provider?: string | null;
  password_encrypted?: string | null;
}

export interface PhoneNode extends BaseNode {
  number: string;
  carrier?: string | null;
}

export interface ServiceNode extends BaseNode {
  name: string;
  url?: string | null;
  category?: string | null;
  icon_url?: string | null;
}

export interface AccountNode extends BaseNode {
  username: string;
  password_encrypted?: string | null;
  service_id: string;
  service_name?: string | null;
  service_color?: string | null;
  service_url?: string | null;
  primary_email_id?: string | null;
}

export type AnyNodeData = EmailNode | PhoneNode | ServiceNode | AccountNode;

export interface GraphNode {
  type: NodeType;
  data: AnyNodeData;
}

export interface Edge {
  id: string;
  source_type: NodeType;
  source_id: string;
  target_type: NodeType;
  target_id: string;
  relation: EdgeRelation;
  notes?: string | null;
  created_at?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: Edge[];
}

export interface SearchResult {
  type: NodeType;
  data: AnyNodeData;
}
