const { failure } = require('../response/apiResponse')

// Centralized error handler for this API layer only (mounted at the end of
// api.js's own router, so it never touches the pre-existing Firestore-based
// routes or their error behavior). Reuses the existing ValidationError /
// NotFoundError classes from shared/errors — their statusCode is honored if
// present, anything unrecognized becomes a generic 500 with no stack trace
// or internal detail ever sent to the client.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500
  const code = err.name || 'INTERNAL_ERROR'
  const message = statusCode === 500 ? 'An unexpected error occurred' : err.message

  if (statusCode === 500) {
    console.error('[api] unhandled error:', err)
  }

  failure(res, { code, message }, statusCode)
}

module.exports = { errorHandler }
