const {
  correlateByOrderId,
  correlateByPaymentId,
  correlateByTerminalId,
} = require('../../correlation/correlationEngine')
const { detectIncidents } = require('../../incidents/incidentEngine')
const { investigateAll } = require('../../investigation/investigationEngine')
const { NotFoundError } = require('../../shared/errors')
const { success } = require('../response/apiResponse')

// Runs Correlation -> Incident Detection -> AI Investigation exactly once
// per request. The separate /correlation, /incidents, /investigation
// endpoints each run this same chain independently, which is what caused
// the Sprint 8 bug: detectIncidents() mints a fresh incidentId on every
// call, so two independent requests can never produce matching IDs.
//
// Here, detectIncidents() runs once, and investigateAll() is called with
// THOSE SAME incident objects — investigationEngine already stamps
// investigation.incidentId = incident.incidentId, so within this one
// execution the two are guaranteed to correspond. Nesting each incident's
// investigation directly onto it (rather than returning two parallel arrays)
// means the frontend never has to match anything itself, by ID or by index.
async function buildAnalysis(correlation) {
  const incidents = detectIncidents(correlation)
  const investigations = await investigateAll(incidents)

  const investigationsByIncidentId = new Map(
    investigations.map((investigation) => [investigation.incidentId, investigation])
  )

  const incidentsWithInvestigation = incidents.map((incident) => ({
    ...incident,
    investigation: investigationsByIncidentId.get(incident.incidentId) || null,
  }))

  return { correlation, incidents: incidentsWithInvestigation }
}

async function analyzeByOrderId(req, res, next) {
  try {
    const correlation = await correlateByOrderId(req.params.orderId)
    if (!correlation.order) throw new NotFoundError(`No order found for order_id=${req.params.orderId}`)

    return success(res, await buildAnalysis(correlation))
  } catch (err) {
    next(err)
  }
}

async function analyzeByPaymentId(req, res, next) {
  try {
    const correlation = await correlateByPaymentId(req.params.paymentId)
    if (!correlation.payment) throw new NotFoundError(`No payment found for payment_id=${req.params.paymentId}`)

    return success(res, await buildAnalysis(correlation))
  } catch (err) {
    next(err)
  }
}

async function analyzeByTerminalId(req, res, next) {
  try {
    const correlation = await correlateByTerminalId(req.params.terminalId)
    if (!correlation.terminal) throw new NotFoundError(`No terminal found for terminal_id=${req.params.terminalId}`)

    return success(res, await buildAnalysis(correlation))
  } catch (err) {
    next(err)
  }
}

module.exports = { analyzeByOrderId, analyzeByPaymentId, analyzeByTerminalId }
