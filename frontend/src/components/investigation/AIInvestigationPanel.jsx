import './investigation.css'

function ConfidenceBadge({ confidence }) {
  if (!confidence) return null
  return <span className={`badge badge-confidence-${confidence.toLowerCase()}`}>{confidence} confidence</span>
}

export function AIInvestigationPanel({ investigation }) {
  if (!investigation) {
    return <p className="ui-empty-state">No AI investigation is available for this incident.</p>
  }

  return (
    <div className="investigation-ai-panel">
      <div className="investigation-incident-header">
        <strong>AI Investigation</strong>
        <ConfidenceBadge confidence={investigation.confidence} />
      </div>

      <p>{investigation.executiveSummary}</p>

      {investigation.probableRootCause && (
        <>
          <strong>Probable root cause</strong>
          <p>{investigation.probableRootCause}</p>
        </>
      )}

      {investigation.investigationSteps?.length > 0 && (
        <>
          <strong>Investigation steps</strong>
          <ul className="investigation-ai-list">
            {investigation.investigationSteps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ul>
        </>
      )}

      {investigation.recommendedActions?.length > 0 && (
        <>
          <strong>Recommended actions</strong>
          <ul className="investigation-ai-list">
            {investigation.recommendedActions.map((action, index) => (
              <li key={index}>{action}</li>
            ))}
          </ul>
        </>
      )}

      {investigation.assumptions?.length > 0 && (
        <>
          <strong>Assumptions</strong>
          <ul className="investigation-ai-list">
            {investigation.assumptions.map((assumption, index) => (
              <li key={index}>{assumption}</li>
            ))}
          </ul>
        </>
      )}

      {investigation.parseError && (
        <p className="investigation-parse-warning">
          ⚠ The investigation response could not be fully parsed — showing partial results.
        </p>
      )}
    </div>
  )
}
