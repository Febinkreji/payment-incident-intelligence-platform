// Logs method/URL/status/duration only — never req.body or req.query, so no
// payment, order, or other sensitive field ever reaches the log output.
function requestLogger(req, res, next) {
  const start = process.hrtime.bigint()
  // Sprint 9D.6: stashed on req (not just this closure) so apiResponse.js's
  // success()/failure() can compute executionTimeMs for the response
  // metadata without every controller measuring its own timing by hand.
  req._startAtNs = start

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6
    console.log(`[api] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`)
  })

  next()
}

module.exports = { requestLogger }
