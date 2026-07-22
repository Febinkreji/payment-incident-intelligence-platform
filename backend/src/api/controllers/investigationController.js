const { correlateByOrderId, correlateByPaymentId } = require('../../correlation/correlationEngine')
const { detectIncidents } = require('../../incidents/incidentEngine')
const { investigateAll } = require('../../investigation/investigationEngine')
const { NotFoundError } = require('../../shared/errors')
const { success } = require('../response/apiResponse')

// Correlation -> Incident Detection -> AI Investigation -> return. Every
// step is a single call into its own engine; no engine logic is reimplemented
// here.

async function getInvestigationByOrderId(req, res, next) {
  try {
    const correlation = await correlateByOrderId(req.params.orderId)
    if (!correlation.order) throw new NotFoundError(`No order found for order_id=${req.params.orderId}`)

    const incidents = detectIncidents(correlation)
    const investigations = await investigateAll(incidents)
    return success(res, { correlationId: correlation.correlationId, investigations })
  } catch (err) {
    next(err)
  }
}

async function getInvestigationByPaymentId(req, res, next) {
  try {
    const correlation = await correlateByPaymentId(req.params.paymentId)
    if (!correlation.payment) throw new NotFoundError(`No payment found for payment_id=${req.params.paymentId}`)

    const incidents = detectIncidents(correlation)
    const investigations = await investigateAll(incidents)
    return success(res, { correlationId: correlation.correlationId, investigations })
  } catch (err) {
    next(err)
  }
}

module.exports = { getInvestigationByOrderId, getInvestigationByPaymentId }
