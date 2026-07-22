const { ValidationError } = require('../../shared/errors')

// Every ID observed across orders/payments/terminals in this project is an
// opaque hex-like or human-assigned string (never a numeric ID) — this just
// guards against empty, absurdly long, or obviously injection-shaped input,
// not against a single fixed ID format.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

function validateIdParam(paramName) {
  return function validateIdParamMiddleware(req, res, next) {
    const value = req.params[paramName]

    if (!value || !ID_PATTERN.test(value)) {
      return next(new ValidationError(`${paramName} must be a non-empty alphanumeric identifier`))
    }

    next()
  }
}

module.exports = { validateIdParam }
