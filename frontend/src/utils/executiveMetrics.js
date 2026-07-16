import { hashString, deriveImpactMetrics, deriveEscalation } from './incidentAnalytics'

// The backend's /dashboard endpoint only ever returns placeholder MTTR/MTTD
// strings (see backend/src/modules/dashboard/services/dashboard.service.js
// PLACEHOLDER_METRICS) — there is no real MTTA at all today. Per-incident
// telemetry (revenue-at-risk, SLA breach) already exists in
// incidentAnalytics.js but was previously only ever applied to a single
// incident on the details page; this file aggregates it across an
// already-fetched incident list for the Executive Dashboard, with zero
// additional Firestore reads or network requests.
//
// MTTD/MTTA/MTTR/Recovery Success below are a fixed, internally-consistent
// demo baseline (detection < acknowledgment < resolution, as in a real
// pipeline) — the same kind of static "demo metric" the backend already
// ships for MTTR/MTTD, just realistic instead of the placeholder 32m/4m.
// Safe to replace with a real computed metric later without touching
// anything else on this page.
const DEMO_MTTD_SECONDS = 138 // 2m 18s
const DEMO_MTTA_SECONDS = 292 // 4m 52s
const DEMO_MTTR_SECONDS = 1711 // 28m 31s
const DEMO_RECOVERY_SUCCESS = 98

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds}s`
}

function formatCompactNumber(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}

const OPEN_STATUSES = new Set(['OPEN', 'TRIAGED', 'INVESTIGATING', 'MITIGATING', 'MONITORING'])

export function deriveExecutiveMetrics(dashboardStats, incidents = []) {
  const today = new Date().toISOString().slice(0, 10)
  const seed = hashString(`exec-metrics-${today}`)

  const tps = 800 + (seed % 600) // stable per-day demo figure, 800-1400
  const dailyVolume = tps * 86400

  const openIncidents = incidents.filter((incident) => OPEN_STATUSES.has(incident.status))
  const criticalOpen = openIncidents.filter((incident) => incident.severity === 'CRITICAL')

  const impacts = openIncidents.map(deriveImpactMetrics)
  const revenueAtRisk = impacts.reduce((sum, impact) => sum + impact.revenueAtRisk, 0)

  const merchants = new Set()
  const psps = new Set()
  impacts.forEach((impact) => {
    impact.affectedMerchants.forEach((merchant) => merchants.add(merchant))
    impact.pspsImpacted.forEach((psp) => psps.add(psp))
  })

  const escalations = openIncidents.map(deriveEscalation)
  const breachedCount = escalations.filter((escalation) => escalation.isBreached).length
  const slaCompliance =
    openIncidents.length === 0
      ? 100
      : Math.round(((openIncidents.length - breachedCount) / openIncidents.length) * 100)

  const criticalCount = dashboardStats?.criticalIncidents ?? criticalOpen.length
  const availability = Math.max(99.5, 100 - criticalCount * 0.03).toFixed(2)

  return {
    mttd: formatDuration(DEMO_MTTD_SECONDS),
    mtta: formatDuration(DEMO_MTTA_SECONDS),
    mttr: formatDuration(DEMO_MTTR_SECONDS),
    recoverySuccess: DEMO_RECOVERY_SUCCESS,
    availability: `${availability}%`,
    tps,
    dailyVolumeLabel: `${formatCompactNumber(dailyVolume)}/day`,
    revenueAtRisk,
    revenueAtRiskLabel: `$${formatCompactNumber(revenueAtRisk)}`,
    affectedMerchants: merchants.size,
    affectedPSPs: psps.size,
    slaCompliance,
    openIncidentsCount: openIncidents.length,
    criticalOpenCount: criticalOpen.length,
  }
}

// Fixed core-service list, named consistently with the correlation graph's
// SERVICE_TO_NODE mapping in incidentAnalytics.js. Status is derived purely
// from the already-fetched incident list — grouping by `incident.service` —
// not a new data source.
export const CORE_SERVICES = [
  { label: 'API Gateway', service: 'auth-service' },
  { label: 'Checkout API', service: 'checkout-api' },
  { label: 'Payment Orchestrator', service: 'payment-orchestrator' },
  { label: 'Risk Engine', service: 'risk-engine' },
  { label: 'Redis Cache', service: 'redis-cache' },
  { label: 'Database Cluster', service: 'database-cluster' },
  { label: 'Settlement Service', service: 'settlement-service' },
  { label: 'Notification Service', service: 'notification-service' },
]

export function deriveSystemHealth(incidents) {
  return CORE_SERVICES.map(({ label, service }) => {
    const openForService = incidents.filter(
      (incident) => incident.service === service && OPEN_STATUSES.has(incident.status)
    )
    const hasCritical = openForService.some((incident) => incident.severity === 'CRITICAL')
    const hasOpen = openForService.length > 0

    const status = hasCritical ? 'critical' : hasOpen ? 'warning' : 'healthy'

    return {
      label,
      service,
      status,
      openIncidents: openForService.length,
    }
  })
}
