// Runnable demonstrations of the AI Investigation Engine, run with:
//   node src/investigation/examples.js
//
// Reuses the exact Incident objects Sprint 5 produces: real ones via the
// Correlation + Incident Detection Engines for PAYMENT_NOT_CREATED (the one
// case current sample data naturally produces — payments is empty, and no
// imported api_logs/terminal_events row triggers the other rules), and the
// same simulated correlation fixtures from incidents/examples.js for
// PAYMENT_FAILURE, API_FAILURE, and TERMINAL_ERROR. Nothing here queries the
// database directly, and no external AI is called — this uses the mock
// provider registered in Sprint 6.
require('dotenv').config()
const { pool } = require('../config/postgres/postgres')
const { correlateByOrderId } = require('../correlation/correlationEngine')
const { detectIncidents } = require('../incidents/incidentEngine')
const { makeSimulatedCorrelation } = require('../incidents/examples')
const { investigate } = require('./investigationEngine')

function printInvestigation(label, investigation) {
  console.log(`\n=== ${label} ===`)
  console.log(`investigationId: ${investigation.investigationId}`)
  console.log(`incidentId: ${investigation.incidentId}`)
  console.log(`executiveSummary: ${investigation.executiveSummary}`)
  console.log(`probableRootCause: ${investigation.probableRootCause}`)
  console.log(`confidence: ${investigation.confidence}`)
  console.log(`evidenceUsed: ${JSON.stringify(investigation.evidenceUsed)}`)
  console.log(`missingEvidence: ${JSON.stringify(investigation.missingEvidence)}`)
  console.log(`investigationSteps: ${JSON.stringify(investigation.investigationSteps, null, 2)}`)
  console.log(`recommendedActions: ${JSON.stringify(investigation.recommendedActions, null, 2)}`)
  console.log(`assumptions: ${JSON.stringify(investigation.assumptions)}`)
  console.log(`parseError: ${investigation.parseError}`)
}

async function main() {
  // --- REAL: order with no linked payment -> PAYMENT_NOT_CREATED incident.
  const realCorrelation = await correlateByOrderId('8436c621fc4908f2110b')
  const [realIncident] = detectIncidents(realCorrelation)
  printInvestigation('REAL: PAYMENT_NOT_CREATED', await investigate(realIncident))

  // --- SIMULATED: payment failure.
  const paymentFailureCorrelation = makeSimulatedCorrelation({
    payment: { payment_id: 'sim-payment-04', payment_status: 'PAYMENT_FAILED' },
    payments: [{ payment_id: 'sim-payment-04', payment_status: 'PAYMENT_FAILED' }],
    apiLogs: [{ request_id: 'sim-req-04', status_code: 200, call_type: 'POST', api_url: '/api/payments' }],
  })
  const [paymentFailureIncident] = detectIncidents(paymentFailureCorrelation)
  printInvestigation('SIMULATED: PAYMENT_FAILURE', await investigate(paymentFailureIncident))

  // --- SIMULATED: API failure (5xx).
  const apiFailureCorrelation = makeSimulatedCorrelation({
    apiLogs: [{ request_id: 'sim-req-03', status_code: 502, call_type: 'POST', api_url: '/api/payments/sim/status' }],
  })
  const [apiFailureIncident] = detectIncidents(apiFailureCorrelation)
  printInvestigation('SIMULATED: API_FAILURE', await investigate(apiFailureIncident))

  // --- SIMULATED: terminal errors.
  const terminalErrorCorrelation = makeSimulatedCorrelation({
    terminalEvents: [
      { event_id: 'sim-evt-01', event: 'ERROR', terminal_id: 'sim-terminal-01', event_timestamp: '2026-01-01T00:00:00Z' },
      { event_id: 'sim-evt-02', event: 'ERROR', terminal_id: 'sim-terminal-01', event_timestamp: '2026-01-01T00:01:00Z' },
      { event_id: 'sim-evt-03', event: 'ERROR', terminal_id: 'sim-terminal-01', event_timestamp: '2026-01-01T00:02:00Z' },
    ],
  })
  const [terminalErrorIncident] = detectIncidents(terminalErrorCorrelation)
  printInvestigation('SIMULATED: TERMINAL_ERROR', await investigate(terminalErrorIncident))

  // --- SIMULATED: missing API activity.
  const missingApiActivityCorrelation = makeSimulatedCorrelation({
    payment: { payment_id: 'sim-payment-02', payment_status: 'PAYMENT_COMPLETED' },
    payments: [{ payment_id: 'sim-payment-02', payment_status: 'PAYMENT_COMPLETED' }],
    apiLogs: [],
  })
  const [missingApiActivityIncident] = detectIncidents(missingApiActivityCorrelation)
  printInvestigation('SIMULATED: MISSING_API_ACTIVITY', await investigate(missingApiActivityIncident))

  // --- No incident -> investigate() should short-circuit without calling the provider.
  const cleanCorrelation = makeSimulatedCorrelation({
    payment: { payment_id: 'sim-payment-01', payment_status: 'PAYMENT_COMPLETED' },
    payments: [{ payment_id: 'sim-payment-01', payment_status: 'PAYMENT_COMPLETED' }],
    apiLogs: [{ request_id: 'sim-req-01', status_code: 200, call_type: 'POST', api_url: '/api/payments' }],
  })
  const [noIncident] = detectIncidents(cleanCorrelation)
  printInvestigation('SIMULATED: no incident detected (expect short-circuit, no provider call)', await investigate(noIncident))

  await pool.end()
}

if (require.main === module) {
  main().catch((err) => {
    console.error('EXAMPLES_FAILED:', err)
    process.exitCode = 1
  })
}

module.exports = { main }
