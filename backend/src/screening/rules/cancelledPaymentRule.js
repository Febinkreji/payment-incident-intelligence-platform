const { ENTITY_TYPE, evidenceRow } = require('../screeningModels')

module.exports = {
  id: 'CANCELLED_PAYMENT',
  displayName: 'Cancelled Payment',
  description: 'Payment reached PAYMENT_CANCELLED within the configured monitoring window.',
  entityType: ENTITY_TYPE.PAYMENT,
  version: '1.0.0',
  defaultEnabled: true,
  configurableParams: [],
  dataSourceKey: 'paymentsByStatus',
  buildParams: () => ({ statuses: ['PAYMENT_CANCELLED'] }),

  evaluate(rows) {
    return rows.map((payment) => ({
      entityId: payment.payment_id,
      entityTimestamp: payment.created_at,
      reason: 'Payment was cancelled within the configured monitoring window.',
      evidence: [
        evidenceRow('Payment Status', payment.current_status),
        evidenceRow('Created At', payment.created_at),
        evidenceRow('Order ID', payment.order_id),
      ],
      recommendedNextAction: 'Open Investigation to confirm the cancellation was expected.',
    }))
  },
}
