const { sortChronological } = require('../../paymentEvents/paymentEventModel')

const RULE_ID = 'PAYMENT_FAILURE'
const INCIDENT_TYPE = 'PAYMENT_FAILURE'
const FAILED_STATUS = 'PAYMENT_FAILED' // real enum value observed in the source data

function evaluate(correlation) {
  const payments = correlation.payments?.length ? correlation.payments : correlation.payment ? [correlation.payment] : []
  // Sprint 9C.3: payment_status moved to payment_events — payments.current_status
  // is the derived field (Current Status Derivation Rule) that reflects it now.
  const failedPayments = payments.filter((p) => p.current_status === FAILED_STATUS)

  if (failedPayments.length === 0) return null

  const failedPaymentIds = new Set(failedPayments.map((p) => p.payment_id))
  const relevantEvents = sortChronological(
    (correlation.paymentEvents || []).filter((e) => failedPaymentIds.has(e.payment_id))
  )

  return {
    ruleId: RULE_ID,
    ruleName: 'Payment Failure',
    incidentType: INCIDENT_TYPE,
    baseSeverity: 'HIGH',
    baseConfidence: 'HIGH',
    description: `${failedPayments.length} payment(s) reached status ${FAILED_STATUS}.`,
    suggestedNextAction: 'Contact the payment gateway/PSP with the payment_id and failure timestamp to confirm the decline reason.',
    evidence: [
      ...failedPayments.map((p) => ({
        type: 'payment',
        record: p,
        note: `Payment ${p.payment_id} has current_status ${FAILED_STATUS}`,
      })),
      // The full lifecycle leading up to the failure — richer grounding for
      // AI Investigation than the single aggregate row alone (Task 7).
      ...relevantEvents.map((e) => ({
        type: 'payment_event',
        record: e,
        note: `Payment ${e.payment_id} event: ${e.payment_status} at ${e.event_timestamp}${e.status_message ? ` — ${e.status_message}` : ''}`,
      })),
    ],
    missingEvidence: [],
    timelineReferences: (correlation.timeline || []).filter((t) => failedPaymentIds.has(t.identifier)),
  }
}

module.exports = { id: RULE_ID, incidentType: INCIDENT_TYPE, evaluate }
