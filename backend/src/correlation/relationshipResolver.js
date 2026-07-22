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

// payment_terminal_code is the normalized decomposition of
// payments.terminal_code_raw — currently unpopulated by any importer built
// so far, so this will legitimately return [] until that's built.
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
  getRelatedPayments,
  getApiLogsByOrderId,
  getApiLogsByPaymentIds,
  getApiLogsByTerminalId,
  getTerminalEventsByOrderId,
  getTerminalEventsByTerminalId,
  getTerminalEventsByTransactionIdInferred,
  getTerminalCodesForPayment,
}
