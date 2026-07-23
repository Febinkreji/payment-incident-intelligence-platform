const { ENTITY_TYPE, evidenceRow } = require('../screeningModels')
const { MULTI_PAYMENT_ORDER_MIN_COUNT } = require('../screeningConfig')

// Business-level retry signal: more than one payment attempt (distinct
// payment_id) recorded against the same order — e.g. a customer retried
// after a decline. Distinct from apiRetryThresholdRule.js (transport-level
// call volume) and from incidents/rules/repeatedPaymentFailuresRule.js
// (repeated failure events within ONE payment_id, evaluated at
// correlation-time rather than screening-time).
module.exports = {
  id: 'MULTIPLE_RETRIES',
  displayName: 'Multiple Payment Retries',
  description: 'More than one payment attempt was recorded against the same order within the configured monitoring window.',
  entityType: ENTITY_TYPE.ORDER,
  version: '1.0.0',
  defaultEnabled: true,
  configurableParams: ['MULTI_PAYMENT_ORDER_MIN_COUNT'],
  dataSourceKey: 'multiPaymentOrders',
  buildParams: () => ({ minCount: MULTI_PAYMENT_ORDER_MIN_COUNT }),

  evaluate(rows) {
    return rows.map((group) => ({
      entityId: group.order_id,
      entityType: ENTITY_TYPE.ORDER,
      entityTimestamp: group.last_created_at,
      reason: `Order has ${group.attempt_count} payment attempts within the monitoring window (threshold: ${MULTI_PAYMENT_ORDER_MIN_COUNT}).`,
      evidence: [
        evidenceRow('Payment Attempt Count', group.attempt_count),
        evidenceRow('Threshold', MULTI_PAYMENT_ORDER_MIN_COUNT),
        evidenceRow('Payment IDs', group.payment_ids.join(', ')),
        evidenceRow('Most Recent Attempt', group.last_created_at),
      ],
      recommendedNextAction: 'Open Investigation to determine why the first attempt(s) did not complete.',
    }))
  },
}
