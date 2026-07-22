const { pool } = require('../config/postgres/postgres')

// Raw SQL for the Payment Events domain. Kept separate from
// correlation/relationshipResolver.js: that file serves the Correlation
// Engine's read-side (batched by an array of payment_ids, one query per
// correlation); this file serves the aggregation service's write-side (one
// payment_id's full history at a time, then an upsert of the derived row).

async function getEventsByPaymentId(paymentId) {
  if (!paymentId) return []
  const result = await pool.query('SELECT * FROM payment_events WHERE payment_id = $1', [paymentId])
  return result.rows
}

// Distinct payment_ids touched by a given import job — the aggregation step
// only needs to recompute payments whose events actually changed, not the
// whole table, after a Stage A import run.
async function getDistinctPaymentIdsForImportJob(importJobId) {
  if (!importJobId) return []
  const result = await pool.query(
    'SELECT DISTINCT payment_id FROM payment_events WHERE import_job_id = $1',
    [importJobId]
  )
  return result.rows.map((row) => row.payment_id)
}

// A payment's order_id is a real FK to orders(order_id) — this lets the
// aggregation service (Sprint 9C.4C) skip a payment cleanly when its
// order_id was never present in the Orders source dataset, instead of
// letting the upsert fail on a foreign key violation.
async function orderExists(orderId) {
  if (!orderId) return true
  const result = await pool.query('SELECT 1 FROM orders WHERE order_id = $1', [orderId])
  return result.rows.length > 0
}

const AGGREGATE_COLUMNS = [
  'payment_id',
  'order_id',
  'amount',
  'merchant_id',
  'checkout_id',
  'currency',
  'payment_type',
  'payment_method',
  'payee_phone_number',
  'created_at',
  'transaction_id',
  'voided',
  'void_requested_at',
  'void_status',
  'store_id',
  'card_brand',
  'purchase_payment_id',
  'reference_payment_id',
  'originated_by',
  'import_job_id',
  'current_status',
  'current_status_at',
]

// Upserts one payment's aggregate row from an already-derived aggregate
// object (see paymentEventModel.deriveAggregate). Always a full column
// overwrite on conflict — the aggregate is recomputed fresh from complete
// event history each time, never patched incrementally, so there is no
// partial-update case to reason about.
async function upsertPaymentAggregate(aggregate) {
  const values = AGGREGATE_COLUMNS.map((column) => aggregate[column] ?? null)
  const placeholders = AGGREGATE_COLUMNS.map((_, i) => `$${i + 1}`).join(', ')
  const updates = AGGREGATE_COLUMNS.filter((c) => c !== 'payment_id')
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(', ')

  await pool.query(
    `INSERT INTO payments (${AGGREGATE_COLUMNS.join(', ')})
     VALUES (${placeholders})
     ON CONFLICT (payment_id) DO UPDATE SET ${updates}`,
    values
  )
}

module.exports = {
  getEventsByPaymentId,
  getDistinctPaymentIdsForImportJob,
  orderExists,
  upsertPaymentAggregate,
  AGGREGATE_COLUMNS,
}
