function pushEvent(events, { timestamp, sourceTable, eventType, identifier, summary }) {
  if (!timestamp) return
  const iso = timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp).toISOString()
  events.push({ timestamp: iso, sourceTable, eventType, identifier, summary })
}

function formatMoney(amount, currency) {
  if (amount === null || amount === undefined) return 'unknown amount'
  return currency ? `${amount} (currency ${currency})` : String(amount)
}

function addOrderEvents(events, order) {
  if (!order) return

  pushEvent(events, {
    timestamp: order.created_at,
    sourceTable: 'orders',
    eventType: 'ORDER_CREATED',
    identifier: order.order_id,
    summary: `Order created — status ${order.order_status}, total ${formatMoney(order.total_amount, order.currency)}`,
  })

  if (order.updated_at && order.updated_at.getTime?.() !== order.created_at?.getTime?.()) {
    pushEvent(events, {
      timestamp: order.updated_at,
      sourceTable: 'orders',
      eventType: 'ORDER_UPDATED',
      identifier: order.order_id,
      summary: `Order updated — status ${order.order_status}`,
    })
  }
}

function addPaymentEvents(events, payment) {
  if (!payment) return

  pushEvent(events, {
    timestamp: payment.created_at,
    sourceTable: 'payments',
    eventType: 'PAYMENT_CREATED',
    identifier: payment.payment_id,
    summary: `Payment ${payment.payment_type} — status ${payment.payment_status}, amount ${formatMoney(payment.amount, payment.currency)}`,
  })

  if (payment.last_updated_at && payment.last_updated_at.getTime?.() !== payment.created_at?.getTime?.()) {
    pushEvent(events, {
      timestamp: payment.last_updated_at,
      sourceTable: 'payments',
      eventType: 'PAYMENT_UPDATED',
      identifier: payment.payment_id,
      summary: `Payment status updated — ${payment.payment_status}`,
    })
  }

  if (payment.void_requested_at) {
    pushEvent(events, {
      timestamp: payment.void_requested_at,
      sourceTable: 'payments',
      eventType: 'PAYMENT_VOID_REQUESTED',
      identifier: payment.payment_id,
      summary: `Void requested — status ${payment.void_status}`,
    })
  }
}

function addApiLogEvents(events, log) {
  if (!log) return

  pushEvent(events, {
    timestamp: log.request_ts,
    sourceTable: 'api_logs',
    eventType: 'API_REQUEST',
    identifier: log.request_id,
    summary: `${log.call_type || 'CALL'} ${log.api_url || ''}`.trim(),
  })

  if (log.response_ts && log.response_ts.getTime?.() !== log.request_ts?.getTime?.()) {
    pushEvent(events, {
      timestamp: log.response_ts,
      sourceTable: 'api_logs',
      eventType: 'API_RESPONSE',
      identifier: log.request_id,
      summary: `Response ${log.status || 'unknown'}${log.status_code ? ` (${log.status_code})` : ''}`,
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
    summary:
      event.matchConfidence === 'inferred'
        ? `Terminal event: ${event.event} (inferred match via transaction_id, unverified crosswalk)`
        : `Terminal event: ${event.event}`,
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
  payments.forEach((payment) => addPaymentEvents(events, payment))
  ;(result.relatedPayments || []).forEach((payment) => addPaymentEvents(events, payment))

  ;(result.apiLogs || []).forEach((log) => addApiLogEvents(events, log))
  ;(result.terminalEvents || []).forEach((event) => addTerminalEventEvents(events, event))
  ;(result.inferredMatches || []).forEach((event) => addTerminalEventEvents(events, { ...event, matchConfidence: 'inferred' }))

  events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  return events
}

module.exports = { buildTimeline }
