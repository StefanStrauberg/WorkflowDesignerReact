import type { NodeResult, WorkflowNode } from '../../domain/workflow/model';

export interface ScriptRunnerRequest {
  source: string;
  input: unknown;
  context: Record<string, unknown>;
  timeoutMs: number;
}

export interface ScriptRunnerResult {
  ok: boolean;
  value?: unknown;
  error?: string;
  logs: string[];
  timeout?: boolean;
}

export interface ScriptRunner {
  run(request: ScriptRunnerRequest): Promise<ScriptRunnerResult>;
}

export interface SnmpClient {
  get(node: WorkflowNode): Promise<unknown>;
  walk(node: WorkflowNode): Promise<unknown>;
}

export interface RuntimeServices {
  scriptRunner: ScriptRunner;
  snmpClient: SnmpClient;
}

export interface NodeExecutionContext {
  workflowContext: Record<string, unknown>;
  services: RuntimeServices;
}

export type NodeExecutor = (
  node: WorkflowNode,
  context: NodeExecutionContext,
) => Promise<NodeResult>;
