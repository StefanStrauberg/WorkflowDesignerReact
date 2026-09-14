import { useDesigner } from '../state/DesignerContext';

export function ValidationPanel() {
  const { validationIssues, validate } = useDesigner();

  const errors = validationIssues?.filter((issue) => issue.severity === 'error') ?? [];
  const warnings = validationIssues?.filter((issue) => issue.severity === 'warning') ?? [];

  return (
    <section className="inspector-section">
      <div className="section-header">
        <strong>Validation</strong>
        <button onClick={validate}>Проверить</button>
      </div>

      {validationIssues === null ? (
        <div className="validation neutral">Граф ещё не проверялся.</div>
      ) : validationIssues.length === 0 ? (
        <div className="validation ok">✓ Ошибок и предупреждений не найдено.</div>
      ) : (
        <div className={`validation ${errors.length ? 'error' : 'warning'}`}>
          {errors.length > 0 && (
            <div>
              <strong>Ошибки ({errors.length})</strong>
              <ul>{errors.map((issue) => <li key={`${issue.code}-${issue.nodeId ?? issue.edgeId ?? issue.message}`}>{issue.message}</li>)}</ul>
            </div>
          )}
          {warnings.length > 0 && (
            <div className={errors.length ? 'validation-gap' : ''}>
              <strong>Предупреждения ({warnings.length})</strong>
              <ul>{warnings.map((issue) => <li key={`${issue.code}-${issue.nodeId ?? issue.edgeId ?? issue.message}`}>{issue.message}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
