const RULE_ID = 'REPEATED_PAYMENT_FAILURES'
const INCIDENT_TYPE = 'REPEATED_PAYMENT_FAILURES'
// A single failure is already covered by PAYMENT_FAILURE — this fires only
// when the SAME payment failed more than once. Grounded in real production
// data (Sprint 9D.4 profiling): payments with up to 5 PAYMENT_FAILED events
// exist in this dataset, so "repeated"/"consecutive" failures are a real,
// observable pattern, not a hypothetical.
const MIN_REPEAT_COUNT = 2

function evaluate(correlation) {
  const events = correlation.paymentEvents || []
  const failuresByPayment = new Map()

  for (const e of events) {
    if (e.payment_status !== 'PAYMENT_FAILED') continue
    if (!failuresByPayment.has(e.payment_id)) failuresByPayment.set(e.payment_id, [])
    failuresByPayment.get(e.payment_id).push(e)
  }

  const repeatedPayments = [...failuresByPayment.entries()].filter(([, failures]) => failures.length >= MIN_REPEAT_COUNT)
  if (repeatedPayments.length === 0) return null

  const affectedPaymentIds = new Set(repeatedPayments.map(([paymentId]) => paymentId))
  const worstCount = Math.max(...repeatedPayments.map(([, failures]) => failures.length))

  const evidence = repeatedPayments.flatMap(([paymentId, failures]) =>
    failures.map((e) => ({
      type: 'payment_event',
      record: e,
      note: `Payment ${paymentId} failed again at ${e.event_timestamp}${e.status_message ? ` — ${e.status_message}` : ''}`,
    }))
  )

  return {
    ruleId: RULE_ID,
    ruleName: 'Repeated Payment Failures',
    incidentType: INCIDENT_TYPE,
    baseSeverity: 'HIGH',
    baseConfidence: 'HIGH',
    description: `${affectedPaymentIds.size} payment(s) failed more than once (${worstCount} failures on the worst one).`,
    suggestedNextAction: 'Check whether the customer retried with the same card/method — repeated failures on one payment often indicate a persistent issuer-side decline rather than a transient error.',
    evidence,
    missingEvidence: [],
    timelineReferences: (correlation.timeline || []).filter((t) => affectedPaymentIds.has(t.identifier)),
  }
}

module.exports = { id: RULE_ID, incidentType: INCIDENT_TYPE, evaluate }
