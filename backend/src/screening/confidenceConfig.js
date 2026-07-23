const { CONFIDENCE, CONFIDENCE_ORDER } = require('./screeningModels')
const { MULTI_MATCH_ESCALATION_MIN_COUNT } = require('./screeningConfig')

// Centralized Confidence Assignment — the same architectural pattern as
// priorityConfig.js, deliberately kept as a separate file rather than folded
// in, because the two represent genuinely different questions. Priority asks
// "how severe is this if true" (an operational/business judgment). Confidence
// asks "how directly does the evidence support this conclusion" (an
// evidentiary judgment). Rules never assign either — both are resolved here,
// after matches are known, for the same reason priority is centralized:
// tuning what "confident" means shouldn't require touching rule logic.
//
// Base confidence is HIGH for every rule whose evidence is a direct,
// schema-guaranteed comparison — a status enum, a numeric threshold against
// a typed column, a timestamp gap. These can't silently drift: the column
// either has the value or it doesn't.
//
// API_TIMEOUT is the one deliberate exception: its evidence is an ILIKE
// text match against a free-text JSON message field
// (response_data_mapped->>'message'), not a structured column. Verified
// reliable against every real timeout row in this dataset (Stage 2), but
// it's structurally an inference, not a guarantee — if the PSP ever changes
// its error wording, this detection could silently miss matches without any
// schema change flagging the risk. That real difference in evidentiary
// strength is exactly what this axis exists to capture.
const RULE_BASE_CONFIDENCE = {
  PENDING_PAYMENT: CONFIDENCE.HIGH,
  FAILED_PAYMENT: CONFIDENCE.HIGH,
  CANCELLED_PAYMENT: CONFIDENCE.HIGH,
  API_SERVER_ERROR: CONFIDENCE.HIGH,
  API_TIMEOUT: CONFIDENCE.MEDIUM,
  SLOW_API_RESPONSE: CONFIDENCE.HIGH,
  API_RETRY_THRESHOLD: CONFIDENCE.HIGH,
  TERMINAL_NOT_REPORTING: CONFIDENCE.HIGH,
  HIGH_VALUE_PAYMENT: CONFIDENCE.HIGH,
  DUPLICATE_TRANSACTION: CONFIDENCE.HIGH,
  MULTIPLE_RETRIES: CONFIDENCE.HIGH,
}

function baseConfidenceFor(ruleId) {
  return RULE_BASE_CONFIDENCE[ruleId] || CONFIDENCE.LOW
}

function stepUp(confidence) {
  const index = CONFIDENCE_ORDER.indexOf(confidence)
  return CONFIDENCE_ORDER[Math.min(index + 1, CONFIDENCE_ORDER.length - 1)]
}

// Independent corroboration is itself evidence: an API_TIMEOUT alone is
// MEDIUM (an inferred signal), but an API_TIMEOUT ALSO corroborated by
// TERMINAL_NOT_REPORTING (a HIGH-confidence, direct timestamp comparison,
// from a completely independent data source) becomes HIGH overall — the
// second signal doesn't depend on the first being right, so its agreement
// is real evidence. Reuses the same corroboration threshold as
// priorityConfig.js (MULTI_MATCH_ESCALATION_MIN_COUNT) since both represent
// the same underlying idea: how many independent signals count as strong
// corroboration for this dataset.
function resolveConfidence(matchedRuleIds) {
  if (!matchedRuleIds || matchedRuleIds.length === 0) return CONFIDENCE.LOW

  const baseConfidences = matchedRuleIds.map(baseConfidenceFor)
  const highestIndex = Math.max(...baseConfidences.map((c) => CONFIDENCE_ORDER.indexOf(c)))
  const highest = CONFIDENCE_ORDER[highestIndex]

  const isMultiMatch = matchedRuleIds.length >= MULTI_MATCH_ESCALATION_MIN_COUNT
  return isMultiMatch ? stepUp(highest) : highest
}

module.exports = { RULE_BASE_CONFIDENCE, resolveConfidence }
