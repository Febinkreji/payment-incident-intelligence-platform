import { formatTimestamp } from '../../utils/screeningFormat'

// Every value rendered here comes directly from the engine's `metadata`
// object (screeningEngine.js's evaluate() return value, passed through
// unchanged by screeningController.js) — nothing on this page recomputes a
// count or a duration from the candidate list itself.
export function ScreeningSummary({ metadata }) {
  const { priorityBreakdown, rulesExecuted, candidatesGenerated, entitiesEvaluated, evaluationTimeMs, window, generatedAt } =
    metadata

  return (
    <div className="ui-grid ui-grid-auto">
      <div className="kpi-card kpi-card-critical">
        <div className="kpi-card-top">
          <span className="kpi-card-label">Critical</span>
        </div>
        <span className="kpi-card-value">{priorityBreakdown.CRITICAL}</span>
      </div>

      <div className="kpi-card kpi-card-warning">
        <div className="kpi-card-top">
          <span className="kpi-card-label">High</span>
        </div>
        <span className="kpi-card-value">{priorityBreakdown.HIGH}</span>
      </div>

      <div className="kpi-card">
        <div className="kpi-card-top">
          <span className="kpi-card-label">Medium</span>
        </div>
        <span className="kpi-card-value">{priorityBreakdown.MEDIUM}</span>
      </div>

      <div className="kpi-card kpi-card-success">
        <div className="kpi-card-top">
          <span className="kpi-card-label">Low</span>
        </div>
        <span className="kpi-card-value">{priorityBreakdown.LOW}</span>
      </div>

      <div className="kpi-card">
        <div className="kpi-card-top">
          <span className="kpi-card-label">Rules Executed</span>
        </div>
        <span className="kpi-card-value">{rulesExecuted}</span>
      </div>

      <div className="kpi-card">
        <div className="kpi-card-top">
          <span className="kpi-card-label">Candidates Generated</span>
        </div>
        <span className="kpi-card-value">{candidatesGenerated}</span>
      </div>

      <div className="kpi-card">
        <div className="kpi-card-top">
          <span className="kpi-card-label">Entities Evaluated</span>
        </div>
        <span className="kpi-card-value">{entitiesEvaluated}</span>
      </div>

      <div className="kpi-card">
        <div className="kpi-card-top">
          <span className="kpi-card-label">Evaluation Time</span>
        </div>
        <span className="kpi-card-value">{Math.round(evaluationTimeMs)} ms</span>
      </div>

      <div className="kpi-card">
        <div className="kpi-card-top">
          <span className="kpi-card-label">Screening Window</span>
        </div>
        <span className="kpi-card-value screening-kpi-value-text">{window.label}</span>
      </div>

      <div className="kpi-card">
        <div className="kpi-card-top">
          <span className="kpi-card-label">Generated</span>
        </div>
        <span className="kpi-card-value screening-kpi-value-text">{formatTimestamp(generatedAt)}</span>
      </div>
    </div>
  )
}
