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

      {investigation.detectedIncidents?.length > 1 && (
        <>
          <strong>Detected Incidents</strong>
          <ul className="investigation-ai-list">
            {investigation.detectedIncidents.map((d, index) => (
              <li key={index}>
                {d.ruleName || d.incidentType} <span className="investigation-ai-inline-badge">{d.severity}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {investigation.probableRootCause && (
        <>
          <strong>Probable root cause</strong>
          <p>{investigation.probableRootCause}</p>
        </>
      )}

      {investigation.alternativeExplanations?.length > 0 && (
        <>
          <strong>Alternative explanations</strong>
          <ul className="investigation-ai-list">
            {investigation.alternativeExplanations.map((explanation, index) => (
              <li key={index}>{explanation}</li>
            ))}
          </ul>
        </>
      )}

      {investigation.businessImpact && (
        <>
          <strong>Business impact</strong>
          <p>{investigation.businessImpact}</p>
        </>
      )}

      {investigation.evidenceUsed?.length > 0 && (
        <>
          <strong>Evidence referenced</strong>
          <ul className="investigation-ai-list">
            {investigation.evidenceUsed.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
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
