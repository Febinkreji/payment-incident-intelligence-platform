const { ENTITY_TYPE, evidenceRow } = require('../screeningModels')
const { HIGH_VALUE_AMOUNT_THRESHOLD } = require('../screeningConfig')

module.exports = {
  id: 'HIGH_VALUE_PAYMENT',
  displayName: 'High Value Transaction',
  description: 'Payment amount is at or above the configured high-value threshold.',
  entityType: ENTITY_TYPE.PAYMENT,
  version: '1.0.0',
  defaultEnabled: true,
  configurableParams: ['HIGH_VALUE_AMOUNT_THRESHOLD'],
  dataSourceKey: 'highValuePayments',
  buildParams: () => ({ minAmount: HIGH_VALUE_AMOUNT_THRESHOLD }),

  evaluate(rows) {
    return rows.map((payment) => ({
      entityId: payment.payment_id,
      entityTimestamp: payment.created_at,
      reason: `Payment amount ${payment.amount} meets or exceeds the high-value threshold of ${HIGH_VALUE_AMOUNT_THRESHOLD}.`,
      evidence: [
        evidenceRow('Amount', payment.amount),
        evidenceRow('Threshold', HIGH_VALUE_AMOUNT_THRESHOLD),
        evidenceRow('Currency', payment.currency),
        evidenceRow('Payment Status', payment.current_status),
      ],
      recommendedNextAction: 'Open Investigation to confirm the transaction completed as expected given its value.',
    }))
  },
}
