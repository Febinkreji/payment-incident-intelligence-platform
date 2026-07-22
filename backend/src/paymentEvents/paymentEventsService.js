const repository = require('./paymentEventsRepository')
const { deriveAggregate } = require('./paymentEventModel')

// Recomputes and upserts one payment's aggregate row from its complete
// event history, queried fresh from the DB — never scoped to only the
// events touched by the current import file, since a payment's events can
// span two different source CSV files near a date-range boundary (Sprint
// 9C.2A). This is the ONLY place the Current Status Derivation Rule and the
// other aggregation rules actually execute; every other consumer
// (Correlation Engine, Incident Detection, AI Investigation, REST API) just
// reads the already-derived payments.current_status.
async function recomputePaymentAggregate(paymentId) {
  const events = await repository.getEventsByPaymentId(paymentId)
  if (events.length === 0) {
    throw new Error(`recomputePaymentAggregate: no payment_events found for payment_id=${paymentId}`)
  }

  const aggregate = deriveAggregate(paymentId, events)

  // Sprint 9C.4C: payments.order_id is a real, enforced FK. A payment whose
  // order_id was never present in the Orders source dataset (a confirmed,
  // isolated production data gap — see the Sprint 9C.4B investigation, not a
  // migration bug) would violate it. Skip only this payment's aggregation
  // rather than letting the FK violation crash the whole batch — its
  // payment_events rows are untouched, so it can be aggregated later if the
  // order ever becomes available. Any other failure still throws.
  if (aggregate.order_id && !(await repository.orderExists(aggregate.order_id))) {
    return { status: 'skipped_orphan_order', paymentId, orderId: aggregate.order_id }
  }

  await repository.upsertPaymentAggregate(aggregate)
  return { status: 'aggregated', aggregate }
}

// Recomputes every payment touched by a given import job — the entry point
// Stage B (the ETL aggregation step, Task 4) calls once Stage A has finished
// inserting that file's rows into payment_events.
async function recomputeAggregatesForImportJob(importJobId) {
  const paymentIds = await repository.getDistinctPaymentIdsForImportJob(importJobId)
  const recomputed = []
  const skippedOrphans = []

  for (const paymentId of paymentIds) {
    const result = await recomputePaymentAggregate(paymentId)
    if (result.status === 'skipped_orphan_order') {
      console.warn(
        `[paymentEvents:aggregation] skipped payment_id=${result.paymentId} — order_id=${result.orderId} not found in orders (orphan, not a migration bug)`
      )
      skippedOrphans.push({ paymentId: result.paymentId, orderId: result.orderId })
    } else {
      recomputed.push(result.aggregate)
    }
  }

  return { recomputed, skippedOrphans }
}

module.exports = { recomputePaymentAggregate, recomputeAggregatesForImportJob }
