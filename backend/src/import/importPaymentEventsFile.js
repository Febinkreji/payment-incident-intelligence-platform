const { importFile } = require('./importManager')
const { recomputeAggregatesForImportJob } = require('../paymentEvents/paymentEventsService')

// Two-stage import for the payment_events dataset (Sprint 9C.3):
//
//   Stage A — reuse importFile() completely unmodified with the
//             'payment_events' dataset type: a normal one-CSV-row-to-one-
//             table-row import. entry_id has no PK-conflict risk (unlike the
//             old payment_id-keyed 'payments' import, the root cause of the
//             Sprint 9C migration slowdown), so this is a plain, low-risk
//             batch insert.
//   Stage B — a separate aggregation step: for every payment_id touched by
//             this file's import job, recompute its payments aggregate row
//             from its FULL event history, queried fresh from the DB — never
//             scoped to only this file's events, since a payment's events
//             can span two different source CSV files near a date-range
//             boundary (flagged in Sprint 9C.2A). A payment whose order_id
//             isn't in the Orders dataset is skipped, not fatal (Sprint 9C.4C).
//
// importManager.js itself is never modified by this — zero risk to the
// already-proven orders/api_logs/terminal_events import paths.
async function importPaymentEventsFile({ filePath, batchSize, dryRun = false, progressInterval, onProgress }) {
  const stageAResult = await importFile({
    datasetType: 'payment_events',
    filePath,
    batchSize,
    dryRun,
    progressInterval,
    onProgress,
  })

  if (dryRun || stageAResult.skipped) {
    return { stageA: stageAResult, stageB: null }
  }

  const { recomputed, skippedOrphans } = await recomputeAggregatesForImportJob(stageAResult.importJobId)

  return {
    stageA: stageAResult,
    stageB: { paymentsRecomputed: recomputed.length, skippedOrphans },
  }
}

module.exports = { importPaymentEventsFile }
