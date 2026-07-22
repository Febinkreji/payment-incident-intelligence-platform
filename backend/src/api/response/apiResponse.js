const { version } = require('../../../package.json')

// Sprint 9D.6: every response now carries a `metadata` object alongside the
// unchanged `success`/`data` (or `success`/`error`) shape — purely additive,
// so any existing client reading only `.success`/`.data`/`.error` keeps
// working unmodified (confirmed against the frontend's fetchApiEnvelope,
// which reads exactly those two fields and ignores unknown ones).
//
// executionTimeMs is computed from the timestamp requestLogger.js already
// stamps on every request (`req._startAtNs`) — no controller needs to time
// itself individually, and no new query/work is added to produce it.
function buildMetadata(res, extra) {
  const startAtNs = res.req?._startAtNs
  return {
    timestamp: new Date().toISOString(),
    version,
    executionTimeMs: startAtNs !== undefined ? Number(process.hrtime.bigint() - startAtNs) / 1e6 : null,
    ...extra,
  }
}

function success(res, data, { statusCode = 200, metadata } = {}) {
  return res.status(statusCode).json({ success: true, data, metadata: buildMetadata(res, metadata) })
}

function failure(res, { code, message }, statusCode) {
  return res.status(statusCode).json({ success: false, error: { code, message }, metadata: buildMetadata(res) })
}

module.exports = { success, failure }
