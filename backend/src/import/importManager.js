const path = require('path')
const { pool } = require('../config/postgres/postgres')
const { streamCsvRows } = require('./csvImporter')
const { computeFileChecksum } = require('./utils/fileChecksum')
const { countFileRows } = require('./utils/countFileRows')
const { batchInsert } = require('./utils/batchInsert')
const { logRowFailure } = require('./utils/rowLogger')
const { recordRowError } = require('./utils/errorRecorder')
const { reportProgress } = require('./utils/progressReporter')
const transformers = require('./transformers')
const validators = require('./validators')

const DEFAULT_BATCH_SIZE = 500
const DEFAULT_PROGRESS_INTERVAL = 5000
const MAX_DRY_RUN_SAMPLE_FAILURES = 50

async function createImportJob(client, { datasetType, sourceFileName, fileChecksum }) {
  const result = await client.query(
    `INSERT INTO import_jobs (dataset_type, source_file_name, file_checksum, status, started_at)
     VALUES ($1, $2, $3, 'RUNNING', now())
     RETURNING import_job_id`,
    [datasetType, sourceFileName, fileChecksum]
  )

  return result.rows[0].import_job_id
}

async function finalizeImportJob(client, importJobId, { status, rowCount, errorCount }) {
  await client.query(
    `UPDATE import_jobs
     SET status = $2, row_count = $3, error_count = $4, completed_at = now()
     WHERE import_job_id = $1`,
    [importJobId, status, rowCount, errorCount]
  )
}

// "SUCCEEDED" only means the ETL process ran to completion, not that every
// row succeeded (a run can finish with error_count == row_count). Only a run
// that both completed AND had zero row errors counts as "this exact file is
// already fully, cleanly imported" — that's the one case worth skipping
// outright rather than re-running.
async function findCleanlyImportedJob(client, { datasetType, fileChecksum }) {
  const result = await client.query(
    `SELECT import_job_id FROM import_jobs
     WHERE dataset_type = $1 AND file_checksum = $2 AND status = 'SUCCEEDED' AND COALESCE(error_count, 0) = 0
     LIMIT 1`,
    [datasetType, fileChecksum]
  )
  return result.rows[0]?.import_job_id || null
}

// Imports (or dry-runs) a single CSV file for one dataset type. Real runs are
// not wrapped in one giant transaction — each batch (and each row-level
// fallback insert) commits on its own, so a failure partway through a
// multi-hundred-thousand-row file leaves everything already inserted intact.
async function importFile({
  datasetType,
  filePath,
  batchSize = DEFAULT_BATCH_SIZE,
  dryRun = false,
  progressInterval = DEFAULT_PROGRESS_INTERVAL,
  onProgress,
}) {
  const transformer = transformers[datasetType]
  const validator = validators[datasetType]

  if (!transformer || !validator) {
    throw new Error(`Unknown dataset type: ${datasetType}`)
  }

  const sourceFileName = path.basename(filePath)

  // Cheap, best-effort row estimate for the progress percentage — never
  // allowed to fail the import if it can't be computed.
  const totalRows = await countFileRows(filePath).catch(() => null)

  let client = null
  let importJobId = null

  if (!dryRun) {
    const fileChecksum = await computeFileChecksum(filePath)
    client = await pool.connect()

    const existingCleanJobId = await findCleanlyImportedJob(client, { datasetType, fileChecksum })
    if (existingCleanJobId) {
      client.release()
      console.log(
        `[import:${datasetType}] ${sourceFileName} is already fully imported (import_job_id=${existingCleanJobId}) — skipping.`
      )
      return { skipped: true, reason: 'already_imported', previousImportJobId: existingCleanJobId }
    }

    importJobId = await createImportJob(client, { datasetType, sourceFileName, fileChecksum })
  }

  let rowCount = 0
  let validCount = 0
  let invalidCount = 0
  let batch = []
  const skippedLines = []
  const sampleFailures = [] // dry-run only — capped, in-memory preview

  const handleRowFailure = async ({ rowIndex, errorType, errorMessage, rawRow }) => {
    logRowFailure({ datasetType, sourceFileName, rowIndex, reason: errorMessage })

    if (dryRun) {
      if (sampleFailures.length < MAX_DRY_RUN_SAMPLE_FAILURES) {
        sampleFailures.push({ rowIndex, errorType, errorMessage })
      }
      return
    }

    try {
      await recordRowError(client, {
        importJobId,
        dataset: datasetType,
        rowNumber: rowIndex,
        errorType,
        errorMessage,
        rawRow,
      })
    } catch (recordErr) {
      console.error(
        `[import:${datasetType}] failed to persist row error for row ${rowIndex}: ${recordErr.message}`
      )
    }
  }

  const maybeReportProgress = () => {
    if (rowCount % progressInterval !== 0) return
    const progress = { fileLabel: sourceFileName, rowsProcessed: rowCount, validCount, invalidCount, totalRows }
    if (onProgress) onProgress(progress)
    else reportProgress(progress)
  }

  const insertBatch = async (rows) => {
    await batchInsert(client, { table: transformer.TABLE_NAME, columns: transformer.COLUMNS, rows })
  }

  const flushBatch = async () => {
    if (batch.length === 0) return

    try {
      await insertBatch(batch)
    } catch (batchErr) {
      // One bad row shouldn't discard the rest of an otherwise-good batch —
      // retry individually so only the actual offender(s) get logged.
      for (const row of batch) {
        try {
          await insertBatch([row])
        } catch (rowErr) {
          validCount -= 1 // was tentatively counted valid after transform/validate; the insert itself failed
          invalidCount += 1
          await handleRowFailure({
            rowIndex: row.__rowIndex,
            errorType: 'INSERT',
            errorMessage: rowErr.message,
            rawRow: row.__rawRow,
          })
        }
      }
    }

    batch = []
  }

  try {
    await streamCsvRows(
      filePath,
      async (rawRow, rowIndex) => {
        rowCount += 1
        let stage = 'TRANSFORM'

        try {
          const { record, warnings } = transformer.transform(rawRow, importJobId)
          warnings.forEach((warning) =>
            console.warn(`[import:${datasetType}] row ${rowIndex} warning: ${warning}`)
          )

          stage = 'VALIDATION'
          const { valid, errors } = validator.validate(record)
          if (!valid) throw new Error(errors.join('; '))

          validCount += 1

          if (!dryRun) {
            record.__rowIndex = rowIndex
            record.__rawRow = rawRow
            batch.push(record)

            if (batch.length >= batchSize) {
              await flushBatch()
            }
          }
        } catch (rowErr) {
          invalidCount += 1
          await handleRowFailure({ rowIndex, errorType: stage, errorMessage: rowErr.message, rawRow })
        }

        maybeReportProgress()
      },
      (skipErr) => {
        // The 'skip' event isn't awaited by its emitter, so the async
        // failure-recording work is deferred to after streaming ends
        // instead of being fired-and-forgotten here.
        rowCount += 1
        invalidCount += 1
        skippedLines.push({ rowIndex: rowCount, message: skipErr.message || String(skipErr) })
      }
    )

    for (const skipped of skippedLines) {
      await handleRowFailure({
        rowIndex: skipped.rowIndex,
        errorType: 'CSV_PARSE',
        errorMessage: skipped.message,
        rawRow: null,
      })
    }

    if (!dryRun) {
      await flushBatch()
      await finalizeImportJob(client, importJobId, { status: 'SUCCEEDED', rowCount, errorCount: invalidCount })

      console.log(
        `\n${sourceFileName} — import complete\nRows Read: ${rowCount.toLocaleString('en-US')}\nValid: ${validCount.toLocaleString('en-US')}\nInvalid: ${invalidCount.toLocaleString('en-US')}`
      )

      return { importJobId, rowCount, validCount, errorCount: invalidCount }
    }

    console.log(
      `\n${sourceFileName} — DRY RUN SUMMARY\n\nRows Read: ${rowCount.toLocaleString('en-US')}\nRows Valid: ${validCount.toLocaleString('en-US')}\nRows Invalid: ${invalidCount.toLocaleString('en-US')}\nEstimated Inserts: ${validCount.toLocaleString('en-US')}`
    )

    return { dryRun: true, rowCount, validCount, invalidCount, estimatedInserts: validCount, sampleFailures }
  } catch (fatalErr) {
    if (!dryRun && importJobId) {
      await finalizeImportJob(client, importJobId, { status: 'FAILED', rowCount, errorCount: invalidCount })
    }
    throw fatalErr
  } finally {
    if (client) client.release()
  }
}

module.exports = { importFile }
