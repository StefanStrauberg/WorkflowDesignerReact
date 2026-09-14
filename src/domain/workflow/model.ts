export type WorkflowNodeType =
  | 'Start'
  | 'End'
  | 'Decision'
  | 'Join'
  | 'SetVariable'
  | 'SnmpGet'
  | 'SnmpWalk'
  | 'Script';

export type WorkflowStatus = 'Draft' | 'Published' | 'Archived';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  name: string;
  key: string;
  config: Record<string, unknown>;
  positionX: number;
  positionY: number;
}

export interface WorkflowEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  condition: string | null;
  priority: number;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: number;
  status: WorkflowStatus;
  startNodeId: string | null;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface NodeResult {
  success: boolean;
  decision: string | null;
  outputs: Record<string, unknown>;
  error?: string | null;
  logs?: string[];
}

export interface ExecutionLogEntry {
  nodeId: string;
  nodeName: string;
  nodeType: WorkflowNodeType;
  success: boolean;
  decision: string | null;
  outputs: Record<string, unknown>;
  error?: string | null;
  logs: string[];
  startedAt: number;
  finishedAt: number;
}

export type ExecutionStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface WorkflowExecutionState {
  status: ExecutionStatus;
  currentNodeId: string | null;
  doneNodeIds: string[];
  chosenEdgeIds: string[];
  context: Record<string, unknown>;
  result: NodeResult | null;
  why: string;
  logs: ExecutionLogEntry[];
}

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}
