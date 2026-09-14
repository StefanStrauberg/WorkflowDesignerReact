import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { WorkflowEngine } from '../../../application/runtime/workflowEngine';
import { createExecutorRegistry } from '../../../application/runtime/executors';
import type { RuntimeServices } from '../../../application/runtime/contracts';
import { BrowserScriptRunner } from '../../../infrastructure/browser/browserScriptRunner';
import { MockSnmpClient } from '../../../infrastructure/mock/mockSnmpClient';
import { createDemoWorkflow, defaultConfigForType, GRID_SIZE } from '../../../domain/workflow/defaults';
import { validateWorkflow } from '../../../domain/workflow/validation';
import type {
  ValidationIssue,
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowExecutionState,
  WorkflowNode,
  WorkflowNodeType,
} from '../../../domain/workflow/model';

interface DesignerContextValue {
  workflow: WorkflowDefinition;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  validationIssues: ValidationIssue[] | null;
  execution: WorkflowExecutionState;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  autoRunning: boolean;
  snapEnabled: boolean;
  selectedNode: WorkflowNode | null;
  selectedEdge: WorkflowEdge | null;
  selectNode(id: string | null): void;
  selectEdge(id: string | null): void;
  clearSelection(): void;
  pushHistory(): void;
  addNode(type: WorkflowNodeType, x: number, y: number): WorkflowNode;
  updateNode(id: string, patch: Partial<WorkflowNode>): void;
  moveNode(id: string, x: number, y: number): void;
  deleteNode(id: string, reconnect?: boolean): void;
  duplicateNode(id: string): void;
  setStartNode(id: string): void;
  addEdge(fromNodeId: string, toNodeId: string, condition?: string | null, priority?: number): void;
  updateEdge(id: string, patch: Partial<WorkflowEdge>): void;
  deleteEdge(id: string): void;
  insertNodeIntoEdge(edgeId: string): void;
  insertNodeBefore(nodeId: string): void;
  insertNodeAfter(nodeId: string): void;
  undo(): void;
  redo(): void;
  validate(): ValidationIssue[];
  resetWorkflow(): void;
  importWorkflow(workflow: WorkflowDefinition): void;
  markClean(): void;
  toggleSnap(): void;
  startExecution(): Promise<void>;
  nextExecutionStep(): Promise<void>;
  resetExecution(): void;
  toggleAutoExecution(): Promise<void>;
  testScriptNode(node: WorkflowNode, context: Record<string, unknown>): Promise<{ result: unknown; contextAfter: Record<string, unknown> }>;
}

const DesignerContext = createContext<DesignerContextValue | null>(null);

const services: RuntimeServices = {
  scriptRunner: new BrowserScriptRunner(),
  snmpClient: new MockSnmpClient(),
};
const engine = new WorkflowEngine(services);
const executors = createExecutorRegistry();

function cloneWorkflow(workflow: WorkflowDefinition): WorkflowDefinition {
  return structuredClone(workflow);
}

function workflowFingerprint(workflow: WorkflowDefinition) {
  return JSON.stringify(workflow);
}

function snap(value: number) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function uniqueNodeKey(base: string, workflow: WorkflowDefinition) {
  const keys = new Set(workflow.nodes.map((node) => node.key));
  if (!keys.has(base)) return base;

  let suffix = 2;
  while (keys.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function DesignerProvider({ children }: PropsWithChildren) {
  const [workflow, setWorkflow] = useState<WorkflowDefinition>(() => createDemoWorkflow());
  const workflowRef = useRef(workflow);
  const cleanWorkflowFingerprint = useRef(workflowFingerprint(workflow));
  workflowRef.current = workflow;

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[] | null>(null);
  const [execution, setExecution] = useState<WorkflowExecutionState>(() => engine.createIdleState());
  const executionRef = useRef(execution);
  executionRef.current = execution;
  const [dirty, setDirty] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [autoRunning, setAutoRunning] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);

  const undoStack = useRef<WorkflowDefinition[]>([]);
  const redoStack = useRef<WorkflowDefinition[]>([]);
  const autoToken = useRef(0);

  const pushHistory = useCallback(() => {
    undoStack.current.push(cloneWorkflow(workflowRef.current));
    if (undoStack.current.length > 100) undoStack.current.shift();
    redoStack.current = [];
    autoToken.current += 1;
    setAutoRunning(false);
    if (executionRef.current.status !== 'idle') {
      const idle = engine.createIdleState();
      executionRef.current = idle;
      setExecution(idle);
    }
    setHistoryVersion((value) => value + 1);
  }, []);

  const commit = useCallback((mutator: (draft: WorkflowDefinition) => void) => {
    pushHistory();
    const next = cloneWorkflow(workflowRef.current);
    mutator(next);
    workflowRef.current = next;
    setWorkflow(next);
    setDirty(workflowFingerprint(next) !== cleanWorkflowFingerprint.current);
    setValidationIssues(null);
  }, [pushHistory]);

  const addNode = useCallback((type: WorkflowNodeType, x: number, y: number) => {
    const node: WorkflowNode = {
      id: uid('node'),
      type,
      name: type,
      key: uniqueNodeKey(`${type.toLowerCase()}-${Date.now().toString(36)}`, workflowRef.current),
      config: defaultConfigForType(type),
      positionX: snapEnabled ? snap(x) : x,
      positionY: snapEnabled ? snap(y) : y,
    };

    commit((draft) => {
      if (type === 'Start') {
        draft.nodes.forEach((item) => {
          if (item.type === 'Start') {
            item.type = 'Join';
            item.config = {};
          }
        });
      }
      draft.nodes.push(node);
      if (!draft.startNodeId || type === 'Start') draft.startNodeId = node.id;
    });
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    return node;
  }, [commit, snapEnabled]);

  const updateNode = useCallback((id: string, patch: Partial<WorkflowNode>) => {
    commit((draft) => {
      const node = draft.nodes.find((item) => item.id === id);
      if (!node) return;

      if (patch.type === 'Start') {
        draft.nodes.forEach((item) => {
          if (item.id !== id && item.type === 'Start') {
            item.type = 'Join';
            item.config = {};
          }
        });
        draft.startNodeId = id;
      } else if (patch.type && draft.startNodeId === id) {
        draft.startNodeId = null;
      }

      Object.assign(node, structuredClone(patch));
    });
  }, [commit]);

  const moveNode = useCallback((id: string, x: number, y: number) => {
    setWorkflow((current) => {
      const next = cloneWorkflow(current);
      const node = next.nodes.find((item) => item.id === id);
      if (node) {
        node.positionX = snapEnabled ? snap(x) : x;
        node.positionY = snapEnabled ? snap(y) : y;
      }
      workflowRef.current = next;
      setDirty(workflowFingerprint(next) !== cleanWorkflowFingerprint.current);
      return next;
    });
  }, [snapEnabled]);

  const deleteNode = useCallback((id: string, reconnect = false) => {
    const current = workflowRef.current;
    const incoming = current.edges.filter((edge) => edge.toNodeId === id);
    const outgoing = current.edges.filter((edge) => edge.fromNodeId === id);

    if (reconnect && (incoming.length > 1 || outgoing.length > 1)) {
      window.alert('Автопереподключение разрешено только для Node с максимум одним входом и выходом.');
      return;
    }

    commit((draft) => {
      draft.nodes = draft.nodes.filter((node) => node.id !== id);
      draft.edges = draft.edges.filter((edge) => edge.fromNodeId !== id && edge.toNodeId !== id);

      if (reconnect && incoming.length === 1 && outgoing.length === 1) {
        if (incoming[0].fromNodeId !== outgoing[0].toNodeId) {
          draft.edges.push({
            id: uid('edge'),
            fromNodeId: incoming[0].fromNodeId,
            toNodeId: outgoing[0].toNodeId,
            condition: outgoing[0].condition,
            priority: outgoing[0].priority,
          });
        }
      }

      if (draft.startNodeId === id) {
        draft.startNodeId = draft.nodes.find((node) => node.type === 'Start')?.id ?? null;
      }
    });
    setSelectedNodeId(null);
  }, [commit]);

  const duplicateNode = useCallback((id: string) => {
    const source = workflowRef.current.nodes.find((node) => node.id === id);
    if (!source) return;
    const copy = structuredClone(source);
    copy.id = uid('node');
    copy.name = `${source.name} Copy`;
    copy.key = uniqueNodeKey(`${source.key}-copy`, workflowRef.current);
    if (copy.type === 'Start') {
      copy.type = 'Join';
      copy.config = {};
    }
    copy.positionX += GRID_SIZE * 2;
    copy.positionY += GRID_SIZE * 2;
    commit((draft) => draft.nodes.push(copy));
    setSelectedNodeId(copy.id);
  }, [commit]);

  const setStartNode = useCallback((id: string) => {
    if (!workflowRef.current.nodes.some((item) => item.id === id)) return;
    commit((draft) => {
      draft.startNodeId = id;
      draft.nodes.forEach((node) => {
        if (node.id === id) {
          node.type = 'Start';
          node.config = {};
        } else if (node.type === 'Start') {
          node.type = 'Join';
          node.config = {};
        }
      });
    });
  }, [commit]);

  const addEdge = useCallback((fromNodeId: string, toNodeId: string, condition: string | null = null, priority = 1) => {
    if (fromNodeId === toNodeId) return;
    if (!Number.isFinite(priority)) return;
    const nodeIds = new Set(workflowRef.current.nodes.map((node) => node.id));
    if (!nodeIds.has(fromNodeId) || !nodeIds.has(toNodeId)) return;
    const exists = workflowRef.current.edges.some((edge) => edge.fromNodeId === fromNodeId && edge.toNodeId === toNodeId && edge.condition === condition);
    if (exists) return;
    commit((draft) => draft.edges.push({ id: uid('edge'), fromNodeId, toNodeId, condition, priority }));
  }, [commit]);

  const updateEdge = useCallback((id: string, patch: Partial<WorkflowEdge>) => {
    commit((draft) => {
      const edge = draft.edges.find((item) => item.id === id);
      if (edge) Object.assign(edge, structuredClone(patch));
    });
  }, [commit]);

  const deleteEdge = useCallback((id: string) => {
    commit((draft) => { draft.edges = draft.edges.filter((edge) => edge.id !== id); });
    setSelectedEdgeId(null);
  }, [commit]);

  const insertNodeIntoEdge = useCallback((edgeId: string) => {
    const edge = workflowRef.current.edges.find((item) => item.id === edgeId);
    if (!edge) return;
    const from = workflowRef.current.nodes.find((node) => node.id === edge.fromNodeId);
    const to = workflowRef.current.nodes.find((node) => node.id === edge.toNodeId);
    if (!from || !to) return;

    const node: WorkflowNode = {
      id: uid('node'),
      type: 'Script',
      name: 'Inserted Node',
      key: `inserted-${Date.now().toString(36)}`,
      config: defaultConfigForType('Script'),
      positionX: snap((from.positionX + to.positionX) / 2),
      positionY: snap((from.positionY + to.positionY) / 2),
    };

    commit((draft) => {
      draft.edges = draft.edges.filter((item) => item.id !== edgeId);
      draft.nodes.push(node);
      draft.edges.push(
        { id: uid('edge'), fromNodeId: edge.fromNodeId, toNodeId: node.id, condition: edge.condition, priority: edge.priority },
        { id: uid('edge'), fromNodeId: node.id, toNodeId: edge.toNodeId, condition: null, priority: 1 },
      );
    });
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, [commit]);

  const insertNodeBefore = useCallback((nodeId: string) => {
    const target = workflowRef.current.nodes.find((node) => node.id === nodeId);
    if (!target) return;
    const incoming = workflowRef.current.edges.filter((edge) => edge.toNodeId === nodeId);
    const node: WorkflowNode = {
      id: uid('node'), type: 'Script', name: 'Inserted Before', key: `before-${Date.now().toString(36)}`,
      config: defaultConfigForType('Script'), positionX: snap(target.positionX - 280), positionY: snap(target.positionY),
    };
    commit((draft) => {
      draft.nodes.push(node);
      if (incoming.length === 1) {
        draft.edges = draft.edges.filter((edge) => edge.id !== incoming[0].id);
        draft.edges.push(
          { id: uid('edge'), fromNodeId: incoming[0].fromNodeId, toNodeId: node.id, condition: incoming[0].condition, priority: incoming[0].priority },
          { id: uid('edge'), fromNodeId: node.id, toNodeId: target.id, condition: null, priority: 1 },
        );
      } else {
        draft.edges.push({ id: uid('edge'), fromNodeId: node.id, toNodeId: target.id, condition: null, priority: 1 });
      }
    });
    setSelectedNodeId(node.id);
  }, [commit]);

  const insertNodeAfter = useCallback((nodeId: string) => {
    const target = workflowRef.current.nodes.find((node) => node.id === nodeId);
    if (!target) return;
    const outgoing = workflowRef.current.edges.filter((edge) => edge.fromNodeId === nodeId);
    const node: WorkflowNode = {
      id: uid('node'), type: 'Script', name: 'Inserted After', key: `after-${Date.now().toString(36)}`,
      config: defaultConfigForType('Script'), positionX: snap(target.positionX + 280), positionY: snap(target.positionY),
    };
    commit((draft) => {
      draft.nodes.push(node);
      if (outgoing.length === 1) {
        draft.edges = draft.edges.filter((edge) => edge.id !== outgoing[0].id);
        draft.edges.push(
          { id: uid('edge'), fromNodeId: target.id, toNodeId: node.id, condition: outgoing[0].condition, priority: outgoing[0].priority },
          { id: uid('edge'), fromNodeId: node.id, toNodeId: outgoing[0].toNodeId, condition: null, priority: 1 },
        );
      } else {
        draft.edges.push({ id: uid('edge'), fromNodeId: target.id, toNodeId: node.id, condition: null, priority: 1 });
      }
    });
    setSelectedNodeId(node.id);
  }, [commit]);

  const undo = useCallback(() => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    autoToken.current += 1;
    setAutoRunning(false);
    redoStack.current.push(cloneWorkflow(workflowRef.current));
    workflowRef.current = previous;
    setWorkflow(previous);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setValidationIssues(null);
    const idle = engine.createIdleState();
    executionRef.current = idle;
    setExecution(idle);
    setHistoryVersion((value) => value + 1);
    setDirty(workflowFingerprint(previous) !== cleanWorkflowFingerprint.current);
  }, []);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    autoToken.current += 1;
    setAutoRunning(false);
    undoStack.current.push(cloneWorkflow(workflowRef.current));
    workflowRef.current = next;
    setWorkflow(next);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setValidationIssues(null);
    const idle = engine.createIdleState();
    executionRef.current = idle;
    setExecution(idle);
    setHistoryVersion((value) => value + 1);
    setDirty(workflowFingerprint(next) !== cleanWorkflowFingerprint.current);
  }, []);

  const validate = useCallback(() => {
    const issues = validateWorkflow(workflowRef.current);
    setValidationIssues(issues);
    return issues;
  }, []);

  const resetWorkflow = useCallback(() => {
    pushHistory();
    const next: WorkflowDefinition = {
      id: uid('workflow'), name: 'New Workflow', version: 1, status: 'Draft', startNodeId: null, nodes: [], edges: [],
    };
    workflowRef.current = next;
    setWorkflow(next);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setValidationIssues(null);
    const idle = engine.createIdleState();
    executionRef.current = idle;
    setExecution(idle);
    setDirty(workflowFingerprint(next) !== cleanWorkflowFingerprint.current);
  }, [pushHistory]);

  const importWorkflow = useCallback((next: WorkflowDefinition) => {
    const imported = structuredClone(next);
    autoToken.current += 1;
    setAutoRunning(false);
    workflowRef.current = imported;
    setWorkflow(imported);
    undoStack.current = [];
    redoStack.current = [];
    setHistoryVersion((value) => value + 1);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setValidationIssues(null);
    const idle = engine.createIdleState();
    executionRef.current = idle;
    setExecution(idle);
    cleanWorkflowFingerprint.current = workflowFingerprint(imported);
    setDirty(false);
  }, []);

  const startExecution = useCallback(async () => {
    const token = ++autoToken.current;
    setAutoRunning(false);
    const next = await engine.start(workflowRef.current);
    if (token !== autoToken.current) return;
    executionRef.current = next;
    setExecution(next);
  }, []);

  const nextExecutionStep = useCallback(async () => {
    const token = ++autoToken.current;
    setAutoRunning(false);
    const next = await engine.step(workflowRef.current, executionRef.current);
    if (token !== autoToken.current) return;
    executionRef.current = next;
    setExecution(next);
  }, []);

  const resetExecution = useCallback(() => {
    autoToken.current += 1;
    setAutoRunning(false);
    const next = engine.createIdleState();
    executionRef.current = next;
    setExecution(next);
  }, []);

  const toggleAutoExecution = useCallback(async () => {
    if (autoRunning) {
      autoToken.current += 1;
      setAutoRunning(false);
      return;
    }

    const token = ++autoToken.current;
    setAutoRunning(true);

    let state = executionRef.current;
    if (state.status === 'idle' || state.status === 'completed' || state.status === 'failed') {
      state = await engine.start(workflowRef.current);
      if (token !== autoToken.current) return;
      executionRef.current = state;
      setExecution(state);
    }

    while (token === autoToken.current && state.status === 'running') {
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      if (token !== autoToken.current) break;
      state = await engine.step(workflowRef.current, state);
      executionRef.current = state;
      setExecution(state);
    }

    if (token === autoToken.current) setAutoRunning(false);
  }, [autoRunning]);

  const testScriptNode = useCallback(async (node: WorkflowNode, context: Record<string, unknown>) => {
    const contextAfter = structuredClone(context);
    const result = await executors.Script(node, { workflowContext: contextAfter, services });
    return { result, contextAfter };
  }, []);

  const selectedNode = useMemo(
    () => workflow.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [workflow.nodes, selectedNodeId],
  );
  const selectedEdge = useMemo(
    () => workflow.edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [workflow.edges, selectedEdgeId],
  );

  const value: DesignerContextValue = {
    workflow,
    selectedNodeId,
    selectedEdgeId,
    validationIssues,
    execution,
    dirty,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    autoRunning,
    snapEnabled,
    selectedNode,
    selectedEdge,
    selectNode: (id) => { setSelectedNodeId(id); setSelectedEdgeId(null); },
    selectEdge: (id) => { setSelectedEdgeId(id); setSelectedNodeId(null); },
    clearSelection: () => { setSelectedNodeId(null); setSelectedEdgeId(null); },
    pushHistory,
    addNode,
    updateNode,
    moveNode,
    deleteNode,
    duplicateNode,
    setStartNode,
    addEdge,
    updateEdge,
    deleteEdge,
    insertNodeIntoEdge,
    insertNodeBefore,
    insertNodeAfter,
    undo,
    redo,
    validate,
    resetWorkflow,
    importWorkflow,
    markClean: () => {
      cleanWorkflowFingerprint.current = workflowFingerprint(workflowRef.current);
      setDirty(false);
    },
    toggleSnap: () => setSnapEnabled((value) => !value),
    startExecution,
    nextExecutionStep,
    resetExecution,
    toggleAutoExecution,
    testScriptNode,
  };

  void historyVersion;

  return <DesignerContext.Provider value={value}>{children}</DesignerContext.Provider>;
}

export function useDesigner() {
  const context = useContext(DesignerContext);
  if (!context) throw new Error('useDesigner must be used inside DesignerProvider');
  return context;
}
