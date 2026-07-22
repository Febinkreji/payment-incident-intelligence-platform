const { correlateByOrderId, correlateByPaymentId } = require('../../correlation/correlationEngine')
const { detectIncidents } = require('../../incidents/incidentEngine')
const { NotFoundError } = require('../../shared/errors')
const { success } = require('../response/apiResponse')

// Correlation -> Incident Detection -> return. Detection logic itself lives
// entirely in incidentEngine.js; this only sequences the two engine calls.

async function getIncidentsByOrderId(req, res, next) {
  try {
    const correlation = await correlateByOrderId(req.params.orderId)
    if (!correlation.order) throw new NotFoundError(`No order found for order_id=${req.params.orderId}`)

    const incidents = detectIncidents(correlation)
    return success(res, { correlationId: correlation.correlationId, incidents })
  } catch (err) {
    next(err)
  }
}

async function getIncidentsByPaymentId(req, res, next) {
  try {
    const correlation = await correlateByPaymentId(req.params.paymentId)
    if (!correlation.payment) throw new NotFoundError(`No payment found for payment_id=${req.params.paymentId}`)

    const incidents = detectIncidents(correlation)
    return success(res, { correlationId: correlation.correlationId, incidents })
  } catch (err) {
    next(err)
  }
}

module.exports = { getIncidentsByOrderId, getIncidentsByPaymentId }
