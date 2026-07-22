const RULE_ID = 'FAILURE_SPIKE'
const INCIDENT_TYPE = 'FAILURE_SPIKE'

// Covers "terminal-specific failure spikes", "payment cancellation bursts",
// and "high failure ratio within a window" from a single generalized rule —
// all three are the same shape of detection (a failed/cancelled ratio over
// an already-fetched batch of payments), so this avoids three near-duplicate
// rule files. Only meaningful once a correlation has fetched a genuine batch
// (e.g. correlateByTerminalId's fan-out, capped at DEFAULT_FANOUT_LIMIT=200
// in correlationEngine.js) — a single-payment correlation can never show a
// "spike". The "window" here is that existing fetch scope (already ordered
// by created_at) rather than a new time-bounded query — no new queries were
// added for this rule, per Sprint 9D.4's constraint.
//
// Configurable via the constants below, the same pattern terminalErrorRule
// already uses for MIN_ERROR_COUNT/HIGH_SEVERITY_THRESHOLD.
const MIN_SAMPLE_SIZE = 10
// Grounded: a real 200-payment terminal fan-out (Sprint 9D.4 profiling)
// showed 12.5% combined FAILED+CANCELLED — comfortably above this threshold.
const FAILURE_RATIO_THRESHOLD = 0.1
const HIGH_SEVERITY_RATIO_THRESHOLD = 0.25
const SPIKE_STATUSES = ['PAYMENT_FAILED', 'PAYMENT_CANCELLED']

function evaluate(correlation) {
  const payments = correlation.payments || []
  if (payments.length < MIN_SAMPLE_SIZE) return null

  const flagged = payments.filter((p) => SPIKE_STATUSES.includes(p.current_status))
  const ratio = flagged.length / payments.length
  if (ratio < FAILURE_RATIO_THRESHOLD) return null

  const failedCount = flagged.filter((p) => p.current_status === 'PAYMENT_FAILED').length
  const cancelledCount = flagged.filter((p) => p.current_status === 'PAYMENT_CANCELLED').length

  return {
    ruleId: RULE_ID,
    ruleName: 'Payment Failure/Cancellation Spike',
    incidentType: INCIDENT_TYPE,
    baseSeverity: 'MEDIUM',
    severityOverride: ratio >= HIGH_SEVERITY_RATIO_THRESHOLD ? 'HIGH' : undefined,
    baseConfidence: 'MEDIUM', // statistical/sample-dependent, not a single confirmed fact like a direct status read
    description: `${flagged.length} of ${payments.length} payments in this batch (${(ratio * 100).toFixed(1)}%) failed or were cancelled — ${failedCount} failed, ${cancelledCount} cancelled.`,
    suggestedNextAction: 'Check whether this cluster shares a common terminal, time window, or payment method — a spike this size usually points to one root cause rather than independent failures.',
    evidence: flagged.map((p) => ({
      type: 'payment',
      record: p,
      note: `Payment ${p.payment_id} is ${p.current_status}`,
    })),
    missingEvidence: [],
    timelineReferences: (correlation.timeline || []).filter((t) => flagged.some((p) => p.payment_id === t.identifier)),
  }
}

module.exports = { id: RULE_ID, incidentType: INCIDENT_TYPE, evaluate }
