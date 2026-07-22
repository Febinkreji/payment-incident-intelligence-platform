const { Router } = require('express')
const { requestLogger } = require('./middleware/requestLogger')
const { errorHandler } = require('./middleware/errorHandler')
const { NotFoundError } = require('../shared/errors')
const healthRoutes = require('./routes/healthRoutes')
const correlationRoutes = require('./routes/correlationRoutes')
const incidentRoutes = require('./routes/incidentRoutes')
const investigationRoutes = require('./routes/investigationRoutes')
const analyzeRoutes = require('./routes/analyzeRoutes')
const apiLogRoutes = require('./routes/apiLogRoutes')

const router = Router()

router.use(requestLogger)

router.use(healthRoutes)
router.use(correlationRoutes)
router.use(incidentRoutes)
router.use(investigationRoutes)
router.use(analyzeRoutes)
router.use(apiLogRoutes)

// Sprint 9D.7: a path that matches no route above (e.g. a missing/empty ID
// segment, like a trailing slash with nothing after it) previously fell
// through to Express's default HTML 404 page instead of this API's JSON
// envelope — found during the error-handling review. Routing it through the
// same NotFoundError/errorHandler path every other 404 already uses keeps
// every response under /api consistent, regardless of which layer rejected it.
router.use((req, res, next) => {
  next(new NotFoundError(`No route matches ${req.method} ${req.originalUrl}`))
})

// Mounted last, scoped to this router only — errors from any route above
// land here; nothing about the pre-existing app's routes or error behavior
// is affected by this.
router.use(errorHandler)

module.exports = router
