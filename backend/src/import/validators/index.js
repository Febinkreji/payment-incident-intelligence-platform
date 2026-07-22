const orders = require('./orderValidator')
const paymentEvents = require('./paymentEventValidator')
const apiLogs = require('./apiLogValidator')
const terminalEvents = require('./terminalEventValidator')

// Adding a new dataset means adding one validator file and registering it
// here under its dataset-type key.
//
// Sprint 9C.3: 'payments' (the old paymentValidator) is replaced by
// 'payment_events' — see transformers/index.js for why.
module.exports = {
  orders,
  payment_events: paymentEvents,
  api_logs: apiLogs,
  terminal_events: terminalEvents,
}
