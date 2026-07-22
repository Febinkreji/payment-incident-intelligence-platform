// Builds the text that would be sent to a real LLM. Deliberately includes
// ONLY the fields the spec allows (incident summary, correlation summary,
// timeline, evidence, warnings, missing evidence) — never a raw evidence[]
// .record wholesale, only the specific fields each section needs, to keep
// token usage minimal and avoid leaking raw rows into a prompt.
//
// Sprint 9D.5: restructures the same underlying evidence (no new data) into
// dedicated sections — Correlation Summary, sibling Detected Incidents,
// Payment Event history, API Log activity — instead of one flat numbered
// list, so the prompt is deterministic and grouped rather than larger.
const {
  evidenceOfType,
  summarizeApiLogEvidence,
  summarizePaymentEventEvidence,
  summarizeCorrelation,
  summarizeSiblingIncidents,
} = require('./evidenceSummary')

function formatList(items, emptyLabel) {
  if (!items || items.length === 0) return emptyLabel
  return items.join('; ')
}

function formatCorrelationSummary(incident) {
  const c = summarizeCorrelation(incident)
  return [
    `  Merchant: ${c.merchant || '(none)'}`,
    `  Store: ${c.store || '(none)'}`,
    `  Terminal: ${c.terminal || '(none)'}`,
    `  Order: ${c.order || '(none)'}`,
    `  Payment: ${c.payment || '(none)'}`,
    `  Correlation warnings: ${formatList(c.warnings, '(none)')}`,
  ].join('\n')
}

function formatSiblingIncidents(incident, siblingIncidents) {
  const siblings = summarizeSiblingIncidents(incident, siblingIncidents)
  if (siblings.length === 0) return '  (no other incidents detected on this correlation)'
  return siblings.map((s) => `  - ${s.incidentType} (${s.ruleName}) — ${s.severity} severity`).join('\n')
}

function formatPaymentEventHistory(incident) {
  const summary = summarizePaymentEventEvidence(incident)
  if (!summary.present) return '  (no payment_events evidence was gathered for this incident)'
  return summary.transitions
    .map((t, i) => `  ${i + 1}. ${t.status} at ${t.timestamp}${t.reason ? ` — ${t.reason}` : ''}`)
    .join('\n')
}

function formatApiLogActivity(incident) {
  const summary = summarizeApiLogEvidence(incident)
  if (!summary.present) {
    return '  No API log evidence was available for this incident — gateway-side timing and retry behavior cannot be assessed from what was gathered.'
  }
  const lines = summary.calls.map(
    (c, i) =>
      `  ${i + 1}. ${c.method || 'CALL'} ${c.endpoint || '(unknown endpoint)'} -> ${c.statusCode ?? '?'}${c.status ? ` [${c.status}]` : ''}${c.latencyMs !== null ? ` (${c.latencyMs}ms)` : ''}`
  )
  lines.push(`  Retry activity detected: ${summary.retryDetected ? 'yes' : 'no'}`)
  return lines.join('\n')
}

// Evidence entries not already broken out into their own section above
// (payment_event/api_log) — e.g. 'payment', 'order', 'terminal_event' —
// still shown, just not duplicated across two sections.
function formatOtherEvidence(incident) {
  const other = (incident.evidence || []).filter((e) => e.type !== 'payment_event' && e.type !== 'api_log')
  if (other.length === 0) return '  (none)'
  return other.map((e, i) => `  ${i + 1}. [${e.type}] ${e.note}`).join('\n')
}

function formatTimeline(timelineReferences) {
  if (!timelineReferences || timelineReferences.length === 0) return '  (no timeline references)'
  return timelineReferences.map((t) => `  ${t.timestamp} — [${t.sourceTable}] ${t.eventType}: ${t.summary}`).join('\n')
}

function buildPrompt(incident, siblingIncidents = []) {
  return [
    `Incident type: ${incident.incidentType}`,
    `Rule: ${incident.ruleName || incident.incidentType}`,
    `Severity: ${incident.severity}`,
    `Confidence: ${incident.confidence}`,
    incident.description ? `Description: ${incident.description}` : null,
    '',
    'Correlation Summary:',
    formatCorrelationSummary(incident),
    '',
    'Other incidents detected on this correlation:',
    formatSiblingIncidents(incident, siblingIncidents),
    '',
    'Payment Event History:',
    formatPaymentEventHistory(incident),
    '',
    'API Log Activity:',
    formatApiLogActivity(incident),
    '',
    'Other Evidence:',
    formatOtherEvidence(incident),
    '',
    'Timeline:',
    formatTimeline(incident.timelineReferences),
    '',
    'Missing evidence:',
    formatList(incident.missingEvidence, '(none)'),
    '',
    'Based ONLY on the information above — never invent a fact not shown here — produce a JSON object with: executiveSummary, detectedIncidents (restate the sibling incidents above, if any), probableRootCause, alternativeExplanations (an array; state plainly if none are plausible given the evidence), businessImpact (grounded in the affected payment/order/merchant above, not speculative), recommendedActions, confidence (LOW/MEDIUM/HIGH, and explicitly explain the reasoning if LOW), and assumptions (state clearly whenever a conclusion could not be fully confirmed from the evidence, especially when API log or payment event evidence is absent).',
  ]
    .filter((line) => line !== null)
    .join('\n')
}

module.exports = { buildPrompt }
