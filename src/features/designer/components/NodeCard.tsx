import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { WorkflowNode } from '../../../domain/workflow/model';

interface Props {
  node: WorkflowNode;
  selected: boolean;
  current: boolean;
  done: boolean;
  connectingFrom: string | null;
  onSelect(): void;
  onDragStart(event: ReactPointerEvent<HTMLDivElement>): void;
  onOutputStart(event: ReactPointerEvent<HTMLButtonElement>): void;
  onInputFinish(event: ReactPointerEvent<HTMLButtonElement>): void;
  onContextMenu(event: ReactMouseEvent<HTMLDivElement>): void;
}

export function NodeCard({
  node,
  selected,
  current,
  done,
  connectingFrom,
  onSelect,
  onDragStart,
  onOutputStart,
  onInputFinish,
  onContextMenu,
}: Props) {
  return (
    <div
      className={[
        'workflow-node',
        `node-${node.type.toLowerCase()}`,
        selected ? 'selected' : '',
        current ? 'exec-current' : '',
        done ? 'exec-done' : '',
      ].filter(Boolean).join(' ')}
      style={{ left: node.positionX, top: node.positionY }}
      onPointerDown={onDragStart}
      onContextMenu={onContextMenu}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <button
        className={`node-port input-port ${connectingFrom && connectingFrom !== node.id ? 'available' : ''}`}
        aria-label="Input port"
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={onInputFinish}
      />
      <button
        className="node-port output-port"
        aria-label="Output port"
        onPointerDown={onOutputStart}
      />
      <div className="node-head">
        <span className="node-type">{node.type}</span>
        <span className="node-key">{node.key}</span>
      </div>
      <div className="node-body">
        <strong>{node.name}</strong>
        <small>{summarizeConfig(node.config)}</small>
      </div>
    </div>
  );
}

function summarizeConfig(config: Record<string, unknown>) {
  const entries = Object.entries(config).filter(([key]) => key !== 'scriptSource');
  if (!entries.length) return 'config: {}';
  return entries
    .slice(0, 2)
    .map(([key, value]) => `${key}=${shortValue(value)}`)
    .join(', ');
}

function shortValue(value: unknown) {
  const serialized = typeof value === 'string' ? value : (JSON.stringify(value) ?? String(value));
  return serialized.length > 28 ? `${serialized.slice(0, 25)}…` : serialized;
}
