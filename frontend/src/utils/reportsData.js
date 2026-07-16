import { deriveImpactMetrics, deriveEscalation } from './incidentAnalytics'

// /analytics has no PSP distribution and no root-cause aggregation, and no
// platform-wide revenue/SLA rollup — these are derived here from the same
// /incidents list already fetched for this page (reused endpoint, zero
// additional requests), the same way executiveMetrics.js aggregates
// per-incident synthesis for the Executive Dashboard.

export function buildRootCauseTrend(incidents) {
  const counts = new Map()
  incidents.forEach((incident) => {
    const cause = incident.rootCause || 'Unclassified'
    counts.set(cause, (counts.get(cause) || 0) + 1)
  })
  return [...counts.entries()]
    .map(([rootCause, count]) => ({ rootCause, count }))
    .sort((a, b) => b.count - a.count)
}

export function buildPspReport(incidents) {
  const byPsp = new Map()
  incidents.forEach((incident) => {
    const psp = incident.psp || 'Unknown'
    if (!byPsp.has(psp)) byPsp.set(psp, { psp, incidents: 0, critical: 0 })
    const entry = byPsp.get(psp)
    entry.incidents += 1
    if (incident.severity === 'CRITICAL') entry.critical += 1
  })
  return [...byPsp.values()].sort((a, b) => b.incidents - a.incidents)
}

export function buildRevenueImpactReport(incidents) {
  const rows = incidents.map((incident) => ({
    id: incident.id,
    title: incident.title,
    severity: incident.severity,
    ...deriveImpactMetrics(incident),
  }))
  const totalRevenueAtRisk = rows.reduce((sum, row) => sum + row.revenueAtRisk, 0)
  const totalCustomersImpacted = rows.reduce((sum, row) => sum + row.customersImpacted, 0)
  return {
    rows: rows.sort((a, b) => b.revenueAtRisk - a.revenueAtRisk),
    totalRevenueAtRisk,
    totalCustomersImpacted,
  }
}

export function buildSlaReport(incidents) {
  const rows = incidents.map((incident) => ({
    id: incident.id,
    title: incident.title,
    severity: incident.severity,
    status: incident.status,
    ...deriveEscalation(incident),
  }))
  const breachedCount = rows.filter((row) => row.isBreached).length
  const compliance = rows.length === 0 ? 100 : Math.round(((rows.length - breachedCount) / rows.length) * 100)
  return { rows, breachedCount, compliance }
}
