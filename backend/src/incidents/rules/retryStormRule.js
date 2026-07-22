const RULE_ID = 'RETRY_STORM'
const INCIDENT_TYPE = 'RETRY_STORM'
// Grounded in real production data (Sprint 9D.4 profiling): 413 real,
// distinct payments show 3+ calls to the same endpoint within the same
// 60-second window — a genuine, observable pattern, not a guessed threshold.
const MIN_ATTEMPTS = 3
const WINDOW_MS = 60000

// Groups api_logs by payment_id + api_url, then within each group looks for
// MIN_ATTEMPTS requests inside any WINDOW_MS-wide window — a client (or the
// platform itself) hammering the same endpoint repeatedly, distinct from a
// normal one-shot request/response pair.
function evaluate(correlation) {
  const logs = (correlation.apiLogs || []).filter((l) => l.payment_id && l.request_ts)
  const grouped = new Map()

  for (const log of logs) {
    const key = `${log.payment_id}::${log.api_url}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(log)
  }

  const storms = []
  for (const group of grouped.values()) {
    const sorted = [...group].sort((a, b) => new Date(a.request_ts) - new Date(b.request_ts))
    for (let i = 0; i + MIN_ATTEMPTS - 1 < sorted.length; i++) {
      const windowStart = new Date(sorted[i].request_ts).getTime()
      const windowEnd = new Date(sorted[i + MIN_ATTEMPTS - 1].request_ts).getTime()
      if (windowEnd - windowStart <= WINDOW_MS) {
        storms.push(sorted.slice(i, i + MIN_ATTEMPTS))
        break // one flagged burst per endpoint/payment pair is enough evidence
      }
    }
  }

  if (storms.length === 0) return null

  const evidence = storms.flatMap((attempts) =>
    attempts.map((log) => ({
      type: 'api_log',
      record: log,
      note: `Repeated call to ${log.api_url} (request_id ${log.request_id}) at ${log.request_ts}`,
    }))
  )
  const affectedRequestIds = new Set(storms.flatMap((attempts) => attempts.map((l) => l.request_id)))

  return {
    ruleId: RULE_ID,
    ruleName: 'Retry Storm',
    incidentType: INCIDENT_TYPE,
    baseSeverity: 'MEDIUM',
    baseConfidence: 'MEDIUM',
    description: `${storms.length} endpoint/payment pair(s) received ${MIN_ATTEMPTS}+ calls within ${WINDOW_MS / 1000}s of each other.`,
    suggestedNextAction: 'Check whether the client is retrying without backoff, or whether the endpoint itself is timing out and triggering automatic retries.',
    evidence,
    missingEvidence: [],
    timelineReferences: (correlation.timeline || []).filter((t) => affectedRequestIds.has(t.identifier)),
  }
}

module.exports = { id: RULE_ID, incidentType: INCIDENT_TYPE, evaluate }
