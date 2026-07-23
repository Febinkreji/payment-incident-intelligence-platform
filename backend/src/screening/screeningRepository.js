const { pool } = require('../config/postgres/postgres')

// Data Selection Layer. Every function here does exactly one thing: run a
// single, time-bounded, indexed query against production tables and return
// raw rows. No rule evaluation, no priority assignment, no candidate shaping
// happens in this file — that separation is the whole point of keeping this
// layer independent from screeningEngine.js (Stage 2). {from, to} always
// comes from timeWindow.js's resolveWindow() so no query here ever runs
// unbounded across an entire table.
//
// Every ORDER BY below carries a unique secondary column after the "business"
// sort key. Found necessary during Stage 2 validation: this batch-imported
// dataset has many rows sharing the exact same created_at/request_ts
// (multiple PAYMENT_FAILED rows on one identical timestamp, confirmed
// directly against Postgres) — an ORDER BY on that column alone is
// ambiguous, so a LIMIT at the boundary of a tie can silently return a
// different row set on every run. The Screening Engine's contract requires
// a deterministic result, so every query here is fully ordered.

// payments.current_status is indexed (idx_payments_current_status) and
// created_at is indexed (idx_payments_created_at) — this is exactly the
// composite access pattern idx_payments_order_id_created_at's sibling
// indexes were built for.
async function getPaymentsByStatus({ statuses, from, to, limit = 200 }) {
  const result = await pool.query(
    `SELECT * FROM payments
     WHERE current_status = ANY($1) AND created_at BETWEEN $2 AND $3
     ORDER BY created_at DESC, payment_id
     LIMIT $4`,
    [statuses, from, to, limit]
  )
  return result.rows
}

// api_logs.request_ts is indexed (idx_api_logs_request_ts); status_code is
// not, but the time bound is applied first so Postgres narrows via the
// timestamp index before filtering status_code on the remaining rows.
async function getServerErrorApiLogs({ minStatusCode = 500, from, to, limit = 200 }) {
  const result = await pool.query(
    `SELECT * FROM api_logs
     WHERE status_code >= $1 AND request_ts BETWEEN $2 AND $3
     ORDER BY request_ts DESC, request_id
     LIMIT $4`,
    [minStatusCode, from, to, limit]
  )
  return result.rows
}

async function getSlowApiLogs({ minResponseTimeMs, from, to, limit = 200 }) {
  const result = await pool.query(
    `SELECT * FROM api_logs
     WHERE request_time_taken > $1 AND request_ts BETWEEN $2 AND $3
     ORDER BY request_time_taken DESC, request_id
     LIMIT $4`,
    [minResponseTimeMs, from, to, limit]
  )
  return result.rows
}

// Retry-count is derived, not stored (no retry/attempt column exists
// anywhere in the schema) — this groups api_logs by order_id within the
// window the same way the existing retryStormRule.js derives retries from
// payment_events, just against a different source table. Bounded by the
// indexed request_ts range before the GROUP BY, same reasoning as above.
async function getApiRetryGroups({ minCount, from, to, limit = 100 }) {
  const result = await pool.query(
    `SELECT order_id, COUNT(*) AS retry_count,
            MIN(request_ts) AS first_request_ts, MAX(request_ts) AS last_request_ts,
            array_agg(status_code ORDER BY request_ts) AS status_codes
     FROM api_logs
     WHERE order_id IS NOT NULL AND request_ts BETWEEN $1 AND $2
     GROUP BY order_id
     HAVING COUNT(*) >= $3
     ORDER BY retry_count DESC, order_id
     LIMIT $4`,
    [from, to, minCount, limit]
  )
  return result.rows
}

// payment_events.payment_status and .event_timestamp are both indexed
// (idx_payment_events_payment_status, idx_payment_events_event_timestamp) —
// this is the bulk-scan counterpart to incidents/rules/repeatedPaymentFailuresRule.js,
// which does the same count-of-failures check but against one already-loaded
// correlation instead of scanning across all payments in a window.
async function getRepeatedPaymentFailureEvents({ minCount, from, to, limit = 100 }) {
  const result = await pool.query(
    `SELECT payment_id, COUNT(*) AS failure_count,
            MIN(event_timestamp) AS first_failure_ts, MAX(event_timestamp) AS last_failure_ts
     FROM payment_events
     WHERE payment_status = 'PAYMENT_FAILED' AND event_timestamp BETWEEN $1 AND $2
     GROUP BY payment_id
     HAVING COUNT(*) >= $3
     ORDER BY failure_count DESC, payment_id
     LIMIT $4`,
    [from, to, minCount, limit]
  )
  return result.rows
}

// amount has no dedicated index — acceptable here because created_at (which
// IS indexed) always bounds the scan first, and the screening windows this
// feature targets (15m up to "today") keep that bounded set small. A future
// "all time" custom range would lose this guarantee; see risks in the Stage 1
// report before widening custom-range usage beyond same-day lookups.
async function getHighValuePayments({ minAmount, from, to, limit = 200 }) {
  const result = await pool.query(
    `SELECT * FROM payments
     WHERE amount >= $1 AND created_at BETWEEN $2 AND $3
     ORDER BY amount DESC, payment_id
     LIMIT $4`,
    [minAmount, from, to, limit]
  )
  return result.rows
}

// transaction_id also has no dedicated index, same caveat as amount above.
// Duplicate detection is scoped to payments sharing a transaction_id within
// the window, not across all of history.
async function getDuplicateTransactionPayments({ from, to, limit = 100 }) {
  const result = await pool.query(
    `SELECT transaction_id, array_agg(payment_id ORDER BY created_at) AS payment_ids,
            COUNT(*) AS occurrence_count, MAX(created_at) AS last_created_at
     FROM payments
     WHERE transaction_id IS NOT NULL AND created_at BETWEEN $1 AND $2
     GROUP BY transaction_id
     HAVING COUNT(*) > 1
     ORDER BY occurrence_count DESC, transaction_id
     LIMIT $3`,
    [from, to, limit]
  )
  return result.rows
}

// api_logs.status_code stays 200/201 even when the downstream call actually
// failed (this PSP proxy always answers the transport call with 200) — the
// real outcome lives in response_data_mapped.message. Grounded directly
// against production data: "PS_0080: Request timed out after 20000ms"
// appears 25 times verbatim. status='ERROR' is indexed implicitly via the
// request_ts bound below; the JSONB text match only runs over that already-
// narrowed window-bounded subset, never the full 1.57M-row table.
async function getApiTimeoutLogs({ from, to, limit = 200 }) {
  const result = await pool.query(
    `SELECT * FROM api_logs
     WHERE status = 'ERROR' AND response_data_mapped->>'message' ILIKE '%timed out%'
       AND request_ts BETWEEN $1 AND $2
     ORDER BY request_ts DESC, request_id
     LIMIT $3`,
    [from, to, limit]
  )
  return result.rows
}

// "Multiple Retries" at the transaction level: more than one payment
// attempt (distinct payment_id) recorded against the same order_id within
// the window — distinct from getApiRetryGroups (transport-level call
// volume) and getRepeatedPaymentFailureEvents (repeated failure events on
// ONE payment_id). Bounded by the indexed created_at range before grouping,
// same reasoning as getDuplicateTransactionPayments.
async function getMultiPaymentOrders({ minCount, from, to, limit = 100 }) {
  const result = await pool.query(
    `SELECT order_id, array_agg(payment_id ORDER BY created_at) AS payment_ids,
            COUNT(*) AS attempt_count, MAX(created_at) AS last_created_at
     FROM payments
     WHERE order_id IS NOT NULL AND created_at BETWEEN $1 AND $2
     GROUP BY order_id
     HAVING COUNT(*) >= $3
     ORDER BY attempt_count DESC, order_id
     LIMIT $4`,
    [from, to, minCount, limit]
  )
  return result.rows
}

// Terminal "last seen" is NOT time-windowed the way the queries above are —
// staleness is inherently "how long since this terminal's last heartbeat",
// which has to be measured against the terminal's true last activity, not
// clipped to whatever window the request happened to ask for. The terminal
// table is small, so a full LEFT JOIN + GROUP BY per terminal is cheap
// regardless; heartbeatEvents defaults to PONG, the only event type in real
// data that behaves like a heartbeat (Sprint 9D.3 profiling: PONG, 179 rows
// total — this will legitimately produce few candidates).
async function getTerminalLastHeartbeat({ heartbeatEvents = ['PONG'] } = {}) {
  const result = await pool.query(
    `SELECT t.terminal_id, MAX(te.event_timestamp) AS last_heartbeat_at
     FROM terminal t
     LEFT JOIN terminal_events te
       ON te.terminal_id = t.terminal_id AND te.event = ANY($1)
     GROUP BY t.terminal_id`,
    [heartbeatEvents]
  )
  return result.rows
}

module.exports = {
  getPaymentsByStatus,
  getServerErrorApiLogs,
  getApiTimeoutLogs,
  getSlowApiLogs,
  getApiRetryGroups,
  getRepeatedPaymentFailureEvents,
  getHighValuePayments,
  getDuplicateTransactionPayments,
  getMultiPaymentOrders,
  getTerminalLastHeartbeat,
}
