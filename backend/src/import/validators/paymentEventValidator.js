// Mirrors the NOT NULL columns on payment_events in schema.sql, plus the
// fields the payments aggregate itself requires NOT NULL (amount,
// merchant_id, payment_type) — since paymentEventsService.deriveAggregate
// copies these straight from a payment's "current" event, a payment_event
// missing them would otherwise pass import cleanly and only fail later, at
// aggregation time, on a much harder-to-trace NOT NULL violation.
const REQUIRED_FIELDS = [
  'entry_id', 'payment_id', 'payment_status', 'event_timestamp', 'created_at',
  'amount', 'merchant_id', 'payment_type',
]

function validate(record) {
  const errors = REQUIRED_FIELDS
    .filter((field) => record[field] === null || record[field] === undefined)
    .map((field) => `${field} is required`)

  return { valid: errors.length === 0, errors }
}

module.exports = { validate, REQUIRED_FIELDS }
