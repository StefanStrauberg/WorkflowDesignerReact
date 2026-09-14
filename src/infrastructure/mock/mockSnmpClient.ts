import type { SnmpClient } from '../../application/runtime/contracts';
import type { WorkflowNode } from '../../domain/workflow/model';

export class MockSnmpClient implements SnmpClient {
  async get(node: WorkflowNode): Promise<unknown> {
    await delay(120);
    return structuredClone(node.config.mockValue ?? `mock:${String(node.config.oid ?? '')}`);
  }

  async walk(node: WorkflowNode): Promise<unknown> {
    await delay(180);
    return structuredClone(
      node.config.mockData ?? [
        { index: 1, name: 'GE0/0/1' },
        { index: 2, name: 'GE0/0/2' },
      ],
    );
  }
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
