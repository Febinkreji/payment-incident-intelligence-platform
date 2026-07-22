// Builds the text that would be sent to a real LLM. Deliberately includes
// ONLY the fields the spec allows (incident summary, timeline, evidence,
// warnings, missing evidence) — never a raw evidence[].record (the full
// database row an Incident's evidence entry carries), only its human-
// readable `.note`, to keep token usage minimal and avoid leaking raw rows
// into a prompt.

function formatEvidence(evidence) {
  if (!evidence || evidence.length === 0) return '(no evidence recorded)'
  return evidence.map((e, i) => `${i + 1}. [${e.type}] ${e.note}`).join('\n')
}

function formatTimeline(timelineReferences) {
  if (!timelineReferences || timelineReferences.length === 0) return '(no timeline references)'
  return timelineReferences.map((t) => `${t.timestamp} — [${t.sourceTable}] ${t.eventType}: ${t.summary}`).join('\n')
}

function formatList(items, emptyLabel) {
  if (!items || items.length === 0) return emptyLabel
  return items.join('; ')
}

function buildPrompt(incident) {
  return [
    `Incident type: ${incident.incidentType}`,
    `Severity: ${incident.severity}`,
    `Confidence: ${incident.confidence}`,
    '',
    'Evidence:',
    formatEvidence(incident.evidence),
    '',
    'Timeline:',
    formatTimeline(incident.timelineReferences),
    '',
    'Correlation warnings:',
    formatList(incident.warnings, '(none)'),
    '',
    'Missing evidence:',
    formatList(incident.missingEvidence, '(none)'),
    '',
    'Based only on the information above, explain what happened, the most likely root cause, what additional evidence would help, what an engineer should investigate next, and recommended remediation steps. Respond as JSON matching the agreed investigation schema.',
  ].join('\n')
}

module.exports = { buildPrompt }
