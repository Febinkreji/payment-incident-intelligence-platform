const RULE_ID = 'MISSING_API_ACTIVITY'
const INCIDENT_TYPE = 'MISSING_API_ACTIVITY'

function evaluate(correlation) {
  const payments = correlation.payments?.length ? correlation.payments : correlation.payment ? [correlation.payment] : []

  if (payments.length === 0) return null
  if ((correlation.apiLogs || []).length > 0) return null

  return {
    ruleId: RULE_ID,
    ruleName: 'Missing API Activity',
    incidentType: INCIDENT_TYPE,
    baseSeverity: 'MEDIUM',
    baseConfidence: 'MEDIUM',
    description: `${payments.length} payment(s) exist with zero linked api_logs.`,
    suggestedNextAction: 'Verify the api_logs ingestion pipeline is not silently dropping records for this time range.',
    evidence: payments.map((p) => ({
      type: 'payment',
      record: p,
      note: `Payment ${p.payment_id} exists but no api_logs record references it or its order`,
    })),
    missingEvidence: ['apiLogs'],
    timelineReferences: (correlation.timeline || []).filter((t) =>
      payments.some((p) => p.payment_id === t.identifier)
    ),
  }
}

module.exports = { id: RULE_ID, incidentType: INCIDENT_TYPE, evaluate }
