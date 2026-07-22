const { Router } = require('express')
const { requestLogger } = require('./middleware/requestLogger')
const { errorHandler } = require('./middleware/errorHandler')
const healthRoutes = require('./routes/healthRoutes')
const correlationRoutes = require('./routes/correlationRoutes')
const incidentRoutes = require('./routes/incidentRoutes')
const investigationRoutes = require('./routes/investigationRoutes')
const analyzeRoutes = require('./routes/analyzeRoutes')

const router = Router()

router.use(requestLogger)

router.use(healthRoutes)
router.use(correlationRoutes)
router.use(incidentRoutes)
router.use(investigationRoutes)
router.use(analyzeRoutes)

// Mounted last, scoped to this router only — errors from any route above
// land here; nothing about the pre-existing app's routes or error behavior
// is affected by this.
router.use(errorHandler)

module.exports = router
