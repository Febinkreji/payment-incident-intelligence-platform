const paymentFailureRule = require('./rules/paymentFailureRule')
const apiFailureRule = require('./rules/apiFailureRule')
const terminalErrorRule = require('./rules/terminalErrorRule')
const missingApiActivityRule = require('./rules/missingApiActivityRule')
const paymentNotCreatedRule = require('./rules/paymentNotCreatedRule')
const repeatedPaymentFailuresRule = require('./rules/repeatedPaymentFailuresRule')
const retryStormRule = require('./rules/retryStormRule')
const slowApiResponseRule = require('./rules/slowApiResponseRule')
const longRunningPaymentJourneyRule = require('./rules/longRunningPaymentJourneyRule')
const failureSpikeRule = require('./rules/failureSpikeRule')

// Adding a new rule means adding one file under rules/ (id, incidentType,
// evaluate(correlation)) and registering it here — incidentEngine.js never
// branches on rule type, so nothing else changes.
module.exports = [
  paymentFailureRule,
  apiFailureRule,
  terminalErrorRule,
  missingApiActivityRule,
  paymentNotCreatedRule,
  // Sprint 9D.4
  repeatedPaymentFailuresRule,
  retryStormRule,
  slowApiResponseRule,
  longRunningPaymentJourneyRule,
  failureSpikeRule,
]
