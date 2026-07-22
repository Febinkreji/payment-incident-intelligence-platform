const crypto = require('crypto')
const resolver = require('./relationshipResolver')
const { buildTimeline } = require('./timelineBuilder')
const { createEmptyCorrelationResult } = require('./models')

const DEFAULT_FANOUT_LIMIT = 200

function dedupeById(rows, idField) {
  const byId = new Map()
  for (const row of rows) byId.set(row[idField], row)
  return [...byId.values()]
}

function tagConfidence(rows, matchConfidence) {
  return rows.map((row) => ({ ...row, matchConfidence }))
}

async function resolveMerchantStoreTerminal(result, { merchantId, terminalId }) {
  const terminal = await resolver.getTerminal(terminalId)
  result.terminal = terminal

  const [merchant, store] = await Promise.all([
    resolver.getMerchant(merchantId || terminal?.merchant_id),
    resolver.getStore(terminal?.store_id),
  ])
  result.merchant = merchant
  result.store = store
}

// Order is the anchor: its own FKs give merchant/terminal directly. Payments,
// api_logs and terminal_events are then pulled by order_id in parallel,
// batched queries — never one query per related row.
async function correlateByOrderId(orderId, options = {}) {
  const result = createEmptyCorrelationResult({
    correlationId: crypto.randomUUID(),
    entryPoint: { type: 'order_id', value: orderId },
  })

  const order = await resolver.getOrderById(orderId)
  result.order = order
  result.orders = order ? [order] : []

  if (!order) {
    result.warnings.push(`No order found for order_id=${orderId}`)
    result.timeline = buildTimeline(result)
    return result
  }

  await resolveMerchantStoreTerminal(result, { merchantId: order.merchant_id, terminalId: order.terminal_id })

  const [payments, apiLogsDirect, terminalEventsDirect] = await Promise.all([
    resolver.getPaymentsByOrderId(order.order_id),
    resolver.getApiLogsByOrderId(order.order_id),
    resolver.getTerminalEventsByOrderId(order.order_id),
  ])

  result.payments = payments
  result.payment = payments.find((p) => p.payment_type === 'PURCHASE') || payments[0] || null

  const paymentIds = payments.map((p) => p.payment_id)

  const [apiLogsViaPayments, terminalEventsInferred, paymentEvents] = await Promise.all([
    resolver.getApiLogsByPaymentIds(paymentIds),
    resolver.getTerminalEventsByTransactionIdInferred(paymentIds),
    resolver.getPaymentEventsByPaymentIds(paymentIds),
  ])

  result.paymentEvents = paymentEvents

  result.apiLogs = dedupeById([...apiLogsDirect, ...apiLogsViaPayments], 'request_id')

  const confirmedIds = new Set(terminalEventsDirect.map((e) => e.event_id))
  result.terminalEvents = tagConfidence(terminalEventsDirect, 'confirmed')
  result.inferredMatches = tagConfidence(
    terminalEventsInferred.filter((e) => !confirmedIds.has(e.event_id)),
    'inferred'
  )

  if (payments.length === 0) result.warnings.push('No payments found for this order in the current sample data')
  if (payments.length > 0 && paymentEvents.length === 0) {
    result.warnings.push('Payment(s) found for this order but no payment_events are linked to them')
  }
  if (result.apiLogs.length === 0) result.warnings.push('No API logs found for this order')
  if (result.terminalEvents.length === 0 && result.inferredMatches.length === 0) {
    result.warnings.push('No terminal events found for this order')
  }

  result.timeline = buildTimeline(result)
  return result
}

// Payment is the anchor: merchant_id/store_id come straight off the payment
// row itself; terminal can only be reached indirectly (via the order, since
// payments has no terminal_id column), so it's left null if the order is
// missing rather than guessed.
async function correlateByPaymentId(paymentId, options = {}) {
  const result = createEmptyCorrelationResult({
    correlationId: crypto.randomUUID(),
    entryPoint: { type: 'payment_id', value: paymentId },
  })

  const payment = await resolver.getPaymentById(paymentId)
  result.payment = payment
  result.payments = payment ? [payment] : []

  if (!payment) {
    result.warnings.push(`No payment found for payment_id=${paymentId}`)
    result.timeline = buildTimeline(result)
    return result
  }

  const [order, relatedPayments, terminalCodes, paymentEvents] = await Promise.all([
    resolver.getOrderById(payment.order_id),
    resolver.getRelatedPayments(payment),
    resolver.getTerminalCodesForPayment(payment.payment_id),
    resolver.getPaymentEventsByPaymentIds([payment.payment_id]),
  ])

  result.order = order
  result.orders = order ? [order] : []
  result.relatedPayments = relatedPayments
  result.paymentEvents = paymentEvents

  const [merchant, store] = await Promise.all([
    resolver.getMerchant(payment.merchant_id),
    resolver.getStore(payment.store_id),
  ])
  result.merchant = merchant
  result.store = store
  result.terminal = order ? await resolver.getTerminal(order.terminal_id) : null

  const [apiLogsByPayment, apiLogsByOrder, terminalEventsByOrder, terminalEventsInferred] = await Promise.all([
    resolver.getApiLogsByPaymentIds([payment.payment_id]),
    order ? resolver.getApiLogsByOrderId(order.order_id) : Promise.resolve([]),
    order ? resolver.getTerminalEventsByOrderId(order.order_id) : Promise.resolve([]),
    resolver.getTerminalEventsByTransactionIdInferred([payment.payment_id]),
  ])

  result.apiLogs = dedupeById([...apiLogsByPayment, ...apiLogsByOrder], 'request_id')

  const confirmedIds = new Set(terminalEventsByOrder.map((e) => e.event_id))
  result.terminalEvents = tagConfidence(terminalEventsByOrder, 'confirmed')
  result.inferredMatches = tagConfidence(
    terminalEventsInferred.filter((e) => !confirmedIds.has(e.event_id)),
    'inferred'
  )

  if (!order) result.warnings.push('No order found for this payment (order_id may be outside current sample data)')
  if (paymentEvents.length === 0) result.warnings.push('No payment_events found for this payment')
  if (result.apiLogs.length === 0) result.warnings.push('No API logs found for this payment')
  if (result.terminalEvents.length === 0 && result.inferredMatches.length === 0) {
    result.warnings.push('No terminal events found for this payment')
  }
  if (terminalCodes.length === 0) {
    result.warnings.push('No terminal codes linked via payment_terminal_code (this junction is not yet populated by any importer)')
  }

  result.timeline = buildTimeline(result)
  return result
}

// transaction_id is ambiguous by design: it's a real column on payments
// (gateway-side reference, distinct from payment_id) AND a real column on
// terminal_events (no FK — hypothesized, unverified, to hold a payment_id).
// Both are tried; results from the unverified path are always tagged.
async function correlateByTransactionId(transactionId, options = {}) {
  const result = createEmptyCorrelationResult({
    correlationId: crypto.randomUUID(),
    entryPoint: { type: 'transaction_id', value: transactionId },
  })

  const [paymentByTransactionId, paymentByIdGuess, terminalEventsDirect] = await Promise.all([
    resolver.getPaymentByTransactionId(transactionId),
    resolver.getPaymentById(transactionId),
    resolver.getTerminalEventsByTransactionIdInferred([transactionId]),
  ])

  const payment = paymentByTransactionId || paymentByIdGuess
  result.inferredMatches = tagConfidence(terminalEventsDirect, 'inferred')

  if (!payment) {
    result.warnings.push(`No payment found matching transaction_id=${transactionId} (checked payments.transaction_id and payments.payment_id)`)
    if (result.inferredMatches.length === 0) {
      result.warnings.push('No terminal events found for this transaction_id either')
    }
    result.timeline = buildTimeline(result)
    return result
  }

  // Reuse the payment-anchored path once a payment is found, then merge in
  // the inferred terminal_events matches from this transaction_id specifically.
  const viaPayment = await correlateByPaymentId(payment.payment_id, options)
  viaPayment.correlationId = result.correlationId
  viaPayment.entryPoint = result.entryPoint

  const confirmedIds = new Set(viaPayment.terminalEvents.map((e) => e.event_id))
  const extraInferred = result.inferredMatches.filter(
    (e) => !confirmedIds.has(e.event_id) && !viaPayment.inferredMatches.some((x) => x.event_id === e.event_id)
  )
  viaPayment.inferredMatches = [...viaPayment.inferredMatches, ...extraInferred]
  viaPayment.timeline = buildTimeline(viaPayment)

  return viaPayment
}

// Terminal is a hub, not a leaf — many orders/api_logs/terminal_events can
// point at one terminal_id, so every fan-out query is capped at `limit`
// (default 200) to stay scalable as fact tables grow into the millions;
// payments are then pulled in one batched query keyed on the resolved order_ids.
async function correlateByTerminalId(terminalId, options = {}) {
  const limit = options.limit || DEFAULT_FANOUT_LIMIT
  const result = createEmptyCorrelationResult({
    correlationId: crypto.randomUUID(),
    entryPoint: { type: 'terminal_id', value: terminalId },
  })

  const terminal = await resolver.getTerminal(terminalId)
  result.terminal = terminal

  if (!terminal) {
    result.warnings.push(`No terminal found for terminal_id=${terminalId}`)
    result.timeline = buildTimeline(result)
    return result
  }

  const [merchant, store, orders, apiLogs, terminalEvents] = await Promise.all([
    resolver.getMerchant(terminal.merchant_id),
    resolver.getStore(terminal.store_id),
    resolver.getOrdersByTerminalId(terminalId, limit),
    resolver.getApiLogsByTerminalId(terminalId, limit),
    resolver.getTerminalEventsByTerminalId(terminalId, limit),
  ])

  result.merchant = merchant
  result.store = store
  result.orders = orders
  result.apiLogs = apiLogs
  result.terminalEvents = tagConfidence(terminalEvents, 'confirmed')

  const orderIds = orders.map((o) => o.order_id)
  const payments = await resolver.getPaymentsByOrderIds(orderIds)
  result.payments = payments
  result.paymentEvents = await resolver.getPaymentEventsByPaymentIds(payments.map((p) => p.payment_id))

  if (orders.length === 0) result.warnings.push('No orders found for this terminal in the current sample data')
  if (apiLogs.length === 0) result.warnings.push('No API logs found for this terminal')
  if (terminalEvents.length === 0) result.warnings.push('No terminal events found for this terminal')
  if (orders.length === limit) {
    result.warnings.push(`Order fan-out capped at ${limit} rows — more may exist for this terminal`)
  }

  result.timeline = buildTimeline(result)
  return result
}

async function correlate({ type, value, limit }) {
  switch (type) {
    case 'order_id':
      return correlateByOrderId(value)
    case 'payment_id':
      return correlateByPaymentId(value)
    case 'transaction_id':
      return correlateByTransactionId(value)
    case 'terminal_id':
      return correlateByTerminalId(value, { limit })
    default:
      throw new Error(`Unknown correlation entry type: ${type}`)
  }
}

module.exports = {
  correlate,
  correlateByOrderId,
  correlateByPaymentId,
  correlateByTransactionId,
  correlateByTerminalId,
}
