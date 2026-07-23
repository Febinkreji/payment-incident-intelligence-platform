// Mirrors the ConfidenceBadge already defined inline in
// investigation/AIInvestigationPanel.jsx (same badge-confidence-* classes,
// same LOW/MEDIUM/HIGH value set from the backend's CONFIDENCE enum) — made
// reusable here since the screening table needs the same visual language in
// a compact table cell rather than a panel heading.
export function ConfidenceBadge({ confidence }) {
  return <span className={`badge badge-confidence-${confidence.toLowerCase()}`}>{confidence}</span>
}
