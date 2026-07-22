// Runnable demonstrations of the Incident Detection Engine, run with:
//   node src/incidents/examples.js
//
// Uses REAL Correlation Engine output where the current sample data can
// naturally produce a case (PAYMENT_NOT_CREATED, and a clean "no incident"
// baseline). Checked directly against pip_db before writing this file:
// payments has 0 rows, no api_logs row has status_code >= 500, and no
// terminal_events row has event='ERROR' in the imported samples — so
// PAYMENT_FAILURE, API_FAILURE, MISSING_API_ACTIVITY and TERMINAL_ERROR are
// demonstrated with hand-built, clearly-labeled SIMULATED correlation
// objects instead (same shape correlationEngine.js produces; nothing is
// written to the database).
require('dotenv').config()
const { pool } = require('../config/postgres/postgres')
const { correlateByOrderId, correlateByTerminalId } = require('../correlation/correlationEngine')
const { detectIncidents } = require('./incidentEngine')

function printIncidents(label, incidents) {
  console.log(`\n=== ${label} ===`)
  incidents.forEach((incident) => {
    console.log(`incidentDetected: ${incident.incidentDetected}`)
    if (incident.incidentDetected) {
      console.log(`  incidentType: ${incident.incidentType} (rule: ${incident.ruleId})`)
      console.log(`  severity: ${incident.severity}, confidence: ${incident.confidence}`)
      console.log(`  affected: merchant=${incident.affectedMerchant} order=${incident.affectedOrder} payment=${incident.affectedPayment} terminal=${incident.affectedTerminal}`)
      console.log(`  evidence (${incident.evidence.length}):`)
      incident.evidence.slice(0, 3).forEach((e) => console.log(`    - [${e.type}] ${e.note}`))
      if (incident.missingEvidence.length) console.log(`  missingEvidence: ${incident.missingEvidence.join(', ')}`)
      if (incident.warnings.length) console.log(`  correlation warnings: ${incident.warnings.join('; ')}`)
    } else {
      console.log('  (no incident — correlation evaluated clean)')
    }
  })
}

// Minimal simulated correlation fixture — same shape correlationEngine.js
// returns, built by hand for scenarios the current sample data can't
// naturally produce. Never touches the database.
function makeSimulatedCorrelation(overrides = {}) {
  return {
    correlationId: 'sim-' + Math.random().toString(36).slice(2, 10),
    entryPoint: { type: 'simulated', value: null },
    merchant: { merchant_id: 'sim-merchant-01' },
    store: { store_id: 'sim-store-01' },
    terminal: { terminal_id: 'sim-terminal-01' },
    order: null,
    payment: null,
    orders: [],
    payments: [],
    paymentEvents: [],
    apiLogs: [],
    terminalEvents: [],
    relatedPayments: [],
    inferredMatches: [],
    timeline: [],
    warnings: [],
    ...overrides,
  }
}

// Sprint 9C.3: a payment is a Payments aggregate PLUS its Payment Events
// lifecycle log, never a single row — this builds a realistic multi-event
// sequence (the ~3-5 events per payment pattern discovered in Sprint 9C.1)
// instead of one flat payment_status. `lifecycle` is ordered oldest-first;
// `minutesOffset` is minutes since a fixed base time, purely for readable,
// deterministic timestamps (Date.now()/Math.random() are avoided so this
// fixture stays reproducible).
function makeSimulatedPaymentEvents(paymentId, lifecycle) {
  const baseTimeMs = new Date('2026-01-01T00:00:00Z').getTime()
  return lifecycle.map(({ status, minutesOffset, statusMessage }, i) => ({
    entry_id: `${paymentId}-evt-${i + 1}`,
    payment_id: paymentId,
    payment_status: status,
    event_timestamp: new Date(baseTimeMs + minutesOffset * 60000).toISOString(),
    status_message: statusMessage || null,
  }))
}

async function main() {
  // --- Example 1: REAL data — order exists, resolved status, no payment
  // linked (true across all 500 sample orders, since the payment sample was
  // taken independently and never overlaps). Expect PAYMENT_NOT_CREATED,
  // with confidence downgraded because the correlation itself has warnings.
  const realOrderCorrelation = await correlateByOrderId('8436c621fc4908f2110b')
  printIncidents('REAL: order with no linked payment (expect PAYMENT_NOT_CREATED)', detectIncidents(realOrderCorrelation))

  // --- Example 2: REAL data — a terminal with 7 orders, all resolved,
  // none with a linked payment. Demonstrates the engine firing once per
  // qualifying order within a single, richer correlation.
  const realTerminalCorrelation = await correlateByTerminalId('841b3af3e890c80804')
  printIncidents('REAL: busy terminal, multiple unpaid resolved orders', detectIncidents(realTerminalCorrelation))

  // --- Example 3: SIMULATED — a clean, fully-correlated payment with no
  // warnings, evidence, or gaps. Expect no incident. current_status is the
  // derived result of the 4-event lifecycle below (Current Status
  // Derivation Rule), not a value set directly on the payment.
  const sim01Events = makeSimulatedPaymentEvents('sim-payment-01', [
    { status: 'PAYMENT_PENDING', minutesOffset: 0 },
    { status: 'PAYMENT_AUTHORIZING', minutesOffset: 1 },
    { status: 'PAYMENT_PROCESSING', minutesOffset: 3 },
    { status: 'PAYMENT_COMPLETED', minutesOffset: 6 },
  ])
  const cleanCorrelation = makeSimulatedCorrelation({
    order: { order_id: 'sim-order-01', order_status: 'PAYMENT_COMPLETED' },
    orders: [{ order_id: 'sim-order-01', order_status: 'PAYMENT_COMPLETED' }],
    payment: { payment_id: 'sim-payment-01', current_status: 'PAYMENT_COMPLETED', current_status_at: sim01Events[3].event_timestamp },
    payments: [{ payment_id: 'sim-payment-01', current_status: 'PAYMENT_COMPLETED', current_status_at: sim01Events[3].event_timestamp }],
    paymentEvents: sim01Events,
    apiLogs: [{ request_id: 'sim-req-01', status_code: 200, call_type: 'POST', api_url: '/api/payments' }],
  })
  printIncidents('SIMULATED: fully-correlated successful payment (expect no incident)', detectIncidents(cleanCorrelation))

  // --- Example 4: SIMULATED — payment exists, api_logs is empty.
  const sim02Events = makeSimulatedPaymentEvents('sim-payment-02', [
    { status: 'PAYMENT_PENDING', minutesOffset: 0 },
    { status: 'PAYMENT_PROCESSING', minutesOffset: 2 },
    { status: 'PAYMENT_COMPLETED', minutesOffset: 5 },
  ])
  const missingApiActivity = makeSimulatedCorrelation({
    payment: { payment_id: 'sim-payment-02', current_status: 'PAYMENT_COMPLETED', current_status_at: sim02Events[2].event_timestamp },
    payments: [{ payment_id: 'sim-payment-02', current_status: 'PAYMENT_COMPLETED', current_status_at: sim02Events[2].event_timestamp }],
    paymentEvents: sim02Events,
    apiLogs: [],
  })
  printIncidents('SIMULATED: payment with zero api_logs (expect MISSING_API_ACTIVITY)', detectIncidents(missingApiActivity))

  // --- Example 5: SIMULATED — 3 terminal ERROR events (none exist in the
  // imported sample; not fabricated as real data, purely an in-memory fixture).
  const terminalErrors = makeSimulatedCorrelation({
    terminalEvents: [
      { event_id: 'sim-evt-01', event: 'ERROR', terminal_id: 'sim-terminal-01', event_timestamp: '2026-01-01T00:00:00Z' },
      { event_id: 'sim-evt-02', event: 'ERROR', terminal_id: 'sim-terminal-01', event_timestamp: '2026-01-01T00:01:00Z' },
      { event_id: 'sim-evt-03', event: 'ERROR', terminal_id: 'sim-terminal-01', event_timestamp: '2026-01-01T00:02:00Z' },
    ],
  })
  printIncidents('SIMULATED: 3 terminal ERROR events (expect TERMINAL_ERROR, MEDIUM)', detectIncidents(terminalErrors))

  // --- Example 6: SIMULATED — an api_log with a 5xx status_code.
  const apiFailure = makeSimulatedCorrelation({
    apiLogs: [{ request_id: 'sim-req-03', status_code: 502, call_type: 'POST', api_url: '/api/payments/sim/status' }],
  })
  printIncidents('SIMULATED: api_log with status_code 502 (expect API_FAILURE)', detectIncidents(apiFailure))

  // --- Example 7: SIMULATED — a payment whose lifecycle ends in
  // PAYMENT_FAILED, with a real decline message on the failure event itself
  // (paymentFailureRule pulls this into evidence — see incident.evidence).
  const sim04Events = makeSimulatedPaymentEvents('sim-payment-04', [
    { status: 'PAYMENT_PENDING', minutesOffset: 0 },
    { status: 'PAYMENT_PROCESSING', minutesOffset: 2 },
    { status: 'PAYMENT_FAILED', minutesOffset: 4, statusMessage: 'Card declined by issuer — insufficient funds' },
  ])
  const paymentFailure = makeSimulatedCorrelation({
    payment: { payment_id: 'sim-payment-04', current_status: 'PAYMENT_FAILED', current_status_at: sim04Events[2].event_timestamp },
    payments: [{ payment_id: 'sim-payment-04', current_status: 'PAYMENT_FAILED', current_status_at: sim04Events[2].event_timestamp }],
    paymentEvents: sim04Events,
    apiLogs: [{ request_id: 'sim-req-04', status_code: 200, call_type: 'POST', api_url: '/api/payments' }],
  })
  printIncidents('SIMULATED: payment with status PAYMENT_FAILED (expect PAYMENT_FAILURE)', detectIncidents(paymentFailure))

  await pool.end()
}

if (require.main === module) {
  main().catch((err) => {
    console.error('EXAMPLES_FAILED:', err)
    process.exitCode = 1
  })
}

module.exports = { main, makeSimulatedCorrelation, makeSimulatedPaymentEvents }
