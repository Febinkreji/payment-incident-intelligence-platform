import { memo } from 'react'
import { PriorityBadge } from './PriorityBadge'
import { ConfidenceBadge } from './ConfidenceBadge'
import { RuleChip } from './RuleChip'
import { CandidateDetails } from './CandidateDetails'
import { formatTimestamp, truncate, summarizeEvidence } from '../../utils/screeningFormat'

const MAX_VISIBLE_RULE_CHIPS = 2

function CandidateRowImpl({ candidate, expanded, onToggleExpand, onInvestigate }) {
  const visibleRules = candidate.matchedRules.slice(0, MAX_VISIBLE_RULE_CHIPS)
  const hiddenRuleCount = candidate.matchedRules.length - visibleRules.length

  return (
    <>
      <tr className="screening-row" onClick={onToggleExpand} aria-expanded={expanded}>
        <td>
          <PriorityBadge priority={candidate.priority} />
        </td>
        <td>
          <ConfidenceBadge confidence={candidate.confidence} />
        </td>
        <td className="screening-cell-entity-type">{candidate.entityType}</td>
        <td className="screening-cell-entity-id" title={candidate.entityId}>
          {candidate.entityId}
        </td>
        <td>
          <div className="screening-rule-chip-list">
            {visibleRules.map((rule) => (
              <RuleChip key={rule.ruleId} ruleName={rule.ruleName} />
            ))}
            {hiddenRuleCount > 0 && <span className="screening-rule-chip-more">+{hiddenRuleCount}</span>}
          </div>
        </td>
        <td className="screening-cell-reason" title={candidate.reason}>
          {truncate(candidate.reason, 80)}
        </td>
        <td className="screening-cell-evidence" title={summarizeEvidence(candidate.evidence, 6)}>
          {truncate(summarizeEvidence(candidate.evidence), 70)}
        </td>
        <td className="screening-cell-timestamp">{formatTimestamp(candidate.entityTimestamp)}</td>
        <td className="screening-cell-timestamp">{formatTimestamp(candidate.timestamp)}</td>
        <td className="screening-cell-action" title={candidate.recommendedNextAction}>
          {truncate(candidate.recommendedNextAction, 50)}
        </td>
        <td>
          <button
            type="button"
            className="screening-investigate-button"
            onClick={(event) => {
              event.stopPropagation()
              onInvestigate(candidate)
            }}
          >
            Investigate
          </button>
        </td>
      </tr>

      {expanded && (
        <tr className="screening-row-details">
          <td colSpan={11}>
            <CandidateDetails candidate={candidate} />
          </td>
        </tr>
      )}
    </>
  )
}

// Candidates are re-created fresh on every fetch, but re-render only depends
// on this row's own candidate/expanded state — memoizing keeps re-expanding
// or re-collapsing one row from re-rendering every other row in a
// (potentially 50-200 row) table.
export const CandidateRow = memo(CandidateRowImpl)
