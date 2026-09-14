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

const WORKFLOW_NODE_TYPES: ReadonlySet<string> = new Set([
  'Start',
  'End',
  'Decision',
  'Join',
  'SetVariable',
  'SnmpGet',
  'SnmpWalk',
  'Script',
]);

const WORKFLOW_STATUSES: ReadonlySet<string> = new Set(['Draft', 'Published', 'Archived']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isWorkflowDefinition(value: unknown): value is WorkflowDefinition {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.version !== 'number' ||
    !Number.isFinite(value.version) ||
    typeof value.status !== 'string' ||
    !WORKFLOW_STATUSES.has(value.status) ||
    (value.startNodeId !== null && typeof value.startNodeId !== 'string') ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.edges)
  ) {
    return false;
  }

  const nodesAreValid = value.nodes.every((node) =>
    isRecord(node) &&
    typeof node.id === 'string' &&
    typeof node.type === 'string' &&
    WORKFLOW_NODE_TYPES.has(node.type) &&
    typeof node.name === 'string' &&
    typeof node.key === 'string' &&
    isRecord(node.config) &&
    typeof node.positionX === 'number' &&
    Number.isFinite(node.positionX) &&
    typeof node.positionY === 'number' &&
    Number.isFinite(node.positionY),
  );

  const edgesAreValid = value.edges.every((edge) =>
    isRecord(edge) &&
    typeof edge.id === 'string' &&
    typeof edge.fromNodeId === 'string' &&
    typeof edge.toNodeId === 'string' &&
    (edge.condition === null || typeof edge.condition === 'string') &&
    typeof edge.priority === 'number' &&
    Number.isFinite(edge.priority),
  );

  return nodesAreValid && edgesAreValid;
}
