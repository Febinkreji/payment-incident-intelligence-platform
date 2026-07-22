// Pure functions implementing the approved Payment Domain Model's aggregation
// rules. No SQL here — these operate on already-fetched payment_events rows
// so the same logic is trivially unit-testable and there is exactly one
// implementation of each rule anywhere in the codebase.

// The Current Status Derivation Rule (locked, Sprint 9C.2/9C.2A): sort a
// payment's events by event_timestamp DESC, entry_id DESC — the first row
// after sorting is authoritative. This is a "find the latest" sort, distinct
// from the Timeline's ASC chronological-narrative sort; the two must never
// be conflated or share a sort call.
function sortByRecency(events) {
  return [...events].sort((a, b) => {
    const byTimestamp = new Date(b.event_timestamp) - new Date(a.event_timestamp)
    if (byTimestamp !== 0) return byTimestamp
    return b.entry_id > a.entry_id ? 1 : b.entry_id < a.entry_id ? -1 : 0
  })
}

function sortChronological(events) {
  return [...events].sort((a, b) => {
    const byTimestamp = new Date(a.event_timestamp) - new Date(b.event_timestamp)
    if (byTimestamp !== 0) return byTimestamp
    return a.entry_id > b.entry_id ? 1 : a.entry_id < b.entry_id ? -1 : 0
  })
}

// Returns { current_status, current_status_at } per the Current Status
// Derivation Rule, or nulls if the payment has no events (should not happen
// for a payment that exists, but the aggregation step must not crash on it).
function deriveCurrentStatus(events) {
  if (!events || events.length === 0) {
    return { current_status: null, current_status_at: null }
  }
  const [mostRecent] = sortByRecency(events)
  return { current_status: mostRecent.payment_status, current_status_at: mostRecent.event_timestamp }
}

// created_at is redefined (Sprint 9C.3) as MIN(event_timestamp) — the true
// business origination time, a minimal companion to current_status_at's MAX.
function deriveOriginationTimestamp(events) {
  if (!events || events.length === 0) return null
  return events.reduce(
    (min, e) => (min === null || new Date(e.event_timestamp) < new Date(min) ? e.event_timestamp : min),
    null
  )
}

const UNKNOWN_CARD_BRAND_VALUES = new Set([null, undefined, '', 'UNKNOWN'])

// card_brand is the one aggregate field confirmed NOT to follow "latest
// wins" (Sprint 9C.2A correction) — it's the first non-empty/non-UNKNOWN
// value seen, scanning chronologically ascending.
function deriveCardBrand(events) {
  const chronological = sortChronological(events)
  const firstKnown = chronological.find((e) => !UNKNOWN_CARD_BRAND_VALUES.has(e.card_brand))
  return firstKnown ? firstKnown.card_brand : null
}

// Every other payments column is copied from the "current" event — the same
// row selected by the Current Status Derivation Rule — since those fields
// are confirmed stable across a payment's lifecycle (Sprint 9C.2A), so the
// latest observation is authoritative.
const COPIED_FROM_CURRENT_EVENT = [
  'order_id',
  'amount',
  'merchant_id',
  'checkout_id',
  'currency',
  'payment_type',
  'payment_method',
  'payee_phone_number',
  'transaction_id',
  'voided',
  'void_requested_at',
  'void_status',
  'store_id',
  'purchase_payment_id',
  'reference_payment_id',
  'originated_by',
  'import_job_id',
]

// Computes the full payments aggregate row for one payment_id from its
// complete payment_events history (queried fresh from the DB — never scoped
// to only the events touched by the current import file, since a payment's
// events can span two different source CSV files near a date-range boundary).
function deriveAggregate(paymentId, events) {
  if (!events || events.length === 0) {
    throw new Error(`deriveAggregate requires at least one payment_events row for payment_id=${paymentId}`)
  }

  const [currentEvent] = sortByRecency(events)
  const { current_status, current_status_at } = deriveCurrentStatus(events)

  const aggregate = {
    payment_id: paymentId,
    created_at: deriveOriginationTimestamp(events),
    card_brand: deriveCardBrand(events),
    current_status,
    current_status_at,
  }

  for (const field of COPIED_FROM_CURRENT_EVENT) {
    aggregate[field] = currentEvent[field]
  }

  return aggregate
}

module.exports = {
  sortByRecency,
  sortChronological,
  deriveCurrentStatus,
  deriveOriginationTimestamp,
  deriveCardBrand,
  deriveAggregate,
  COPIED_FROM_CURRENT_EVENT,
}
