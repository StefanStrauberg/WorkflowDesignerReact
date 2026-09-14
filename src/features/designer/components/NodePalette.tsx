import type { WorkflowNodeType } from '../../../domain/workflow/model';

const groups: Array<{ title: string; items: Array<{ type: WorkflowNodeType; description: string }> }> = [
  {
    title: 'Flow',
    items: [
      { type: 'Start', description: 'Точка входа' },
      { type: 'Decision', description: 'Выбор ветки' },
      { type: 'Join', description: 'Сведение веток' },
      { type: 'End', description: 'Завершение' },
    ],
  },
  { title: 'Variables', items: [{ type: 'SetVariable', description: 'Записать значение в Context' }] },
  {
    title: 'Network',
    items: [
      { type: 'SnmpGet', description: 'Получить одно значение' },
      { type: 'SnmpWalk', description: 'Пройти ветку OID' },
    ],
  },
  { title: 'Processing', items: [{ type: 'Script', description: 'JavaScript обработка' }] },
];

export function NodePalette() {
  return (
    <aside className="palette">
      <h2>Node Palette</h2>
      {groups.map((group) => (
        <section className="palette-group" key={group.title}>
          <div className="palette-title">{group.title}</div>
          {group.items.map((item) => (
            <div
              className="palette-item"
              draggable
              data-node-type={item.type}
              key={item.type}
              onDragStart={(event) => {
                event.dataTransfer.setData('application/workflow-node-type', item.type);
                event.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <strong>{item.type}</strong>
              <span>{item.description}</span>
            </div>
          ))}
        </section>
      ))}
      <p className="palette-tip">Перетащи Node на canvas, затем соедини её мышкой через порты.</p>
    </aside>
  );
}
