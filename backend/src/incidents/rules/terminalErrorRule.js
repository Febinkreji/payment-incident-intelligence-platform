const RULE_ID = 'TERMINAL_ERROR'
const INCIDENT_TYPE = 'TERMINAL_ERROR'
const MIN_ERROR_COUNT = 2 // "multiple" per the spec
const HIGH_SEVERITY_THRESHOLD = 5

function evaluate(correlation) {
  const errorEvents = (correlation.terminalEvents || []).filter((e) => e.event === 'ERROR')

  if (errorEvents.length < MIN_ERROR_COUNT) return null

  return {
    ruleId: RULE_ID,
    ruleName: 'Terminal Error Cluster',
    incidentType: INCIDENT_TYPE,
    baseSeverity: 'MEDIUM',
    severityOverride: errorEvents.length >= HIGH_SEVERITY_THRESHOLD ? 'HIGH' : undefined,
    baseConfidence: 'HIGH',
    description: `${errorEvents.length} ERROR event(s) reported by this terminal.`,
    suggestedNextAction: 'Dispatch a remote diagnostic to the terminal, or contact the merchant if it appears offline.',
    evidence: errorEvents.map((e) => ({
      type: 'terminal_event',
      record: e,
      note: `Terminal ${e.terminal_id} reported an ERROR event (${e.event_id})`,
    })),
    missingEvidence: [],
    timelineReferences: (correlation.timeline || []).filter((t) =>
      errorEvents.some((e) => e.event_id === t.identifier)
    ),
  }
}

module.exports = { id: RULE_ID, incidentType: INCIDENT_TYPE, evaluate }
