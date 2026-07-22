const RULE_ID = 'SLOW_API_RESPONSE'
const INCIDENT_TYPE = 'SLOW_API_RESPONSE'
// 5000ms — grounded in the real production latency distribution (Sprint
// 9D.4 profiling: p95=4010ms, p99=8767ms across 1.57M+ api_logs rows), so
// this flags roughly the slowest ~4% of calls rather than an arbitrary guess.
const SLOW_THRESHOLD_MS = 5000

function evaluate(correlation) {
  const slowLogs = (correlation.apiLogs || []).filter(
    (log) =>
      log.request_time_taken !== null &&
      log.request_time_taken !== undefined &&
      Number(log.request_time_taken) > SLOW_THRESHOLD_MS
  )

  if (slowLogs.length === 0) return null

  return {
    ruleId: RULE_ID,
    ruleName: 'Slow API Response',
    incidentType: INCIDENT_TYPE,
    baseSeverity: 'MEDIUM',
    baseConfidence: 'HIGH',
    description: `${slowLogs.length} API call(s) took longer than ${SLOW_THRESHOLD_MS}ms to respond.`,
    suggestedNextAction: 'Check the affected endpoint for downstream (gateway/PSP) latency or resource contention around these timestamps.',
    evidence: slowLogs.map((log) => ({
      type: 'api_log',
      record: log,
      note: `Call to ${log.api_url} (request_id ${log.request_id}) took ${Math.round(Number(log.request_time_taken))}ms`,
    })),
    missingEvidence: [],
    timelineReferences: (correlation.timeline || []).filter((t) =>
      slowLogs.some((log) => log.request_id === t.identifier)
    ),
  }
}

module.exports = { id: RULE_ID, incidentType: INCIDENT_TYPE, evaluate }
