const orders = require('./orderTransformer')
const paymentEvents = require('./paymentEventTransformer')
const apiLogs = require('./apiLogTransformer')
const terminalEvents = require('./terminalEventTransformer')

// Adding a new dataset means adding one transformer file and registering it
// here under its dataset-type key.
//
// Sprint 9C.3: 'payments' (one row per CSV row, the old paymentTransformer)
// is replaced by 'payment_events' — every CSV row becomes one payment_events
// row; the payments aggregate is computed separately by
// paymentEventsService.recomputePaymentAggregate(), not by this transform step.
module.exports = {
  orders,
  payment_events: paymentEvents,
  api_logs: apiLogs,
  terminal_events: terminalEvents,
}
