// Evidence rows are already presentation-ready {label, value} pairs from the
// backend (screeningModels.evidenceRow) — this only lays them out, it never
// reshapes or reinterprets the values.
export function EvidencePanel({ evidence }) {
  if (!evidence || evidence.length === 0) {
    return <p className="ui-empty-state">No evidence recorded.</p>
  }

  return (
    <dl className="screening-evidence-list">
      {evidence.map((row, index) => (
        <div className="screening-evidence-row" key={`${row.label}-${index}`}>
          <dt>{row.label}</dt>
          <dd>{row.value === null || row.value === undefined || row.value === '' ? '—' : String(row.value)}</dd>
        </div>
      ))}
    </dl>
  )
}
