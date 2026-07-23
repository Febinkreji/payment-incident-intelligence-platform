const { ENTITY_TYPE, evidenceRow, resolveEntityFromApiLog } = require('../screeningModels')

// Grounded directly against production data: api_logs has no explicit
// timeout flag or status_code, but response_data_mapped.message contains
// real, unambiguous text — "PS_0080: Request timed out after 20000ms"
// appears verbatim 25 times in this dataset. The exact wording ("timed out",
// not "timeout") was confirmed by inspecting real ERROR rows before writing
// this rule, not assumed. See screeningRepository.js:getApiTimeoutLogs for
// the query.
//
// entityType is ORDER as the typical/primary case, but real data shows every
// one of the 25 timeout rows in this dataset has payment_id AND order_id
// both null (the timeout happens on the very call that would create the
// order) — resolveEntityFromApiLog() falls back to terminal_id for those,
// and drops the row entirely if not even that is present.
module.exports = {
  id: 'API_TIMEOUT',
  displayName: 'API Timeout',
  description: 'API call to the PSP/terminal timed out within the configured monitoring window.',
  entityType: ENTITY_TYPE.ORDER,
  version: '1.0.0',
  defaultEnabled: true,
  configurableParams: [],
  dataSourceKey: 'apiTimeoutLogs',
  buildParams: () => ({}),

  evaluate(rows) {
    return rows
      .map((log) => {
        const entity = resolveEntityFromApiLog(log)
        if (!entity) return null
        return {
          ...entity,
          entityTimestamp: log.request_ts,
          reason: `API call to ${log.api_url || 'the PSP'} timed out (${log.request_time_taken} ms elapsed).`,
          evidence: [
            evidenceRow('Outcome', 'Timeout'),
            evidenceRow('API Response Time', `${log.request_time_taken} ms`),
            evidenceRow('PSP Message', log.response_data_mapped?.message || null),
            evidenceRow('Request Time', log.request_ts),
          ],
          recommendedNextAction: 'Open Investigation to check whether the terminal or PSP endpoint is degraded.',
        }
      })
      .filter(Boolean)
  },
}
