import type {
  ExecutionLogEntry,
  NodeResult,
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowExecutionState,
  WorkflowNode,
} from '../../domain/workflow/model';
import type { RuntimeServices } from './contracts';
import { createExecutorRegistry } from './executors';

const idleState = (): WorkflowExecutionState => ({
  status: 'idle',
  currentNodeId: null,
  doneNodeIds: [],
  chosenEdgeIds: [],
  context: {},
  result: null,
  why: 'Workflow ещё не запущен.',
  logs: [],
});

export class WorkflowEngine {
  private readonly registry = createExecutorRegistry();

  constructor(private readonly services: RuntimeServices) {}

  createIdleState(): WorkflowExecutionState {
    return idleState();
  }

  async start(workflow: WorkflowDefinition): Promise<WorkflowExecutionState> {
    const state = idleState();
    const startNode = workflow.nodes.find((node) => node.id === workflow.startNodeId);

    if (!startNode) {
      return { ...state, status: 'failed', why: 'Start Node не найдена.' };
    }

    return this.executeNode(workflow, {
      ...state,
      status: 'running',
      currentNodeId: startNode.id,
      why: 'Workflow запущен со Start Node.',
    }, startNode);
  }

  async step(workflow: WorkflowDefinition, state: WorkflowExecutionState): Promise<WorkflowExecutionState> {
    if (state.status === 'idle') return this.start(workflow);
    if (state.status !== 'running' || !state.currentNodeId) return state;

    const current = workflow.nodes.find((node) => node.id === state.currentNodeId);
    if (!current) return { ...state, status: 'failed', why: 'Текущая Node не существует.' };

    if (state.result?.success === false) {
      return {
        ...state,
        status: 'failed',
        why: `Node завершилась ошибкой: ${state.result.error ?? 'Unknown error'}`,
      };
    }

    if (current.type === 'End') {
      return { ...state, status: 'completed', why: 'End Node достигнута. Workflow завершён.' };
    }

    const resolution = this.resolveNextEdge(workflow, current, state.result);
    if (!resolution.edge) {
      return { ...state, status: 'failed', why: resolution.why };
    }

    const next = workflow.nodes.find((node) => node.id === resolution.edge!.toNodeId);
    if (!next) {
      return { ...state, status: 'failed', why: `Edge ${resolution.edge.id} ведёт в несуществующую Node.` };
    }

    const nextState: WorkflowExecutionState = {
      ...state,
      doneNodeIds: [...state.doneNodeIds, current.id],
      chosenEdgeIds: [...state.chosenEdgeIds, resolution.edge.id],
      currentNodeId: next.id,
      why: resolution.why,
    };

    return this.executeNode(workflow, nextState, next);
  }

  private async executeNode(
    _workflow: WorkflowDefinition,
    state: WorkflowExecutionState,
    node: WorkflowNode,
  ): Promise<WorkflowExecutionState> {
    const executor = this.registry[node.type];
    const context = structuredClone(state.context);
    const startedAt = performance.now();

    try {
      const result = await executor(node, { workflowContext: context, services: this.services });
      const finishedAt = performance.now();
      const log: ExecutionLogEntry = {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        success: result.success,
        decision: result.decision,
        outputs: result.outputs,
        error: result.error,
        logs: result.logs ?? [],
        startedAt,
        finishedAt,
      };

      return {
        ...state,
        context,
        result,
        logs: [...state.logs, log],
        status: result.success ? state.status : 'failed',
        why: result.success ? state.why : `Node завершилась ошибкой: ${result.error ?? 'Unknown error'}`,
      };
    } catch (error) {
      const finishedAt = performance.now();
      const message = error instanceof Error ? error.message : String(error);
      const result: NodeResult = { success: false, decision: null, outputs: {}, error: message };
      const log: ExecutionLogEntry = {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        success: false,
        decision: null,
        outputs: {},
        error: message,
        logs: [],
        startedAt,
        finishedAt,
      };

      return {
        ...state,
        context,
        result,
        logs: [...state.logs, log],
        status: 'failed',
        why: `Node завершилась ошибкой: ${message}`,
      };
    }
  }

  private resolveNextEdge(
    workflow: WorkflowDefinition,
    node: WorkflowNode,
    result: NodeResult | null,
  ): { edge: WorkflowEdge | null; why: string } {
    const outgoing = workflow.edges
      .filter((edge) => edge.fromNodeId === node.id)
      .sort((a, b) => a.priority - b.priority);

    if (!outgoing.length) return { edge: null, why: 'У текущей Node нет исходящих Edge.' };

    if (node.type === 'Decision') {
      if (result?.decision == null) {
        const fallback = outgoing.find((edge) => edge.condition === 'DEFAULT');
        if (fallback) return { edge: fallback, why: 'Decision не вернула значение, поэтому выбран DEFAULT.' };

        const unconditional = outgoing.find((edge) => !edge.condition);
        if (unconditional) return { edge: unconditional, why: 'Decision не вернула значение, выбран безусловный Edge.' };

        return { edge: null, why: 'Decision не вернула значение и не имеет DEFAULT-ветки.' };
      }

      const exact = outgoing.find((edge) => edge.condition === result.decision);
      if (exact) return { edge: exact, why: `Decision='${result.decision}' совпал с Condition='${exact.condition}'.` };

      const fallback = outgoing.find((edge) => edge.condition === 'DEFAULT');
      if (fallback) return { edge: fallback, why: `Для Decision='${result.decision}' точного совпадения нет, поэтому выбран DEFAULT.` };

      const unconditional = outgoing.find((edge) => !edge.condition);
      if (unconditional) return { edge: unconditional, why: `Для Decision='${result.decision}' выбран безусловный Edge.` };

      return { edge: null, why: `Нет подходящего Edge для Decision='${result.decision}'.` };
    }

    const unconditional = outgoing.find((edge) => !edge.condition);
    if (unconditional) return { edge: unconditional, why: 'Node не вернула Decision, выбран безусловный Edge.' };

    return { edge: outgoing[0], why: `Decision отсутствует, выбран Edge с наименьшим Priority (${outgoing[0].priority}).` };
  }
}
