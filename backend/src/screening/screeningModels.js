// Shapes shared by every stage of the Screening Engine (repository -> rules ->
// engine -> API). Kept separate from incidentModels.js even though the shape
// rhymes with it, because the two candidate concepts are not the same thing:
// an incident result describes what was found about ONE already-correlated
// entity; a screening candidate describes why a RAW production row was
// selected for investigation in the first place. Conflating them would couple
// two layers that this feature is deliberately keeping independent.

const PRIORITY = { CRITICAL: 'CRITICAL', HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' }

// Low -> high, so priorityConfig.js can escalate by stepping an index rather
// than hardcoding a transition table (same technique incidentModels.js uses
// for CONFIDENCE_ORDER).
const PRIORITY_ORDER = [PRIORITY.LOW, PRIORITY.MEDIUM, PRIORITY.HIGH, PRIORITY.CRITICAL]

// Confidence is a deliberately separate axis from priority: priority answers
// "how severe/urgent is this if true", confidence answers "how sure are we
// this is true given the evidence". A CRITICAL, low-confidence candidate and
// a MEDIUM, high-confidence one are both legitimate, different things to
// show an operator — collapsing them into one number would hide that
// distinction. See confidenceConfig.js for how this is resolved.
const CONFIDENCE = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' }
const CONFIDENCE_ORDER = [CONFIDENCE.LOW, CONFIDENCE.MEDIUM, CONFIDENCE.HIGH]

const ENTITY_TYPE = { PAYMENT: 'payment', ORDER: 'order', TERMINAL: 'terminal' }

// One row of human-readable evidence, e.g. { label: 'HTTP Status', value: 503 }.
// Deliberately flat label/value pairs (not raw DB records, unlike incident
// evidence) — screening candidates are read by operators scanning a list and
// fed as plain text into the AI investigation prompt builder, so evidence
// needs to already be presentation-ready rather than requiring a second
// formatting pass downstream.
function evidenceRow(label, value) {
  return { label, value }
}

// Shared by every rule that reads api_logs rows (apiServerErrorRule,
// apiTimeoutRule, slowApiResponseRule): picks the most specific entity a log
// row can be attached to. Falls back payment -> order -> terminal because a
// row can genuinely lack the first two — confirmed against real data that
// EVERY API_TIMEOUT row in this dataset has both payment_id and order_id
// null (the timeout happens on the very call that would have created the
// order), leaving terminal_id as the only usable identifier. Returns null
// when none are present so the caller can skip the row entirely rather than
// merge unrelated rows under a shared placeholder key.
function resolveEntityFromApiLog(log) {
  if (log.payment_id) return { entityId: log.payment_id, entityType: ENTITY_TYPE.PAYMENT }
  if (log.order_id) return { entityId: log.order_id, entityType: ENTITY_TYPE.ORDER }
  if (log.terminal_id) return { entityId: log.terminal_id, entityType: ENTITY_TYPE.TERMINAL }
  return null
}

// Built by screeningEngine.js once all matching rules for an entity are known
// and priorityConfig.js has resolved a final tier — never by an individual
// rule file, which only ever sees its own slice of the picture.
function createCandidate({
  entityType,
  entityId,
  matchedRules, // [{ ruleId, ruleName }]
  priority,
  confidence,
  reason,
  evidence, // [{ label, value }]
  windowLabel, // e.g. "Last Hour" — contextual metadata per Decision 1, not an evaluated rule
  entityTimestamp, // the underlying row's own event time (e.g. payment.created_at) — kept as a
  // real Date/ISO value, not sourced from the evidence array, so ranking never depends on
  // string-matching a human-readable evidence label
  recommendedNextAction,
}) {
  return {
    entityType,
    entityId,
    matchedRules,
    priority,
    confidence,
    reason,
    evidence,
    windowLabel: windowLabel || null,
    entityTimestamp: entityTimestamp || null,
    timestamp: new Date().toISOString(),
    recommendedNextAction: recommendedNextAction || 'Open Investigation',
  }
}

module.exports = {
  PRIORITY,
  PRIORITY_ORDER,
  CONFIDENCE,
  CONFIDENCE_ORDER,
  ENTITY_TYPE,
  evidenceRow,
  resolveEntityFromApiLog,
  createCandidate,
}
