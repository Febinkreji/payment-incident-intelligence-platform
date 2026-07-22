const express = require('express')
const cors = require('cors')
const healthRoutes = require('./routes/health.routes')
const apiRoutes = require('./routes/api.routes')
const incidentRoutes = require('./modules/incidents/routes/incident.routes')
const workflowRoutes = require('./modules/workflow/routes/workflow.routes')
const investigationRoutes = require('./modules/investigations/routes/investigation.routes')
const dashboardRoutes = require('./modules/dashboard/routes/dashboard.routes')
const analyticsRoutes = require('./modules/analytics/routes/analytics.routes')
const recommendationRoutes = require('./modules/recommendation/routes/recommendation.routes')
const searchRoutes = require('./modules/search/routes/search.routes')
const notificationRoutes = require('./modules/notifications/routes/notification.routes')
const authRoutes = require('./modules/auth/routes/auth.routes')
const adminRoutes = require('./modules/admin/routes/admin.routes')
const postgresApi = require('./api/api')

const app = express()

// In production, restrict CORS to the deployed frontend origin(s) via
// CORS_ORIGINS (comma-separated) or FRONTEND_URL. Left unset, all origins
// are allowed — the existing local-dev behavior.
const configuredOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(cors(configuredOrigins.length > 0 ? { origin: configuredOrigins } : undefined))
app.use(express.json())

app.use('/', healthRoutes)
app.use('/', apiRoutes)
app.use('/', incidentRoutes)
app.use('/', workflowRoutes)
app.use('/', investigationRoutes)
app.use('/', dashboardRoutes)
app.use('/', analyticsRoutes)
app.use('/', recommendationRoutes)
app.use('/', searchRoutes)
app.use('/', notificationRoutes)
app.use('/', authRoutes)
app.use('/', adminRoutes)

// Mounted under /api rather than '/' — the existing routes above already
// occupy bare /health, /incidents, and /incidents/:id for the Firestore-based
// app; this keeps the new Postgres-backed engines' endpoints collision-free
// without touching any of them.
app.use('/api', postgresApi)

module.exports = app
