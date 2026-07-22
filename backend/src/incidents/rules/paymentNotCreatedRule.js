const RULE_ID = 'PAYMENT_NOT_CREATED'
const INCIDENT_TYPE = 'PAYMENT_NOT_CREATED'

// A brand-new PENDING order having no payment yet is completely normal —
// this only fires once the order has reached a resolved status, since only
// then is "still no linked payment" actually suspicious rather than just early.
const RESOLVED_ORDER_STATUSES = ['PAYMENT_COMPLETED', 'PAYMENT_CANCELLED', 'PAYMENT_PROCESSED']

function evaluate(correlation) {
  const orders = correlation.orders?.length ? correlation.orders : correlation.order ? [correlation.order] : []
  const payments = correlation.payments?.length ? correlation.payments : correlation.payment ? [correlation.payment] : []

  if (orders.length === 0) return null
  if (payments.length > 0) return null

  const resolvedOrdersWithNoPayment = orders.filter((o) => RESOLVED_ORDER_STATUSES.includes(o.order_status))
  if (resolvedOrdersWithNoPayment.length === 0) return null

  return {
    ruleId: RULE_ID,
    ruleName: 'Payment Not Created',
    incidentType: INCIDENT_TYPE,
    baseSeverity: 'HIGH',
    baseConfidence: 'MEDIUM',
    description: `${resolvedOrdersWithNoPayment.length} order(s) reached a resolved status with no linked payment.`,
    suggestedNextAction: 'Reconcile against the payment gateway directly using the order_id/reference to check for a missed webhook.',
    evidence: resolvedOrdersWithNoPayment.map((o) => ({
      type: 'order',
      record: o,
      note: `Order ${o.order_id} has status ${o.order_status} but no linked payment was found`,
    })),
    missingEvidence: ['payment'],
    timelineReferences: (correlation.timeline || []).filter((t) =>
      resolvedOrdersWithNoPayment.some((o) => o.order_id === t.identifier)
    ),
  }
}

module.exports = { id: RULE_ID, incidentType: INCIDENT_TYPE, evaluate }
