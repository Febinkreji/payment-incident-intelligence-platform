const { ENTITY_TYPE, evidenceRow } = require('../screeningModels')

module.exports = {
  id: 'FAILED_PAYMENT',
  displayName: 'Failed Payment',
  description: 'Payment reached PAYMENT_FAILED within the configured monitoring window.',
  entityType: ENTITY_TYPE.PAYMENT,
  version: '1.0.0',
  defaultEnabled: true,
  configurableParams: [],
  dataSourceKey: 'paymentsByStatus',
  buildParams: () => ({ statuses: ['PAYMENT_FAILED'] }),

  evaluate(rows) {
    return rows.map((payment) => ({
      entityId: payment.payment_id,
      entityTimestamp: payment.created_at,
      reason: 'Payment failed within the configured monitoring window.',
      evidence: [
        evidenceRow('Payment Status', payment.current_status),
        evidenceRow('Created At', payment.created_at),
        evidenceRow('Order ID', payment.order_id),
      ],
      recommendedNextAction: 'Open Investigation to determine the failure cause.',
    }))
  },
}
