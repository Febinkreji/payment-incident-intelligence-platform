function createEmptyCorrelationResult({ correlationId, entryPoint }) {
  return {
    correlationId,
    entryPoint, // { type: 'order_id' | 'payment_id' | 'transaction_id' | 'terminal_id', value }

    merchant: null,
    store: null,
    terminal: null,

    // Singular convenience fields — populated when the entry point resolves
    // to exactly one order/payment (order_id, payment_id, transaction_id).
    order: null,
    payment: null,

    // Plural fields — always populated; the only fields used when the entry
    // point can fan out to many (terminal_id), but kept in sync with the
    // singular fields above for order_id/payment_id/transaction_id lookups
    // too, so callers can rely on either shape consistently.
    orders: [],
    payments: [],
    // Sprint 9C.3: the full lifecycle log for every payment in `payments`
    // (one payment can have several payment_events) — ordered by the Current
    // Status Derivation Rule (event_timestamp DESC, entry_id DESC), not
    // chronologically. payments.current_status/current_status_at is already
    // the derived result; consumers needing the full history use this array.
    paymentEvents: [],
    apiLogs: [],
    terminalEvents: [],

    // Refund/void chain via payments.purchase_payment_id / reference_payment_id
    // (a real, enforced self-referencing FK) — not the same as `payments`.
    relatedPayments: [],

    // Matches found only through terminal_events.transaction_id, which has
    // no FK in the schema (unverified crosswalk to payments.payment_id,
    // documented since Sprint 2A). Kept separate from confirmed, FK-backed
    // matches rather than silently merged in, per "do not invent relationships".
    inferredMatches: [],

    timeline: [],

    // Non-fatal notes — e.g. "no payment found for this order" — never
    // exceptions. The engine always returns a (possibly partial) result.
    warnings: [],
  }
}

module.exports = { createEmptyCorrelationResult }
