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
