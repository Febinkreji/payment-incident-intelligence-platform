// Runnable demonstrations of the Correlation Engine against the real sample
// data imported in Sprints 3C-3F. Run directly with:
//   node src/correlation/examples.js
//
// The IDs below are real rows already in pip_db, not fabricated — chosen
// because they show different, honest outcomes: a fully-isolated order (no
// related payment/log/event data at all, because the independently-sampled
// datasets barely overlap), a terminal with real fan-out across three
// tables, and two "not found" lookups that prove the engine degrades
// gracefully instead of throwing.
require('dotenv').config()
const { pool } = require('../config/postgres/postgres')
const {
  correlateByOrderId,
  correlateByTerminalId,
  correlateByPaymentId,
  correlateByTransactionId,
} = require('./correlationEngine')

function printResult(label, result) {
  console.log(`\n=== ${label} ===`)
  console.log(`correlationId: ${result.correlationId}`)
  console.log(`merchant: ${result.merchant?.merchant_id || null}`)
  console.log(`store:    ${result.store?.store_id || null}`)
  console.log(`terminal: ${result.terminal?.terminal_id || null}`)
  console.log(`orders: ${result.orders.length}, payments: ${result.payments.length}, paymentEvents: ${result.paymentEvents.length}, apiLogs: ${result.apiLogs.length}, terminalEvents: ${result.terminalEvents.length}, inferredMatches: ${result.inferredMatches.length}`)
  if (result.warnings.length) console.log('warnings:', result.warnings)
  console.log(`timeline (${result.timeline.length} events):`)
  result.timeline.slice(0, 10).forEach((e) => console.log(`  ${e.timestamp}  [${e.sourceTable}] ${e.eventType} — ${e.summary}`))
}

async function main() {
  // Example 1: correlate by order_id — a real order with no related
  // payment/log/event data (the Sprint 3C-3F samples don't overlap), so this
  // demonstrates the engine returning a correct PARTIAL correlation rather
  // than an error.
  printResult(
    'Correlate by order_id (isolated order, expect partial result)',
    await correlateByOrderId('8436c621fc4908f2110b')
  )

  // Example 2: correlate by terminal_id — a terminal with real fan-out:
  // multiple orders plus terminal_events, showing merchant/store resolved
  // via two different real relationships (terminal.merchant_id is the
  // owning/fleet merchant; terminal.store_id belongs to the retail merchant
  // — both correct per the dual-merchant architecture from the Sprint 1
  // enterprise review, not a bug).
  printResult(
    'Correlate by terminal_id (busy terminal, expect multi-table fan-out)',
    await correlateByTerminalId('841b3af3e890c80804')
  )

  // Example 3: correlate by payment_id that doesn't exist — payments is
  // currently empty (Sprint 3D's sample all failed on an unrelated FK), so
  // this demonstrates the "not found" path returning a null-safe result
  // with a clear warning instead of throwing.
  printResult(
    'Correlate by payment_id (no payments imported yet, expect graceful null)',
    await correlateByPaymentId('demo-nonexistent-payment-id')
  )

  // Example 4: correlate by transaction_id — exercises both lookup paths
  // (payments.transaction_id and the unverified terminal_events.transaction_id
  // crosswalk) and confirms neither throws when nothing matches.
  printResult(
    'Correlate by transaction_id (exercises both lookup paths, expect graceful null)',
    await correlateByTransactionId('demo-nonexistent-transaction-id')
  )

  await pool.end()
}

if (require.main === module) {
  main().catch((err) => {
    console.error('EXAMPLES_FAILED:', err)
    process.exitCode = 1
  })
}

module.exports = { main }
