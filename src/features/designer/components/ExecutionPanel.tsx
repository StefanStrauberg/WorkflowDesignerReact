import { useDesigner } from '../state/DesignerContext';

export function ExecutionPanel() {
  const { execution } = useDesigner();

  return (
    <>
      <section className="inspector-section">
        <strong>Execution</strong>
        <dl className="runtime-summary">
          <dt>Status</dt><dd>{execution.status}</dd>
          <dt>Current Node</dt><dd>{execution.currentNodeId ?? '—'}</dd>
          <dt>Why this Edge?</dt><dd>{execution.why}</dd>
        </dl>
        <label>NodeResult</label>
        <pre>{JSON.stringify(execution.result ?? {}, null, 2)}</pre>
        <label>WorkflowContext</label>
        <pre>{JSON.stringify(execution.context, null, 2)}</pre>
      </section>

      <section className="inspector-section">
        <strong>Execution Log</strong>
        <div className="execution-log">
          {!execution.logs.length && <p className="muted">Workflow ещё не выполнялся.</p>}
          {execution.logs.map((entry, index) => (
            <div className="execution-row" key={`${entry.nodeId}-${index}`}>
              <div>
                <span className={entry.success ? 'exec-success' : 'exec-failure'}>{entry.success ? '✓' : '✗'}</span>{' '}
                <strong>{entry.nodeName}</strong> <span className="muted">({entry.nodeType})</span>
              </div>
              <small>
                #{index + 1} · {(entry.finishedAt - entry.startedAt).toFixed(1)} ms
                {entry.decision !== null ? ` · Decision=${entry.decision}` : ''}
              </small>
              {entry.error && <div className="execution-error">{entry.error}</div>}
              {entry.logs.length > 0 && <div className="console-log">console: {entry.logs.join(' | ')}</div>}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
