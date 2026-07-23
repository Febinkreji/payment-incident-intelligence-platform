// Table-cell formatting only — truncation/joining for a glanceable row, not
// business logic. The full, untruncated values are always what's rendered
// in CandidateDetails/EvidencePanel; this exists purely so a dense table row
// stays scannable.

export function formatTimestamp(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

// <input type="datetime-local"> requires "YYYY-MM-DDTHH:mm" (no timezone,
// no seconds/milliseconds) — a raw ISO string like "2026-06-23T00:00:00.000Z"
// won't populate the field. This is the local-time counterpart to
// ScreeningFilters.jsx's handleApplyRange, which does `new Date(value).toISOString()`
// to go the other direction — round-tripping through the same local-time
// interpretation both ways.
export function toDatetimeLocalInputValue(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
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
