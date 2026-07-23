const { ENTITY_TYPE, evidenceRow } = require('../screeningModels')

const RULE_ID = 'PENDING_PAYMENT'
const STATUSES = ['PAYMENT_INITIATED', 'PAYMENT_PROCESSING']

// A pure plug-in: only answers match/why/evidence/next-action. Never touches
// SQL, never assigns priority, never knows any other rule or the engine
// exists — screeningEngine.js resolves its data source by key and merges its
// output the same generic way it treats every other rule.
module.exports = {
  id: RULE_ID,
  displayName: 'Pending Payment',
  description: 'Payment has not reached a final state (PAYMENT_INITIATED or PAYMENT_PROCESSING) within the configured monitoring window.',
  entityType: ENTITY_TYPE.PAYMENT,
  version: '1.0.0',
  defaultEnabled: true,
  configurableParams: [], // status list is a spec-defined constant, not a tunable threshold
  dataSourceKey: 'paymentsByStatus',
  buildParams: () => ({ statuses: STATUSES }),

  evaluate(rows) {
    return rows.map((payment) => ({
      entityId: payment.payment_id,
      entityTimestamp: payment.created_at,
      reason: `Payment is ${payment.current_status} and has not reached a final state within the configured monitoring window.`,
      evidence: [
        evidenceRow('Payment Status', payment.current_status),
        evidenceRow('Created At', payment.created_at),
        evidenceRow('Order ID', payment.order_id),
      ],
      recommendedNextAction: 'Open Investigation to confirm the payment is progressing normally.',
    }))
  },
}
