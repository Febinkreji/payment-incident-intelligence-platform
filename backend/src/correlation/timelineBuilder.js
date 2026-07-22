// Sprint 9D.3: every event now carries `label` (a short prominent heading,
// e.g. "POST /api/payments" or "200 OK") and `details` (a structured
// key/value object for the frontend to render as distinct fields) alongside
// the existing `summary` sentence. Both are purely additive — sourceTable/
// eventType/summary keep their exact old meaning, so nothing that already
// reads a timeline entry (promptBuilder.formatTimeline, investigation/
// examples.js) needs to change.
function pushEvent(events, { timestamp, sourceTable, eventType, identifier, summary, label, details, outcome }) {
  if (!timestamp) return
  const iso = timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp).toISOString()
  events.push({
    timestamp: iso,
    sourceTable,
    eventType,
    identifier,
    summary,
    label: label || null,
    details: details || {},
    outcome: outcome || 'neutral', // 'success' | 'failure' | 'neutral' — lets the frontend color-code without duplicating this logic
  })
}

// ISO 4217 numeric currency codes seen in this platform's data. Extend as
// new codes are observed — falls back to showing the raw numeric code
// rather than guessing a symbol for a currency never seen in production.
const CURRENCY_CODE_NAMES = { 208: 'NOK' }

function formatMoney(amount, currencyCode) {
  if (amount === null || amount === undefined) return 'unknown amount'
  if (!currencyCode) return String(amount)
  return `${amount} ${CURRENCY_CODE_NAMES[currencyCode] || currencyCode}`
}

// Standard HTTP reason phrases, for the codes this platform actually returns
// (200/201/400/401 confirmed in production) plus common neighbors so the
// label stays correct if a code we haven't seen yet shows up.
const HTTP_STATUS_TEXT = {
  200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
  409: 'Conflict', 422: 'Unprocessable Entity',
  500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout',
}

// Derives a short, human service label from the call's own URL path (e.g.
// "/api/payments/x/status" -> "Payment Service") — read directly off the
// real request, never a hardcoded guess at what services exist.
function deriveServiceLabel(apiUrl) {
  if (!apiUrl) return 'API'
  const segments = apiUrl.split('/').filter(Boolean)
  const apiIndex = segments.indexOf('api')
  const resource = apiIndex >= 0 ? segments[apiIndex + 1] : segments[0]
  if (!resource) return 'API'
  const singular = resource.endsWith('s') ? resource.slice(0, -1) : resource
  return `${singular.charAt(0).toUpperCase()}${singular.slice(1)} Service`
}

function addOrderEvents(events, order) {
  if (!order) return

  pushEvent(events, {
    timestamp: order.created_at,
    sourceTable: 'orders',
    eventType: 'ORDER_CREATED',
    identifier: order.order_id,
    label: 'Order created',
    summary: `Order created — status ${order.order_status}, total ${formatMoney(order.total_amount, order.currency)}`,
    details: { orderStatus: order.order_status, totalAmount: order.total_amount, currency: order.currency },
  })

  if (order.updated_at && order.updated_at.getTime?.() !== order.created_at?.getTime?.()) {
    pushEvent(events, {
      timestamp: order.updated_at,
      sourceTable: 'orders',
      eventType: 'ORDER_UPDATED',
      identifier: order.order_id,
      label: 'Order updated',
      summary: `Order updated — status ${order.order_status}`,
      details: { orderStatus: order.order_status },
    })
  }
}

// Sprint 9C.3: payments no longer carries per-update timestamps/status
// directly (payment_status/last_updated_at moved to payment_events) — this
// now only emits the one entry still genuinely aggregate-level: void state,
// which stays on payments. Every actual lifecycle transition is rendered by
// addPaymentEventEntry below, one real entry per payment_events row, instead
// of the old 2-3-entry approximation synthesized from a single payments row.
function addPaymentAggregateEvents(events, payment) {
  if (!payment || !payment.void_requested_at) return

  pushEvent(events, {
    timestamp: payment.void_requested_at,
    sourceTable: 'payments',
    eventType: 'PAYMENT_VOID_REQUESTED',
    identifier: payment.payment_id,
    label: 'Void requested',
    summary: `Void requested — status ${payment.void_status}`,
    details: { voidStatus: payment.void_status },
  })
}

// One lead sentence per known payment_status — falls back to a generic
// status-change sentence for any value not in this list, so an unrecognized
// future status still renders (never throws, never shows a blank summary).
const PAYMENT_STATUS_SUMMARY = {
  PAYMENT_INITIATED: (amount) => `Payment initiated for ${amount}`,
  PAYMENT_PENDING: () => 'Payment is pending',
  PAYMENT_AUTHORIZING: () => 'Payment is being authorized',
  PAYMENT_PROCESSING: () => 'Payment is being processed',
  PAYMENT_PROCESSED: () => 'Payment processed, awaiting confirmation',
  PAYMENT_COMPLETED: () => 'Payment completed successfully',
  PAYMENT_FAILED: () => 'Payment failed',
  PAYMENT_CANCELLED: () => 'Payment was cancelled',
}

const PAYMENT_STATUS_OUTCOME = {
  PAYMENT_COMPLETED: 'success',
  PAYMENT_FAILED: 'failure',
  PAYMENT_CANCELLED: 'failure',
}

function addPaymentEventEntry(events, paymentEvent) {
  if (!paymentEvent) return

  const money = formatMoney(paymentEvent.amount, paymentEvent.currency)
  const summaryFn = PAYMENT_STATUS_SUMMARY[paymentEvent.payment_status]
  const summary = summaryFn ? summaryFn(money) : `Payment status changed to ${paymentEvent.payment_status}`
  const reason = paymentEvent.status_message || paymentEvent.terminal_message || null

  pushEvent(events, {
    timestamp: paymentEvent.event_timestamp,
    sourceTable: 'payment_events',
    eventType: paymentEvent.payment_status,   // source values already read e.g. "PAYMENT_PENDING" — no extra prefix needed
    identifier: paymentEvent.payment_id,
    label: paymentEvent.payment_status,
    summary,
    details: { status: paymentEvent.payment_status, amount: paymentEvent.amount, currency: paymentEvent.currency, reason },
    outcome: PAYMENT_STATUS_OUTCOME[paymentEvent.payment_status] || 'neutral',
  })
}

function addApiLogEvents(events, log) {
  if (!log) return

  const service = deriveServiceLabel(log.api_url)
  const sharedDetails = {
    merchantId: log.merchant_id,
    terminalId: log.terminal_id,
    paymentId: log.payment_id,
    orderId: log.order_id,
  }

  pushEvent(events, {
    timestamp: log.request_ts,
    sourceTable: 'api_logs',
    eventType: 'API_REQUEST',
    identifier: log.request_id,
    label: `${log.call_type || 'CALL'} ${log.api_url || ''}`.trim(),
    summary: `Request sent to ${service}`,
    details: { apiType: 'REQUEST', method: log.call_type, url: log.api_url, ...sharedDetails },
    outcome: 'neutral',
  })

  if (log.response_ts && log.response_ts.getTime?.() !== log.request_ts?.getTime?.()) {
    const isFailure = log.status === 'ERROR' || (log.status_code && Number(log.status_code) >= 400)
    const responseTimeMs = log.request_time_taken !== null && log.request_time_taken !== undefined
      ? Math.round(Number(log.request_time_taken))
      : null
    const statusText = HTTP_STATUS_TEXT[Number(log.status_code)] || log.status || 'Unknown'

    pushEvent(events, {
      timestamp: log.response_ts,
      sourceTable: 'api_logs',
      eventType: 'API_RESPONSE',
      identifier: log.request_id,
      label: `${log.status_code || ''} ${statusText}`.trim(),
      summary: `${service} request ${isFailure ? 'failed' : 'succeeded'}`,
      details: { apiType: 'RESPONSE', statusCode: log.status_code, status: log.status, responseTimeMs, ...sharedDetails },
      outcome: isFailure ? 'failure' : 'success',
    })
  }
}

function addTerminalEventEvents(events, event) {
  if (!event) return

  pushEvent(events, {
    timestamp: event.event_timestamp || event.created_at,
    sourceTable: 'terminal_events',
    eventType: `TERMINAL_${event.event}`,
    identifier: event.event_id,
    label: event.event,
    summary:
      event.matchConfidence === 'inferred'
        ? `Terminal event: ${event.event} (inferred match via transaction_id, unverified crosswalk)`
        : `Terminal event: ${event.event}`,
    details: { event: event.event, matchConfidence: event.matchConfidence || 'confirmed', terminalId: event.terminal_id },
    outcome: event.event === 'ERROR' ? 'failure' : 'neutral',
  })
}

// Builds one sorted timeline from whatever the correlation result actually
// contains — every input is optional, every branch is null/empty-safe, so a
// partial correlation (e.g. an order with no payments yet) still produces a
// valid, if shorter, timeline rather than throwing.
function buildTimeline(result) {
  const events = []

  const orders = result.orders && result.orders.length ? result.orders : result.order ? [result.order] : []
  orders.forEach((order) => addOrderEvents(events, order))

  const payments = result.payments && result.payments.length ? result.payments : result.payment ? [result.payment] : []
  payments.forEach((payment) => addPaymentAggregateEvents(events, payment))
  ;(result.relatedPayments || []).forEach((payment) => addPaymentAggregateEvents(events, payment))
  ;(result.paymentEvents || []).forEach((paymentEvent) => addPaymentEventEntry(events, paymentEvent))

  ;(result.apiLogs || []).forEach((log) => addApiLogEvents(events, log))
  ;(result.terminalEvents || []).forEach((event) => addTerminalEventEvents(events, event))
  ;(result.inferredMatches || []).forEach((event) => addTerminalEventEvents(events, { ...event, matchConfidence: 'inferred' }))

  events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  return events
}

module.exports = { buildTimeline }
