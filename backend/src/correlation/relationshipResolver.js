const { pool } = require('../config/postgres/postgres')

// Every function here maps directly onto an existing index (merchant_id,
// terminal_id, order_id, payment_id — all indexed since Sprint 2A/2B), and
// every multi-row lookup takes a batch of ids via = ANY($1) rather than
// being called once per row, so correlating a hub identifier (e.g. a busy
// terminal_id) never degrades into N+1 queries.

async function getMerchant(merchantId) {
  if (!merchantId) return null
  const result = await pool.query('SELECT * FROM merchant WHERE merchant_id = $1', [merchantId])
  return result.rows[0] || null
}

async function getStore(storeId) {
  if (!storeId) return null
  const result = await pool.query('SELECT * FROM store WHERE store_id = $1', [storeId])
  return result.rows[0] || null
}

async function getTerminal(terminalId) {
  if (!terminalId) return null
  const result = await pool.query('SELECT * FROM terminal WHERE terminal_id = $1', [terminalId])
  return result.rows[0] || null
}

async function getOrderById(orderId) {
  if (!orderId) return null
  const result = await pool.query('SELECT * FROM orders WHERE order_id = $1', [orderId])
  return result.rows[0] || null
}

async function getOrdersByTerminalId(terminalId, limit) {
  const result = await pool.query(
    'SELECT * FROM orders WHERE terminal_id = $1 ORDER BY created_at LIMIT $2',
    [terminalId, limit]
  )
  return result.rows
}

async function getPaymentById(paymentId) {
  if (!paymentId) return null
  const result = await pool.query('SELECT * FROM payments WHERE payment_id = $1', [paymentId])
  return result.rows[0] || null
}

async function getPaymentByTransactionId(transactionId) {
  if (!transactionId) return null
  const result = await pool.query('SELECT * FROM payments WHERE transaction_id = $1', [transactionId])
  return result.rows[0] || null
}

async function getPaymentsByOrderId(orderId) {
  if (!orderId) return []
  const result = await pool.query('SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at', [orderId])
  return result.rows
}

async function getPaymentsByOrderIds(orderIds) {
  if (!orderIds || orderIds.length === 0) return []
  const result = await pool.query(
    'SELECT * FROM payments WHERE order_id = ANY($1) ORDER BY created_at',
    [orderIds]
  )
  return result.rows
}

// purchase_payment_id / reference_payment_id are real, enforced
// self-referencing FKs (used for refund/void chains) — distinct from the
// unverified terminal_events.transaction_id crosswalk below.
async function getRelatedPayments(payment) {
  if (!payment) return []

  const parentIds = [payment.purchase_payment_id, payment.reference_payment_id].filter(Boolean)
  const [children, parents] = await Promise.all([
    pool.query(
      'SELECT * FROM payments WHERE purchase_payment_id = $1 OR reference_payment_id = $1',
      [payment.payment_id]
    ),
    parentIds.length
      ? pool.query('SELECT * FROM payments WHERE payment_id = ANY($1)', [parentIds])
      : Promise.resolve({ rows: [] }),
  ])

  const byId = new Map()
  for (const row of [...children.rows, ...parents.rows]) {
    if (row.payment_id !== payment.payment_id) byId.set(row.payment_id, row)
  }
  return [...byId.values()]
}

async function getApiLogsByOrderId(orderId) {
  if (!orderId) return []
  const result = await pool.query('SELECT * FROM api_logs WHERE order_id = $1 ORDER BY request_ts', [orderId])
  return result.rows
}

async function getApiLogsByPaymentIds(paymentIds) {
  if (!paymentIds || paymentIds.length === 0) return []
  const result = await pool.query(
    'SELECT * FROM api_logs WHERE payment_id = ANY($1) ORDER BY request_ts',
    [paymentIds]
  )
  return result.rows
}

async function getApiLogsByTerminalId(terminalId, limit) {
  const result = await pool.query(
    'SELECT * FROM api_logs WHERE terminal_id = $1 ORDER BY request_ts LIMIT $2',
    [terminalId, limit]
  )
  return result.rows
}

// Sprint 9D.6: standalone, paginated api_logs browsing for the new
// /api/api-logs/* endpoints — distinct from getApiLogsBy*() above, which
// exist to feed the Correlation Engine's fixed, unpaginated fan-out. Every
// filter maps directly onto an existing index (merchant_id/order_id/
// payment_id/terminal_id/status_code all indexed since Sprint 2A/9D.2), and
// the total count is fetched in the SAME query via COUNT(*) OVER() rather
// than a second round-trip.
async function getApiLogsPage({
  orderId,
  paymentId,
  terminalId,
  merchantId,
  statusCodeMin,
  statusCodeMax,
  limit = 50,
  offset = 0,
  sort = 'asc',
}) {
  const conditions = []
  const params = []

  if (orderId) {
    params.push(orderId)
    conditions.push(`order_id = $${params.length}`)
  }
  if (paymentId) {
    params.push(paymentId)
    conditions.push(`payment_id = $${params.length}`)
  }
  if (terminalId) {
    params.push(terminalId)
    conditions.push(`terminal_id = $${params.length}`)
  }
  if (merchantId) {
    params.push(merchantId)
    conditions.push(`merchant_id = $${params.length}`)
  }
  if (statusCodeMin !== null && statusCodeMin !== undefined) {
    params.push(statusCodeMin)
    conditions.push(`status_code >= $${params.length}`)
  }
  if (statusCodeMax !== null && statusCodeMax !== undefined) {
    params.push(statusCodeMax)
    conditions.push(`status_code <= $${params.length}`)
  }

  // Defensive only — every route that calls this always supplies exactly
  // one entity filter by construction (one path param per route), so this
  // should never actually trigger; it guards against an unbounded scan of
  // 1.5M+ rows if this function is ever called without one.
  if (conditions.length === 0) {
    throw new Error('getApiLogsPage requires at least one filter (orderId, paymentId, terminalId, or merchantId)')
  }

  const orderDirection = sort === 'desc' ? 'DESC' : 'ASC'
  const whereClause = conditions.join(' AND ')

  // Deliberately TWO queries run in parallel, not one with COUNT(*) OVER().
  // merchant_id is only 1-2 distinct values across the entire 1.57M-row
  // table (essentially every row matches), so a merchant-scoped lookup is
  // non-selective — combining COUNT(*) OVER() with ORDER BY/LIMIT forces
  // Postgres to materialize and sort the FULL matching set before it can
  // apply the window function, which defeats the "top-N" heap-sort
  // optimization ORDER BY+LIMIT alone gets. Measured directly (Sprint 9D.6):
  // the combined form took 74+ seconds on a merchant filter and was
  // cancelled; splitting into a plain COUNT (no ORDER BY, uses the existing
  // index) plus a plain LIMIT fetch (fast top-N sort, ~10ms) is both
  // correct and, for this non-selective case, dramatically faster overall.
  // For the selective filters (order/payment/terminal_id) both queries are
  // already fast on their own indexes, so this costs nothing there.
  const [countResult, dataResult] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM api_logs WHERE ${whereClause}`, params),
    pool.query(
      `SELECT * FROM api_logs WHERE ${whereClause} ORDER BY request_ts ${orderDirection} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
  ])

  return { rows: dataResult.rows, total: Number(countResult.rows[0].count) }
}

async function getTerminalEventsByOrderId(orderId) {
  if (!orderId) return []
  const result = await pool.query(
    'SELECT * FROM terminal_events WHERE order_id = $1 ORDER BY event_timestamp',
    [orderId]
  )
  return result.rows
}

async function getTerminalEventsByTerminalId(terminalId, limit) {
  const result = await pool.query(
    'SELECT * FROM terminal_events WHERE terminal_id = $1 ORDER BY event_timestamp LIMIT $2',
    [terminalId, limit]
  )
  return result.rows
}

// terminal_events.transaction_id has no FK — ID-shape evidence suggests it
// may hold a payments.payment_id value, but this was never confirmed against
// real data (see schema.sql). Always call out results from this function as
// inferred, never merge them silently with FK-confirmed matches.
async function getTerminalEventsByTransactionIdInferred(candidatePaymentIds) {
  if (!candidatePaymentIds || candidatePaymentIds.length === 0) return []
  const result = await pool.query(
    'SELECT * FROM terminal_events WHERE transaction_id = ANY($1) ORDER BY event_timestamp',
    [candidatePaymentIds]
  )
  return result.rows
}

// Batched lookup of a payment's full lifecycle log, ordered to match the
// Current Status Derivation Rule (event_timestamp DESC, entry_id DESC) — the
// same order the idx_payment_events_payment_id_event_ts_entry_id index
// serves directly. Callers that need chronological (oldest-first) order for
// a narrative — e.g. the Timeline — re-sort explicitly rather than relying
// on this default; see paymentEventModel.sortChronological.
async function getPaymentEventsByPaymentIds(paymentIds) {
  if (!paymentIds || paymentIds.length === 0) return []
  const result = await pool.query(
    'SELECT * FROM payment_events WHERE payment_id = ANY($1) ORDER BY payment_id, event_timestamp DESC, entry_id DESC',
    [paymentIds]
  )
  return result.rows
}

// payment_terminal_code is the normalized decomposition of
// payment_events.terminal_codes_raw — currently unpopulated by any importer
// built so far, so this will legitimately return [] until that's built.
async function getTerminalCodesForPayment(paymentId) {
  if (!paymentId) return []
  const result = await pool.query(
    `SELECT tc.terminal_code, tc.terminal_id, ptc.position, ptc.is_primary
     FROM payment_terminal_code ptc
     JOIN terminal_code tc ON tc.terminal_code = ptc.terminal_code
     WHERE ptc.payment_id = $1
     ORDER BY ptc.position`,
    [paymentId]
  )
  return result.rows
}

module.exports = {
  getMerchant,
  getStore,
  getTerminal,
  getOrderById,
  getOrdersByTerminalId,
  getPaymentById,
  getPaymentByTransactionId,
  getPaymentsByOrderId,
  getPaymentsByOrderIds,
  getPaymentEventsByPaymentIds,
  getRelatedPayments,
  getApiLogsByOrderId,
  getApiLogsByPaymentIds,
  getApiLogsByTerminalId,
  getApiLogsPage,
  getTerminalEventsByOrderId,
  getTerminalEventsByTerminalId,
  getTerminalEventsByTransactionIdInferred,
  getTerminalCodesForPayment,
}
