// Pure extraction helpers over an Incident's evidence[] — no formatting (that's
// promptBuilder's job) and no per-incident-type narrative (that's templates.js's
// job). Both of those consume this module so there is exactly one place that
// knows how to read an api_log/payment_event evidence record apart, keeping
// the prompt and the mock provider's output from ever disagreeing about what
// the evidence actually says (Sprint 9D.5).

function evidenceOfType(incident, type) {
  return (incident.evidence || []).filter((e) => e.type === type).map((e) => e.record)
}

// Endpoint/method/status/latency/retry-activity summary (Sprint 9D.5 Step 4).
// Returns { present: false } explicitly when no api_log evidence exists, so
// callers can state that plainly instead of assuming or silently omitting it.
function summarizeApiLogEvidence(incident) {
  const logs = evidenceOfType(incident, 'api_log')
  if (logs.length === 0) return { present: false, calls: [], retryDetected: false }

  const calls = logs.map((log) => ({
    endpoint: log.api_url || null,
    method: log.call_type || null,
    statusCode: log.status_code ?? null,
    status: log.status || null,
    latencyMs:
      log.request_time_taken !== null && log.request_time_taken !== undefined
        ? Math.round(Number(log.request_time_taken))
        : null,
    requestTs: log.request_ts || null,
  }))

  // Retry activity: more than one call to the same endpoint already present
  // in THIS incident's own evidence — describing what the evidence already
  // shows, not re-running retryStormRule's own detection (no new query).
  const countByEndpoint = new Map()
  for (const call of calls) {
    if (!call.endpoint) continue
    countByEndpoint.set(call.endpoint, (countByEndpoint.get(call.endpoint) || 0) + 1)
  }
  const retryDetected = [...countByEndpoint.values()].some((count) => count > 1)

  return { present: true, calls, retryDetected }
}

// Chronological payment status transitions, with the human-readable reason
// (status_message/terminal_message) when present.
function summarizePaymentEventEvidence(incident) {
  const events = evidenceOfType(incident, 'payment_event')
  if (events.length === 0) return { present: false, transitions: [] }

  const sorted = [...events].sort((a, b) => new Date(a.event_timestamp) - new Date(b.event_timestamp))
  const transitions = sorted.map((e) => ({
    status: e.payment_status,
    timestamp: e.event_timestamp,
    reason: e.status_message || e.terminal_message || null,
  }))

  return { present: true, transitions }
}

// ISO 4217 numeric currency codes seen in this platform's data — same
// mapping timelineBuilder.js uses, kept here too since that file doesn't
// export it. Extend as new codes are observed.
const CURRENCY_CODE_NAMES = { 208: 'NOK' }

// The payment aggregate (amount/currency/current_status), when this
// incident's evidence includes one — used for a grounded, non-invented
// business-impact statement (Sprint 9D.5 Step 3).
function summarizePaymentAggregate(incident) {
  const [payment] = evidenceOfType(incident, 'payment')
  if (!payment) return null
  return {
    paymentId: payment.payment_id || null,
    amount: payment.amount ?? null,
    currency: payment.currency ? CURRENCY_CODE_NAMES[payment.currency] || payment.currency : null,
    status: payment.current_status || null,
  }
}

// Correlation-level facts already stamped onto every incident by
// incidentModels.affectedFields() — no new query, these fields already exist
// on the incident object passed in.
function summarizeCorrelation(incident) {
  return {
    merchant: incident.affectedMerchant || null,
    store: incident.affectedStore || null,
    terminal: incident.affectedTerminal || null,
    order: incident.affectedOrder || null,
    payment: incident.affectedPayment || null,
    warnings: incident.warnings || [],
  }
}

// Sibling incidents detected on the SAME correlation, excluding this one —
// threaded in by investigationEngine.investigateAll(), never a new query.
function summarizeSiblingIncidents(incident, siblingIncidents) {
  return (siblingIncidents || [])
    .filter((sibling) => sibling.incidentId !== incident.incidentId)
    .map((sibling) => ({
      incidentType: sibling.incidentType,
      ruleName: sibling.ruleName || sibling.incidentType,
      severity: sibling.severity,
    }))
}

module.exports = {
  evidenceOfType,
  summarizeApiLogEvidence,
  summarizePaymentEventEvidence,
  summarizePaymentAggregate,
  summarizeCorrelation,
  summarizeSiblingIncidents,
}
