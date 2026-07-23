const { ENTITY_TYPE, evidenceRow, resolveEntityFromApiLog } = require('../screeningModels')
const { SLOW_API_RESPONSE_THRESHOLD_MS } = require('../screeningConfig')

module.exports = {
  id: 'SLOW_API_RESPONSE',
  displayName: 'Slow API Response',
  description: 'API call exceeded the configured response-time threshold within the monitoring window.',
  entityType: ENTITY_TYPE.ORDER,
  version: '1.0.0',
  defaultEnabled: true,
  configurableParams: ['SLOW_API_RESPONSE_THRESHOLD_MS'],
  dataSourceKey: 'slowApiLogs',
  buildParams: () => ({ minResponseTimeMs: SLOW_API_RESPONSE_THRESHOLD_MS }),

  evaluate(rows) {
    return rows
      .map((log) => {
        const entity = resolveEntityFromApiLog(log)
        if (!entity) return null
        return {
          ...entity,
          entityTimestamp: log.request_ts,
          reason: `API call to ${log.api_url || 'the PSP'} took ${log.request_time_taken} ms, exceeding the ${SLOW_API_RESPONSE_THRESHOLD_MS} ms threshold.`,
          evidence: [
            evidenceRow('API Response Time', `${log.request_time_taken} ms`),
            evidenceRow('Threshold', `${SLOW_API_RESPONSE_THRESHOLD_MS} ms`),
            evidenceRow('Request Time', log.request_ts),
          ],
          recommendedNextAction: 'Open Investigation to check for a broader latency pattern on this route/terminal.',
        }
      })
      .filter(Boolean)
  },
}
