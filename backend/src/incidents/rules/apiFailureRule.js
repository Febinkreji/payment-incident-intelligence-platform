const RULE_ID = 'API_FAILURE'
const INCIDENT_TYPE = 'API_FAILURE'
const FAILURE_THRESHOLD = 500 // "HTTP 500" from the spec, generalized to any 5xx server error

function evaluate(correlation) {
  const failedLogs = (correlation.apiLogs || []).filter((log) => Number(log.status_code) >= FAILURE_THRESHOLD)

  if (failedLogs.length === 0) return null

  return {
    ruleId: RULE_ID,
    ruleName: 'API Server Error',
    incidentType: INCIDENT_TYPE,
    baseSeverity: 'HIGH',
    baseConfidence: 'HIGH',
    description: `${failedLogs.length} API call(s) returned a 5xx server error.`,
    suggestedNextAction: 'Check the affected endpoint’s server logs and recent deployments around the failure timestamps.',
    evidence: failedLogs.map((log) => ({
      type: 'api_log',
      record: log,
      note: `API call ${log.request_id} (${log.call_type || 'CALL'} ${log.api_url || ''}) returned status_code ${log.status_code}`,
    })),
    missingEvidence: [],
    timelineReferences: (correlation.timeline || []).filter((t) =>
      failedLogs.some((log) => log.request_id === t.identifier)
    ),
  }
}

module.exports = { id: RULE_ID, incidentType: INCIDENT_TYPE, evaluate }
