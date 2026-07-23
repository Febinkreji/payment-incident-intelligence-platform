const pendingPaymentRule = require('./rules/pendingPaymentRule')
const failedPaymentRule = require('./rules/failedPaymentRule')
const cancelledPaymentRule = require('./rules/cancelledPaymentRule')
const apiServerErrorRule = require('./rules/apiServerErrorRule')
const apiTimeoutRule = require('./rules/apiTimeoutRule')
const slowApiResponseRule = require('./rules/slowApiResponseRule')
const apiRetryThresholdRule = require('./rules/apiRetryThresholdRule')
const terminalNotReportingRule = require('./rules/terminalNotReportingRule')
const highValuePaymentRule = require('./rules/highValuePaymentRule')
const duplicateTransactionRule = require('./rules/duplicateTransactionRule')
const multipleRetriesRule = require('./rules/multipleRetriesRule')

// Adding a new rule means: 1) add one file under rules/ (id, displayName,
// description, entityType, version, defaultEnabled, configurableParams,
// dataSourceKey, buildParams, evaluate), 2) register it here, 3) add a
// priority mapping in priorityConfig.js if it needs one other than the LOW
// default. screeningEngine.js never branches on rule identity — nothing
// there changes when a rule is added, as long as its dataSourceKey already
// exists in screeningRepository.js (a new data shape, if one is ever needed,
// is a Data Selection Layer addition, not an engine change).
module.exports = [
  pendingPaymentRule,
  failedPaymentRule,
  cancelledPaymentRule,
  apiServerErrorRule,
  apiTimeoutRule,
  slowApiResponseRule,
  apiRetryThresholdRule,
  terminalNotReportingRule,
  highValuePaymentRule,
  duplicateTransactionRule,
  multipleRetriesRule,
]
