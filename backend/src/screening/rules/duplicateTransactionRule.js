const { ENTITY_TYPE, evidenceRow } = require('../screeningModels')

// Verified against real data: zero duplicate transaction_id groups exist
// across all 573k payments, full history (Stage 1 finding). Kept implemented
// exactly as specified per Requirement 7 — production-ready and ready to
// fire the moment real duplicate transaction_ids appear, not removed for
// being currently quiet.
module.exports = {
  id: 'DUPLICATE_TRANSACTION',
  displayName: 'Duplicate Transaction',
  description: 'More than one payment shares the same transaction_id within the configured monitoring window.',
  entityType: ENTITY_TYPE.PAYMENT,
  version: '1.0.0',
  defaultEnabled: true,
  configurableParams: [],
  dataSourceKey: 'duplicateTransactions',
  buildParams: () => ({}),

  evaluate(rows) {
    return rows.map((group) => ({
      entityId: group.payment_ids[0],
      entityTimestamp: group.last_created_at,
      reason: `Transaction ID ${group.transaction_id} appears on ${group.occurrence_count} payments within the monitoring window.`,
      evidence: [
        evidenceRow('Transaction ID', group.transaction_id),
        evidenceRow('Occurrence Count', group.occurrence_count),
        evidenceRow('Payment IDs', group.payment_ids.join(', ')),
        evidenceRow('Most Recent Occurrence', group.last_created_at),
      ],
      recommendedNextAction: 'Open Investigation to confirm whether this is a legitimate retry or a duplicate charge risk.',
    }))
  },
}
