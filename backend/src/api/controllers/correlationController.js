const {
  correlateByOrderId,
  correlateByPaymentId,
  correlateByTerminalId,
} = require('../../correlation/correlationEngine')
const { NotFoundError } = require('../../shared/errors')
const { success } = require('../response/apiResponse')

// Every handler follows the same shape: call the Correlation Engine, map its
// null-safe "not found" convention to a proper 404, wrap the result. No SQL,
// no relationship logic — that all lives in correlationEngine.js.

async function getCorrelationByOrderId(req, res, next) {
  try {
    const result = await correlateByOrderId(req.params.orderId)
    if (!result.order) throw new NotFoundError(`No order found for order_id=${req.params.orderId}`)
    return success(res, result)
  } catch (err) {
    next(err)
  }
}

async function getCorrelationByPaymentId(req, res, next) {
  try {
    const result = await correlateByPaymentId(req.params.paymentId)
    if (!result.payment) throw new NotFoundError(`No payment found for payment_id=${req.params.paymentId}`)
    return success(res, result)
  } catch (err) {
    next(err)
  }
}

async function getCorrelationByTerminalId(req, res, next) {
  try {
    const result = await correlateByTerminalId(req.params.terminalId)
    if (!result.terminal) throw new NotFoundError(`No terminal found for terminal_id=${req.params.terminalId}`)
    return success(res, result)
  } catch (err) {
    next(err)
  }
}

module.exports = { getCorrelationByOrderId, getCorrelationByPaymentId, getCorrelationByTerminalId }
