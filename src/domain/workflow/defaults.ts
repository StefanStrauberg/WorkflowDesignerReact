import type { WorkflowDefinition, WorkflowNodeType } from './model';

export const GRID_SIZE = 24;
export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 96;

export function defaultConfigForType(type: WorkflowNodeType): Record<string, unknown> {
  switch (type) {
    case 'SetVariable':
      return { name: 'vendor', value: 'Huawei' };
    case 'Decision':
      return { variable: 'vendor' };
    case 'SnmpGet':
      return {
        oid: '1.3.6.1.2.1.1.5.0',
        output: 'raw.systemName',
        timeoutMs: 5000,
        mockValue: 'switch-01',
      };
    case 'SnmpWalk':
      return {
        oid: '1.3.6.1.2.1.2.2.1',
        output: 'raw.interfaces',
        timeoutMs: 5000,
        mockData: [
          { index: 1, name: 'GE0/0/1' },
          { index: 2, name: 'GE0/0/2' },
        ],
      };
    case 'Script':
      return {
        scriptKey: 'normalize-interfaces',
        input: '$raw.interfaces',
        output: 'normalized.ports',
        timeoutMs: 1500,
        scriptSource: `function execute(input, context) {
  if (!Array.isArray(input)) return [];

  return input.map((item, index) => ({
    index: item.index ?? index + 1,
    name: item.name ?? String(item),
    enabled: true
  }));
}`,
      };
    default:
      return {};
  }
}

export function createDemoWorkflow(): WorkflowDefinition {
  return {
    id: 'workflow-demo',
    name: 'Vendor Routing Demo',
    version: 1,
    status: 'Draft',
    startNodeId: 'n1',
    nodes: [
      { id: 'n1', type: 'Start', name: 'Start', key: 'start', config: {}, positionX: 80, positionY: 280 },
      { id: 'n2', type: 'SetVariable', name: 'Set Vendor = Huawei', key: 'set-vendor', config: { name: 'vendor', value: 'Huawei' }, positionX: 360, positionY: 280 },
      { id: 'n3', type: 'Decision', name: 'Choose Vendor', key: 'choose-vendor', config: { variable: 'vendor' }, positionX: 660, positionY: 280 },
      { id: 'n4', type: 'SnmpWalk', name: 'Read Huawei Interfaces', key: 'huawei-walk', config: defaultConfigForType('SnmpWalk'), positionX: 970, positionY: 100 },
      { id: 'n5', type: 'Script', name: 'Huawei Parser', key: 'huawei-parser', config: defaultConfigForType('Script'), positionX: 1260, positionY: 100 },
      { id: 'n6', type: 'Script', name: 'Juniper Parser', key: 'juniper-parser', config: { ...defaultConfigForType('Script'), scriptKey: 'juniper-parser' }, positionX: 970, positionY: 300 },
      { id: 'n7', type: 'Script', name: 'Generic Parser', key: 'generic-parser', config: { ...defaultConfigForType('Script'), scriptKey: 'generic-parser' }, positionX: 970, positionY: 500 },
      { id: 'n8', type: 'Join', name: 'Normalize Result', key: 'normalize', config: {}, positionX: 1570, positionY: 280 },
      { id: 'n9', type: 'End', name: 'End', key: 'end', config: {}, positionX: 1860, positionY: 280 },
    ],
    edges: [
      { id: 'e1', fromNodeId: 'n1', toNodeId: 'n2', condition: null, priority: 1 },
      { id: 'e2', fromNodeId: 'n2', toNodeId: 'n3', condition: null, priority: 1 },
      { id: 'e3', fromNodeId: 'n3', toNodeId: 'n4', condition: 'Huawei', priority: 1 },
      { id: 'e4', fromNodeId: 'n3', toNodeId: 'n6', condition: 'Juniper', priority: 2 },
      { id: 'e5', fromNodeId: 'n3', toNodeId: 'n7', condition: 'DEFAULT', priority: 100 },
      { id: 'e6', fromNodeId: 'n4', toNodeId: 'n5', condition: null, priority: 1 },
      { id: 'e7', fromNodeId: 'n5', toNodeId: 'n8', condition: null, priority: 1 },
      { id: 'e8', fromNodeId: 'n6', toNodeId: 'n8', condition: null, priority: 1 },
      { id: 'e9', fromNodeId: 'n7', toNodeId: 'n8', condition: null, priority: 1 },
      { id: 'e10', fromNodeId: 'n8', toNodeId: 'n9', condition: null, priority: 1 },
    ],
  };
}
