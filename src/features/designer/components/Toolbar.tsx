import { useRef } from 'react';
import type { WorkflowDefinition } from '../../../domain/workflow/model';
import { useDesigner } from '../state/DesignerContext';

interface Props {
  paletteVisible: boolean;
  inspectorVisible: boolean;
  onTogglePalette(): void;
  onToggleInspector(): void;
}

export function Toolbar({ paletteVisible, inspectorVisible, onTogglePalette, onToggleInspector }: Props) {
  const designer = useDesigner();
  const fileRef = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(designer.workflow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${designer.workflow.name.replace(/\s+/g, '-').toLowerCase() || 'workflow'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    designer.markClean();
  };

  return (
    <div className="toolbar">
      <button onClick={() => {
        if (window.confirm('Создать пустой workflow?')) designer.resetWorkflow();
      }}>Новый</button>
      <button className="primary" onClick={() => designer.addNode('Script', 300, 250)}>+ Node</button>
      <button disabled={!designer.canUndo} onClick={designer.undo}>↶ Undo</button>
      <button disabled={!designer.canRedo} onClick={designer.redo}>↷ Redo</button>
      <button onClick={designer.validate}>Проверить граф</button>
      <button onClick={designer.toggleSnap}>Snap: {designer.snapEnabled ? 'ON' : 'OFF'}</button>
      <span className="toolbar-separator" />
      <button onClick={() => void designer.startExecution()}>▶ Старт</button>
      <button onClick={() => void designer.nextExecutionStep()}>Следующий шаг</button>
      <button onClick={() => void designer.toggleAutoExecution()}>{designer.autoRunning ? 'Стоп' : 'Авто'}</button>
      <button onClick={designer.resetExecution}>Сброс</button>
      <span className="toolbar-separator" />
      <button onClick={exportJson}>Экспорт JSON</button>
      <button onClick={() => fileRef.current?.click()}>Импорт JSON</button>
      <input
        ref={fileRef}
        type="file"
        hidden
        accept="application/json,.json"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            const parsed = JSON.parse(await file.text()) as WorkflowDefinition;
            if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) throw new Error('Invalid workflow');
            designer.importWorkflow(parsed);
          } catch {
            window.alert('Некорректный JSON workflow.');
          } finally {
            event.target.value = '';
          }
        }}
      />
      <span className="toolbar-spacer" />
      <button onClick={onTogglePalette}>{paletteVisible ? 'Hide' : 'Show'} Palette</button>
      <button onClick={onToggleInspector}>{inspectorVisible ? 'Hide' : 'Show'} Inspector</button>
    </div>
  );
}
