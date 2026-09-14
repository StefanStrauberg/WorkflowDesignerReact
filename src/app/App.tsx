import { useEffect, useState } from 'react';
import { DesignerProvider, useDesigner } from '../features/designer/state/DesignerContext';
import { Toolbar } from '../features/designer/components/Toolbar';
import { NodePalette } from '../features/designer/components/NodePalette';
import { WorkflowCanvas } from '../features/designer/components/WorkflowCanvas';
import { Inspector, type InspectorTab } from '../features/designer/components/Inspector';

export function App() {
  return (
    <DesignerProvider>
      <DesignerShell />
    </DesignerProvider>
  );
}

function DesignerShell() {
  const designer = useDesigner();
  const [paletteVisible, setPaletteVisible] = useState(true);
  const [inspectorVisible, setInspectorVisible] = useState(true);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('properties');

  const showRuntime = () => {
    setInspectorVisible(true);
    setInspectorTab('runtime');
  };

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!designer.dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [designer.dirty]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target?.matches('input, textarea, select, [contenteditable="true"]') ?? false;

      if ((event.ctrlKey || event.metaKey) && !editing) {
        if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
          event.preventDefault();
          designer.undo();
          return;
        }
        if (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey)) {
          event.preventDefault();
          designer.redo();
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          designer.validate();
          return;
        }
      }

      if (!editing && (event.key === 'Delete' || event.key === 'Backspace')) {
        if (designer.selectedNodeId) {
          event.preventDefault();
          designer.deleteNode(designer.selectedNodeId);
        } else if (designer.selectedEdgeId) {
          event.preventDefault();
          designer.deleteEdge(designer.selectedEdgeId);
        }
      }

      if (!editing && event.key === 'Escape') designer.clearSelection();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [designer]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Workflow Designer</h1>
          <p>React + Vite + TypeScript · domain/runtime/infrastructure separation</p>
        </div>
        <div className="workflow-meta">
          <span>{designer.workflow.name}</span>
          <span>v{designer.workflow.version}</span>
          <span className={`status-badge status-${designer.workflow.status.toLowerCase()}`}>{designer.workflow.status}</span>
          {designer.dirty && <span className="unsaved-badge">unsaved</span>}
        </div>
      </header>

      <Toolbar
        paletteVisible={paletteVisible}
        inspectorVisible={inspectorVisible}
        onTogglePalette={() => setPaletteVisible((value) => !value)}
        onToggleInspector={() => setInspectorVisible((value) => !value)}
        onShowRuntime={showRuntime}
      />

      <div
        className={`designer-layout ${!paletteVisible ? 'palette-hidden' : ''} ${!inspectorVisible ? 'inspector-hidden' : ''}`}
      >
        {paletteVisible && <NodePalette />}
        <WorkflowCanvas />
        {inspectorVisible && <Inspector tab={inspectorTab} onTabChange={setInspectorTab} />}
      </div>
    </div>
  );
}
