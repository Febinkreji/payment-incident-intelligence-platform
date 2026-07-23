// Table-cell formatting only — truncation/joining for a glanceable row, not
// business logic. The full, untruncated values are always what's rendered
// in CandidateDetails/EvidencePanel; this exists purely so a dense table row
// stays scannable.

export function formatTimestamp(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

export function truncate(text, maxLength = 90) {
  if (!text) return ''
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

// A short "label: value" preview of the first couple of evidence rows, e.g.
// "Payment Status: PAYMENT_FAILED · HTTP Status: 503" — enough for an
// operator to glance at without opening the row, not a replacement for the
// full evidence list.
export function summarizeEvidence(evidence, maxItems = 2) {
  if (!evidence || evidence.length === 0) return 'No evidence recorded'
  return evidence
    .slice(0, maxItems)
    .map((row) => `${row.label}: ${row.value ?? '—'}`)
    .join(' · ')
}
