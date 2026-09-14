import { NODE_HEIGHT, NODE_WIDTH } from '../../../domain/workflow/defaults';
import type { WorkflowDefinition } from '../../../domain/workflow/model';

interface Props {
  workflow: WorkflowDefinition;
  selectedEdgeId: string | null;
  chosenEdgeIds: string[];
  preview: { fromNodeId: string; x: number; y: number } | null;
  onSelectEdge(id: string): void;
}

export function EdgeLayer({ workflow, selectedEdgeId, chosenEdgeIds, preview, onSelectEdge }: Props) {
  const nodeMap = new Map(workflow.nodes.map((node) => [node.id, node]));

  return (
    <svg className="edge-layer" width="4200" height="2600">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" />
        </marker>
        <marker id="arrowChosen" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" />
        </marker>
      </defs>

      {workflow.edges.map((edge) => {
        const from = nodeMap.get(edge.fromNodeId);
        const to = nodeMap.get(edge.toNodeId);
        if (!from || !to) return null;
        const geometry = edgeGeometry(from.positionX, from.positionY, to.positionX, to.positionY);
        const chosen = chosenEdgeIds.includes(edge.id);
        const selected = selectedEdgeId === edge.id;
        const label = edge.condition ?? '→';
        const width = Math.max(28, label.length * 7 + 14);

        return (
          <g key={edge.id} className={`edge-group ${selected ? 'selected' : ''} ${chosen ? 'chosen' : ''}`}>
            <path
              className="edge-path"
              d={geometry.path}
              markerEnd={chosen ? 'url(#arrowChosen)' : 'url(#arrow)'}
            />
            <g
              className="edge-label-svg"
              transform={`translate(${geometry.midX - width / 2},${geometry.midY - 13})`}
              onClick={(event) => {
                event.stopPropagation();
                onSelectEdge(edge.id);
              }}
            >
              <rect width={width} height="26" rx="13" />
              <text x={width / 2} y="17" textAnchor="middle">{label}</text>
            </g>
          </g>
        );
      })}

      {preview && (() => {
        const from = nodeMap.get(preview.fromNodeId);
        if (!from) return null;
        const startX = from.positionX + NODE_WIDTH;
        const startY = from.positionY + NODE_HEIGHT / 2;
        const dx = Math.max(70, Math.abs(preview.x - startX) * 0.45);
        return (
          <path
            className="preview-edge"
            d={`M ${startX} ${startY} C ${startX + dx} ${startY}, ${preview.x - dx} ${preview.y}, ${preview.x} ${preview.y}`}
          />
        );
      })()}
    </svg>
  );
}

function edgeGeometry(fromX: number, fromY: number, toX: number, toY: number) {
  const startX = fromX + NODE_WIDTH;
  const startY = fromY + NODE_HEIGHT / 2;
  const endX = toX;
  const endY = toY + NODE_HEIGHT / 2;
  const dx = Math.max(80, Math.abs(endX - startX) * 0.45);
  return {
    path: `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`,
    midX: (startX + endX) / 2,
    midY: (startY + endY) / 2,
  };
}
