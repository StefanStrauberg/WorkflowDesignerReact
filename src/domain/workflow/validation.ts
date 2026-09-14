import type { ValidationIssue, WorkflowDefinition } from './model';

export function validateWorkflow(workflow: WorkflowDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set(workflow.nodes.map((node) => node.id));

  const addError = (code: string, message: string, extra: Partial<ValidationIssue> = {}) =>
    issues.push({ severity: 'error', code, message, ...extra });
  const addWarning = (code: string, message: string, extra: Partial<ValidationIssue> = {}) =>
    issues.push({ severity: 'warning', code, message, ...extra });

  if (!workflow.nodes.length) addError('workflow.empty', 'Workflow не содержит Node.');

  if (!workflow.startNodeId) {
    addError('start.missing', 'Не задан startNodeId.');
  } else if (!nodeIds.has(workflow.startNodeId)) {
    addError('start.invalid', 'startNodeId указывает на несуществующую Node.');
  }

  const startNodes = workflow.nodes.filter((node) => node.type === 'Start');
  if (!startNodes.length) addWarning('start.type.missing', 'Нет Node типа Start.');
  if (startNodes.length > 1) addWarning('start.multiple', `Найдено несколько Start Node: ${startNodes.length}.`);

  for (const edge of workflow.edges) {
    if (!nodeIds.has(edge.fromNodeId)) addError('edge.from.invalid', `Edge ${edge.id}: fromNodeId не существует.`, { edgeId: edge.id });
    if (!nodeIds.has(edge.toNodeId)) addError('edge.to.invalid', `Edge ${edge.id}: toNodeId не существует.`, { edgeId: edge.id });
    if (edge.fromNodeId === edge.toNodeId) addWarning('edge.self', `Edge ${edge.id}: Node соединена сама с собой.`, { edgeId: edge.id });
  }

  const outgoing = (nodeId: string) => workflow.edges.filter((edge) => edge.fromNodeId === nodeId);

  for (const node of workflow.nodes) {
    const edges = outgoing(node.id);

    if (node.type === 'Decision') {
      if (edges.length < 2) addWarning('decision.few-edges', `Decision "${node.name}" имеет меньше двух исходящих Edge.`, { nodeId: node.id });
      const conditions = edges.map((edge) => edge.condition).filter((value): value is string => Boolean(value));
      if (conditions.length !== new Set(conditions).size) addWarning('decision.duplicate-condition', `Decision "${node.name}" имеет повторяющиеся Condition.`, { nodeId: node.id });
      if (edges.length >= 2 && !edges.some((edge) => edge.condition === 'DEFAULT')) addWarning('decision.no-default', `Decision "${node.name}" не имеет DEFAULT-ветки.`, { nodeId: node.id });
    }

    if (node.type === 'End' && edges.length) addWarning('end.outgoing', `End Node "${node.name}" имеет исходящие Edge.`, { nodeId: node.id });

    if (node.type === 'SnmpGet' || node.type === 'SnmpWalk') {
      if (typeof node.config.oid !== 'string' || !node.config.oid.trim()) addError('snmp.oid.missing', `${node.type} "${node.name}" не содержит oid.`, { nodeId: node.id });
      if (typeof node.config.output !== 'string' || !node.config.output.trim()) addWarning('snmp.output.missing', `${node.type} "${node.name}" не содержит output.`, { nodeId: node.id });
    }

    if (node.type === 'Script') {
      if (typeof node.config.scriptSource !== 'string' || !node.config.scriptSource.trim()) addError('script.source.missing', `Script "${node.name}" не содержит JavaScript source.`, { nodeId: node.id });
      const timeout = Number(node.config.timeoutMs ?? 1500);
      if (timeout < 50 || timeout > 30000) addError('script.timeout.invalid', `Script "${node.name}" имеет timeoutMs вне диапазона 50..30000.`, { nodeId: node.id });
    }
  }

  if (workflow.startNodeId && nodeIds.has(workflow.startNodeId)) {
    const reachable = new Set<string>();
    const queue = [workflow.startNodeId];

    while (queue.length) {
      const id = queue.shift()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      outgoing(id).forEach((edge) => nodeIds.has(edge.toNodeId) && queue.push(edge.toNodeId));
    }

    workflow.nodes
      .filter((node) => !reachable.has(node.id))
      .forEach((node) => addWarning('node.unreachable', `Node "${node.name}" недостижима от Start.`, { nodeId: node.id }));

    if (!workflow.nodes.some((node) => node.type === 'End' && reachable.has(node.id))) {
      addError('end.unreachable', 'От Start нет ни одного пути к End.');
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();
    let cycleFound = false;

    const visit = (id: string) => {
      if (visiting.has(id)) {
        cycleFound = true;
        return;
      }
      if (visited.has(id) || cycleFound) return;
      visiting.add(id);
      outgoing(id).forEach((edge) => nodeIds.has(edge.toNodeId) && visit(edge.toNodeId));
      visiting.delete(id);
      visited.add(id);
    };

    visit(workflow.startNodeId);
    if (cycleFound) addWarning('workflow.cycle', 'Обнаружен цикл. В production loop должен иметь явный лимит итераций.');
  }

  return issues;
}
