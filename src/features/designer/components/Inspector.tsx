import { useEffect, useMemo, useState } from 'react';
import type { WorkflowNode, WorkflowNodeType } from '../../../domain/workflow/model';
import { defaultConfigForType } from '../../../domain/workflow/defaults';
import { useDesigner } from '../state/DesignerContext';
import { ExecutionPanel } from './ExecutionPanel';
import { ValidationPanel } from './ValidationPanel';

type Tab = 'properties' | 'runtime' | 'json';

export function Inspector() {
  const designer = useDesigner();
  const [tab, setTab] = useState<Tab>('properties');

  return (
    <aside className="inspector">
      <div className="inspector-tabs">
        <button className={tab === 'properties' ? 'active' : ''} onClick={() => setTab('properties')}>Properties</button>
        <button className={tab === 'runtime' ? 'active' : ''} onClick={() => setTab('runtime')}>Runtime</button>
        <button className={tab === 'json' ? 'active' : ''} onClick={() => setTab('json')}>JSON</button>
      </div>

      <div className="inspector-body">
        {tab === 'properties' && <PropertiesTab />}
        {tab === 'runtime' && <><ExecutionPanel /><ValidationPanel /></>}
        {tab === 'json' && (
          <section className="inspector-section">
            <strong>Workflow JSON {designer.dirty && <span className="dirty-dot" title="Есть несохранённые изменения" />}</strong>
            <pre className="json-pre">{JSON.stringify(designer.workflow, null, 2)}</pre>
          </section>
        )}
      </div>
    </aside>
  );
}

function PropertiesTab() {
  const designer = useDesigner();
  if (designer.selectedNode) return <NodeEditor node={designer.selectedNode} />;
  if (designer.selectedEdge) return <EdgeEditor />;

  return (
    <section className="inspector-section">
      <strong>Ничего не выбрано</strong>
      <p className="muted">Выбери Node или подпись Edge. Новые связи создаются перетягиванием от правого порта к левому.</p>
    </section>
  );
}

function NodeEditor({ node }: { node: WorkflowNode }) {
  const designer = useDesigner();
  const [name, setName] = useState(node.name);
  const [type, setType] = useState<WorkflowNodeType>(node.type);
  const [key, setKey] = useState(node.key);
  const [configText, setConfigText] = useState(JSON.stringify(node.config, null, 2));
  const [scriptInput, setScriptInput] = useState('');
  const [scriptOutput, setScriptOutput] = useState('');
  const [scriptTimeout, setScriptTimeout] = useState(1500);
  const [scriptSource, setScriptSource] = useState('');
  const [scriptTestResult, setScriptTestResult] = useState<string | null>(null);

  useEffect(() => {
    setName(node.name);
    setType(node.type);
    setKey(node.key);
    setConfigText(JSON.stringify(node.config, null, 2));
    setScriptInput(String(node.config.input ?? ''));
    setScriptOutput(String(node.config.output ?? ''));
    setScriptTimeout(Number(node.config.timeoutMs ?? 1500));
    setScriptSource(String(node.config.scriptSource ?? ''));
    setScriptTestResult(null);
  }, [node]);

  const scriptMode = type === 'Script';

  const save = () => {
    try {
      const config = JSON.parse(configText || '{}') as Record<string, unknown>;
      if (scriptMode) {
        config.input = scriptInput;
        config.output = scriptOutput;
        config.timeoutMs = scriptTimeout;
        config.scriptSource = scriptSource;
      }
      designer.updateNode(node.id, { name, type, key, config });
    } catch {
      window.alert('Config должен быть валидным JSON.');
    }
  };

  return (
    <section className="inspector-section">
      <div className="section-header"><strong>Node properties</strong><span className="muted">{node.id}</span></div>
      <label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Type
        <select value={type} onChange={(event) => {
          const nextType = event.target.value as WorkflowNodeType;
          setType(nextType);
          if (nextType === 'Script' && !scriptSource) {
            const defaults = defaultConfigForType('Script');
            setScriptInput(String(defaults.input ?? ''));
            setScriptOutput(String(defaults.output ?? ''));
            setScriptTimeout(Number(defaults.timeoutMs ?? 1500));
            setScriptSource(String(defaults.scriptSource ?? ''));
          }
        }}>
          {(['Start','End','Decision','Join','SetVariable','SnmpGet','SnmpWalk','Script'] as WorkflowNodeType[]).map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label>Key<input value={key} onChange={(event) => setKey(event.target.value)} /></label>
      <label>Config JSON<textarea value={configText} onChange={(event) => setConfigText(event.target.value)} rows={9} /></label>

      {scriptMode && (
        <div className="script-box">
          <strong>JavaScript Script Node</strong>
          <p className="muted">Контракт: <code>function execute(input, context)</code>. Return записывается в Output path либо может быть NodeResult-подобным объектом.</p>
          <label>Input path<input value={scriptInput} onChange={(event) => setScriptInput(event.target.value)} /></label>
          <label>Output path<input value={scriptOutput} onChange={(event) => setScriptOutput(event.target.value)} /></label>
          <label>Timeout, ms<input type="number" min={50} max={30000} value={scriptTimeout} onChange={(event) => setScriptTimeout(Number(event.target.value) || 1500)} /></label>
          <label>JavaScript<textarea className="code-editor" value={scriptSource} onChange={(event) => setScriptSource(event.target.value)} rows={16} spellCheck={false} /></label>
          <button onClick={async () => {
            try {
              const config = JSON.parse(configText || '{}') as Record<string, unknown>;
              const testNode: WorkflowNode = {
                ...node,
                name,
                type: 'Script',
                key,
                config: { ...config, input: scriptInput, output: scriptOutput, timeoutMs: scriptTimeout, scriptSource },
              };
              const test = await designer.testScriptNode(testNode, designer.execution.context);
              setScriptTestResult(JSON.stringify(test, null, 2));
            } catch (error) {
              setScriptTestResult(String(error));
            }
          }}>▶ Тестировать Script</button>
          {scriptTestResult && <pre className="script-test-result">{scriptTestResult}</pre>}
        </div>
      )}

      <div className="button-grid">
        <button className="primary" onClick={save}>Сохранить</button>
        <button onClick={() => designer.duplicateNode(node.id)}>Duplicate</button>
        <button onClick={() => designer.insertNodeBefore(node.id)}>+ До</button>
        <button onClick={() => designer.insertNodeAfter(node.id)}>+ После</button>
        <button onClick={() => designer.setStartNode(node.id)}>Make Start</button>
        <button onClick={() => designer.deleteNode(node.id, true)}>Delete + reconnect</button>
      </div>
      <button className="danger full" onClick={() => designer.deleteNode(node.id)}>Удалить Node</button>
    </section>
  );
}

function EdgeEditor() {
  const designer = useDesigner();
  const edge = designer.selectedEdge!;
  const [condition, setCondition] = useState(edge.condition ?? '');
  const [priority, setPriority] = useState(edge.priority);

  useEffect(() => {
    setCondition(edge.condition ?? '');
    setPriority(edge.priority);
  }, [edge]);

  const from = useMemo(() => designer.workflow.nodes.find((node) => node.id === edge.fromNodeId), [designer.workflow.nodes, edge.fromNodeId]);
  const to = useMemo(() => designer.workflow.nodes.find((node) => node.id === edge.toNodeId), [designer.workflow.nodes, edge.toNodeId]);

  return (
    <section className="inspector-section">
      <strong>Edge properties</strong>
      <p className="muted">{from?.name ?? edge.fromNodeId} → {to?.name ?? edge.toNodeId}</p>
      <label>Condition<input value={condition} onChange={(event) => setCondition(event.target.value)} placeholder="Huawei / DEFAULT / пусто" /></label>
      <label>Priority<input type="number" value={priority} onChange={(event) => setPriority(Number(event.target.value) || 1)} /></label>
      <div className="button-grid">
        <button className="primary" onClick={() => designer.updateEdge(edge.id, { condition: condition.trim() || null, priority })}>Сохранить</button>
        <button onClick={() => designer.insertNodeIntoEdge(edge.id)}>+ Node в Edge</button>
      </div>
      <button className="danger full" onClick={() => designer.deleteEdge(edge.id)}>Удалить Edge</button>
    </section>
  );
}
