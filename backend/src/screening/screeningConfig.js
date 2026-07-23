// Centralized, tunable thresholds for every screening rule (Requirement 5).
// No rule file below defines its own threshold constant — every number a
// rule needs to make a match/no-match decision is read from here, so tuning
// the operational sensitivity of the Screening Engine is a one-file change
// that never touches rule logic. This intentionally diverges from the
// incidents/ convention (where each rule keeps its own local constant) —
// that's fine there because incident rules run once per already-selected
// entity; screening rules run in bulk across the whole dataset, where a
// single tuning pass across many rules is the more common operation.
//
// Every value below is grounded in real production data (queried directly
// against Postgres), not guessed:
module.exports = {
  // api_logs.request_time_taken: real p50 ~195ms, p95 ~4010ms, p99 ~8767ms.
  // 2000ms sits between p50 and p95 — well above ordinary latency, but well
  // below the p99 tail, so it flags genuinely slow calls without flagging
  // the bulk of normal traffic.
  SLOW_API_RESPONSE_THRESHOLD_MS: 2000,

  // No retry/attempt column exists anywhere in the schema — this is a count
  // of api_logs rows sharing an order_id within the screening window, same
  // derivation technique as incidents/rules/retryStormRule.js (MIN_ATTEMPTS=3).
  API_RETRY_THRESHOLD_COUNT: 3,

  // payments.amount: real p99 = 75,000 (min 10, p50 12,500, p95 40,500,
  // max 12,332,500). The top 1% of real transactions is the grounded
  // definition of "high value" for this dataset.
  HIGH_VALUE_AMOUNT_THRESHOLD: 75000,

  // Only meaningful for terminals with prior heartbeat history — see
  // terminalNotReportingRule.js for why never-reported terminals (93% of
  // the fleet) are excluded rather than all flagged as offline.
  HEARTBEAT_TIMEOUT_MINUTES: 30,

  // Mirrors incidents/rules/repeatedPaymentFailuresRule.js's MIN_REPEAT_COUNT
  // — same real signal (a payment failing more than once), grounded in the
  // same profiling (payments with up to 5 PAYMENT_FAILED events exist).
  REPEATED_FAILURE_MIN_COUNT: 2,

  // "Multiple Retries" at the transaction level: more than one payment
  // attempt (distinct payment_id) recorded against the same order_id.
  MULTI_PAYMENT_ORDER_MIN_COUNT: 2,

  // Kept literal to the spec ("HTTP Status >= 500"). Confirmed zero matches
  // across all 1.57M api_logs rows in this dataset — the PSP proxy always
  // returns 200/201 at the transport level; see apiServerErrorRule.js.
  API_SERVER_ERROR_MIN_STATUS_CODE: 500,

  // Escalation limit for priorityConfig.js: an entity matching this many or
  // more independent rules steps up one priority tier.
  MULTI_MATCH_ESCALATION_MIN_COUNT: 2,

  DEFAULT_CANDIDATE_LIMIT: 100,
}
