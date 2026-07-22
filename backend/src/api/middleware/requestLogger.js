// Logs method/URL/status/duration only — never req.body or req.query, so no
// payment, order, or other sensitive field ever reaches the log output.
function requestLogger(req, res, next) {
  const start = process.hrtime.bigint()

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6
    console.log(`[api] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`)
  })

  next()
}

module.exports = { requestLogger }
