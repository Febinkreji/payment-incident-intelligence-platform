const { ENTITY_TYPE, evidenceRow, resolveEntityFromApiLog } = require('../screeningModels')
const { API_SERVER_ERROR_MIN_STATUS_CODE } = require('../screeningConfig')

// Kept literal to the spec ("HTTP Status >= 500"). Verified directly against
// production data: api_logs.status_code across all 1.57M rows is only ever
// 200/201/400/401 — this PSP proxy always answers the transport-level call
// with 200, even when the downstream call actually failed (see
// apiTimeoutRule.js, which catches that real failure mode via the response
// body instead). This rule will therefore correctly match zero rows against
// today's dataset — that's an honest reflection of the data, not a bug, and
// per Requirement 7 it stays implemented as specified rather than removed or
// silently redefined to chase a different signal.
module.exports = {
  id: 'API_SERVER_ERROR',
  displayName: 'API Server Error',
  description: 'API call returned an HTTP server error status (>= 500) within the configured monitoring window.',
  entityType: ENTITY_TYPE.ORDER,
  version: '1.0.0',
  defaultEnabled: true,
  configurableParams: ['API_SERVER_ERROR_MIN_STATUS_CODE'],
  dataSourceKey: 'serverErrorApiLogs',
  buildParams: () => ({ minStatusCode: API_SERVER_ERROR_MIN_STATUS_CODE }),

  evaluate(rows) {
    return rows
      .map((log) => {
        const entity = resolveEntityFromApiLog(log)
        if (!entity) return null // no payment/order/terminal id on this row — nothing to attach a candidate to
        return {
          ...entity,
          entityTimestamp: log.request_ts,
          reason: `API call to ${log.api_url || 'the PSP'} returned HTTP ${log.status_code}.`,
          evidence: [
            evidenceRow('HTTP Status', log.status_code),
            evidenceRow('API Response Time', `${log.request_time_taken} ms`),
            evidenceRow('Request Time', log.request_ts),
          ],
          recommendedNextAction: 'Open Investigation to check for a wider PSP/API outage pattern.',
        }
      })
      .filter(Boolean)
  },
}
