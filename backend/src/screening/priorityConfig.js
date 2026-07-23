const { PRIORITY, PRIORITY_ORDER } = require('./screeningModels')
const { MULTI_MATCH_ESCALATION_MIN_COUNT } = require('./screeningConfig')

// Centralized Priority Assignment (Decision 2). Rule files never state their
// own priority — they only report whether they matched. This is the single
// place that maps a rule to a severity tier and the single place that decides
// how multiple matches combine, so tuning the operational priority model
// never means touching rule logic.
//
// Base tiers follow the buckets given in the feature spec:
//   Critical: server failures, terminal offline
//   High:     failed payments, duplicate transactions, retry/attempt patterns
//   Medium:   pending/processing payments, slow APIs
//   Low:      reserved for informational-only rules (none yet register here)
const RULE_BASE_PRIORITY = {
  PENDING_PAYMENT: PRIORITY.MEDIUM,
  CANCELLED_PAYMENT: PRIORITY.MEDIUM,
  FAILED_PAYMENT: PRIORITY.HIGH,
  API_SERVER_ERROR: PRIORITY.CRITICAL,
  API_TIMEOUT: PRIORITY.CRITICAL,
  SLOW_API_RESPONSE: PRIORITY.MEDIUM,
  API_RETRY_THRESHOLD: PRIORITY.HIGH,
  TERMINAL_NOT_REPORTING: PRIORITY.CRITICAL,
  HIGH_VALUE_PAYMENT: PRIORITY.MEDIUM,
  DUPLICATE_TRANSACTION: PRIORITY.HIGH,
  MULTIPLE_RETRIES: PRIORITY.HIGH,
}

// Rules whose base tier IS the ceiling regardless of what else matched —
// a server failure or an offline terminal is already the worst-case signal,
// so escalating further on top of it wouldn't mean anything.
const ALREADY_AT_CEILING = new Set(['API_SERVER_ERROR', 'API_TIMEOUT', 'TERMINAL_NOT_REPORTING'])

function basePriorityFor(ruleId) {
  return RULE_BASE_PRIORITY[ruleId] || PRIORITY.LOW
}

function stepUp(priority) {
  const index = PRIORITY_ORDER.indexOf(priority)
  return PRIORITY_ORDER[Math.min(index + 1, PRIORITY_ORDER.length - 1)]
}

// Multi-rule escalation: an entity matching two or more independent rules is
// a stronger signal than any single rule alone (e.g. a failed payment that's
// ALSO a duplicate transaction is worse than either fact by itself), so the
// combined priority steps up one tier from the highest base tier among the
// matches — capped at CRITICAL, and skipped entirely for rules already at the
// ceiling since there's nowhere higher to escalate to.
function resolvePriority(matchedRuleIds) {
  if (!matchedRuleIds || matchedRuleIds.length === 0) return PRIORITY.LOW

  const basePriorities = matchedRuleIds.map(basePriorityFor)
  const highestIndex = Math.max(...basePriorities.map((p) => PRIORITY_ORDER.indexOf(p)))
  const highest = PRIORITY_ORDER[highestIndex]

  const hasCeilingMatch = matchedRuleIds.some((id) => ALREADY_AT_CEILING.has(id))
  if (hasCeilingMatch) return PRIORITY.CRITICAL

  const isMultiMatch = matchedRuleIds.length >= MULTI_MATCH_ESCALATION_MIN_COUNT
  return isMultiMatch ? stepUp(highest) : highest
}

// Tie-breaking for ranking candidates that land on the same priority tier:
// more corroborating rule matches first, then the more recent entity event
// first. Centralized here (not left to whatever the SQL ORDER BY happens to
// do) so ranking is deterministic regardless of which repository query a
// candidate's underlying row came from.
function compareCandidates(a, b) {
  const priorityDiff = PRIORITY_ORDER.indexOf(b.priority) - PRIORITY_ORDER.indexOf(a.priority)
  if (priorityDiff !== 0) return priorityDiff

  const matchCountDiff = (b.matchedRules?.length || 0) - (a.matchedRules?.length || 0)
  if (matchCountDiff !== 0) return matchCountDiff

  return new Date(b.entityTimestamp || 0).getTime() - new Date(a.entityTimestamp || 0).getTime()
}

module.exports = { RULE_BASE_PRIORITY, basePriorityFor, resolvePriority, compareCandidates }
