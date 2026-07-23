// Compact, non-interactive label for one matched rule — deliberately not a
// button/link (matching a rule isn't an action an operator takes), just a
// scannable fact about why this candidate is on the list.
export function RuleChip({ ruleName }) {
  return <span className="screening-rule-chip">{ruleName}</span>
}
