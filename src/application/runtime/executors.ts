import { getContextPath, setContextPath } from '../../domain/workflow/contextPath';
import type { NodeResult, WorkflowNode, WorkflowNodeType } from '../../domain/workflow/model';
import type { NodeExecutionContext, NodeExecutor } from './contracts';

const ok = (outputs: Record<string, unknown> = {}): NodeResult => ({
  success: true,
  decision: null,
  outputs,
});

async function executeScript(node: WorkflowNode, runtime: NodeExecutionContext): Promise<NodeResult> {
  const source = String(node.config.scriptSource ?? '');
  const inputPath = String(node.config.input ?? '');
  const outputPath = String(node.config.output ?? `script.${node.key}`);
  const timeoutMs = Math.max(50, Math.min(30000, Number(node.config.timeoutMs ?? 1500)));
  const input = getContextPath(runtime.workflowContext, inputPath);

  if (!source.trim()) {
    return { success: false, decision: null, outputs: {}, error: 'Script source is empty', logs: [] };
  }

  const result = await runtime.services.scriptRunner.run({
    source,
    input: structuredClone(input),
    context: structuredClone(runtime.workflowContext),
    timeoutMs,
  });

  if (!result.ok) {
    return {
      success: false,
      decision: null,
      outputs: {},
      error: result.error ?? 'Script execution failed',
      logs: result.logs,
    };
  }

  const value = result.value;

  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    ('outputs' in value || 'decision' in value || 'success' in value || 'error' in value)
  ) {
    const raw = value as Record<string, unknown>;
    const outputs = raw.outputs && typeof raw.outputs === 'object' && !Array.isArray(raw.outputs)
      ? (raw.outputs as Record<string, unknown>)
      : {};

    Object.entries(outputs).forEach(([path, output]) => setContextPath(runtime.workflowContext, path, output));

    return {
      success: raw.success !== false,
      decision: raw.decision == null ? null : String(raw.decision),
      outputs,
      error: raw.error == null ? null : String(raw.error),
      logs: result.logs,
    };
  }

  setContextPath(runtime.workflowContext, outputPath, value);

  return {
    success: true,
    decision: null,
    outputs: { [outputPath]: value },
    logs: result.logs,
  };
}

export function createExecutorRegistry(): Record<WorkflowNodeType, NodeExecutor> {
  return {
    Start: async () => ok(),
    End: async () => ok(),
    Join: async () => ok(),
    SetVariable: async (node, runtime) => {
      const name = String(node.config.name ?? '');
      if (!name) return ok();
      const value = structuredClone(node.config.value);
      setContextPath(runtime.workflowContext, name, value);
      return ok({ [name]: value });
    },
    Decision: async (node, runtime) => {
      const variable = String(node.config.variable ?? '');
      const value = getContextPath(runtime.workflowContext, variable);
      return { success: true, decision: value == null ? null : String(value), outputs: {} };
    },
    SnmpGet: async (node, runtime) => {
      const output = String(node.config.output ?? 'raw.value');
      const value = await runtime.services.snmpClient.get(node);
      setContextPath(runtime.workflowContext, output, value);
      return ok({ [output]: value });
    },
    SnmpWalk: async (node, runtime) => {
      const output = String(node.config.output ?? 'raw.items');
      const value = await runtime.services.snmpClient.walk(node);
      setContextPath(runtime.workflowContext, output, value);
      return ok({ [output]: value });
    },
    Script: executeScript,
  };
}
