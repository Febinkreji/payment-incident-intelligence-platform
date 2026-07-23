import { RuleChip } from './RuleChip'
import { EvidencePanel } from './EvidencePanel'
import { explainPriority, explainConfidence } from '../../utils/screeningExplanations'

// Expanded row content — every field here comes straight from the candidate
// object the API already returned; nothing is re-fetched or recomputed.
export function CandidateDetails({ candidate }) {
  return (
    <div className="screening-candidate-details">
      <div className="screening-details-grid">
        <div className="screening-details-block">
          <h4>Matched Rules</h4>
          <div className="screening-rule-chip-list">
            {candidate.matchedRules.map((rule) => (
              <RuleChip key={rule.ruleId} ruleName={rule.ruleName} />
            ))}
          </div>
        </div>

        <div className="screening-details-block">
          <h4>Reason</h4>
          <p>{candidate.reason}</p>
        </div>

        <div className="screening-details-block">
          <h4>Priority Explanation</h4>
          <p>{explainPriority(candidate)}</p>
        </div>

        <div className="screening-details-block">
          <h4>Confidence Explanation</h4>
          <p>{explainConfidence(candidate)}</p>
        </div>

        <div className="screening-details-block">
          <h4>Recommended Next Action</h4>
          <p>{candidate.recommendedNextAction}</p>
        </div>

        <div className="screening-details-block screening-details-meta">
          <h4>Screening Context</h4>
          <dl className="screening-evidence-list">
            <div className="screening-evidence-row">
              <dt>Window Used</dt>
              <dd>{candidate.windowLabel || '—'}</dd>
            </div>
            <div className="screening-evidence-row">
              <dt>Rule Evaluation Timestamp</dt>
              <dd>{candidate.timestamp ? new Date(candidate.timestamp).toLocaleString() : '—'}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="screening-details-block">
        <h4>Complete Evidence</h4>
        <EvidencePanel evidence={candidate.evidence} />
      </div>
    </div>
  )
}
