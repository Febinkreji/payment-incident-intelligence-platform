const { ENTITY_TYPE, evidenceRow } = require('../screeningModels')
const { API_RETRY_THRESHOLD_COUNT } = require('../screeningConfig')

// "Retry Threshold (derived from existing data)" — no retry/attempt column
// exists anywhere in the schema, so this counts api_logs rows sharing an
// order_id within the window (transport-level call volume). Distinct from
// multipleRetriesRule.js, which counts distinct PAYMENT ATTEMPTS
// (payment_id rows) on the same order — a business-level signal, not a
// transport-level one. A burst of retries is not necessarily a failure by
// itself (real data shows bursts of all-200 calls too); this rule flags the
// volume pattern and leaves the "was it actually a problem" judgment to the
// operator opening the investigation.
module.exports = {
  id: 'API_RETRY_THRESHOLD',
  displayName: 'API Retry Threshold Exceeded',
  description: 'An order accumulated more API calls than the configured retry threshold within the monitoring window.',
  entityType: ENTITY_TYPE.ORDER,
  version: '1.0.0',
  defaultEnabled: true,
  configurableParams: ['API_RETRY_THRESHOLD_COUNT'],
  dataSourceKey: 'apiRetryGroups',
  buildParams: () => ({ minCount: API_RETRY_THRESHOLD_COUNT }),

  evaluate(rows) {
    return rows.map((group) => ({
      entityId: group.order_id,
      entityType: ENTITY_TYPE.ORDER,
      entityTimestamp: group.last_request_ts,
      reason: `Order accumulated ${group.retry_count} API calls within the monitoring window (threshold: ${API_RETRY_THRESHOLD_COUNT}).`,
      evidence: [
        evidenceRow('API Call Count', group.retry_count),
        evidenceRow('Threshold', API_RETRY_THRESHOLD_COUNT),
        evidenceRow('First Call', group.first_request_ts),
        evidenceRow('Last Call', group.last_request_ts),
        evidenceRow('Status Codes Observed', (group.status_codes || []).join(', ')),
      ],
      recommendedNextAction: 'Open Investigation to determine whether the retries indicate a client, terminal, or PSP issue.',
    }))
  },
}
