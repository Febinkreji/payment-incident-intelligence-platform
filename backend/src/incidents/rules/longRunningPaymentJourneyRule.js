const RULE_ID = 'LONG_RUNNING_PAYMENT_JOURNEY'
const INCIDENT_TYPE = 'LONG_RUNNING_PAYMENT_JOURNEY'
// 300s — grounded in real production data (Sprint 9D.4 profiling: p95=44s,
// p99≈22,977s across 573K+ payments; only ~1.7% exceed 300s), so this flags
// a genuinely long tail rather than normal processing time.
const LONG_RUNNING_THRESHOLD_SECONDS = 300

function evaluate(correlation) {
  const payments = correlation.payments?.length ? correlation.payments : correlation.payment ? [correlation.payment] : []

  const longRunning = payments.filter((p) => {
    if (!p.created_at || !p.current_status_at) return false
    const seconds = (new Date(p.current_status_at) - new Date(p.created_at)) / 1000
    return seconds > LONG_RUNNING_THRESHOLD_SECONDS
  })

  if (longRunning.length === 0) return null

  return {
    ruleId: RULE_ID,
    ruleName: 'Long-Running Payment Journey',
    incidentType: INCIDENT_TYPE,
    baseSeverity: 'MEDIUM',
    baseConfidence: 'HIGH',
    description: `${longRunning.length} payment(s) took longer than ${LONG_RUNNING_THRESHOLD_SECONDS}s to reach a final status.`,
    suggestedNextAction: 'Check whether this payment was stuck waiting on a customer action (e.g. 3DS) or a delayed gateway callback.',
    evidence: longRunning.map((p) => {
      const seconds = Math.round((new Date(p.current_status_at) - new Date(p.created_at)) / 1000)
      return {
        type: 'payment',
        record: p,
        note: `Payment ${p.payment_id} took ${seconds}s to reach ${p.current_status}`,
      }
    }),
    missingEvidence: [],
    timelineReferences: (correlation.timeline || []).filter((t) =>
      longRunning.some((p) => p.payment_id === t.identifier)
    ),
  }
}

module.exports = { id: RULE_ID, incidentType: INCIDENT_TYPE, evaluate }
