import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchJson } from '../api/client'
import { PageHeader } from '../components/ui/PageHeader'
import { KpiCard } from '../components/ui/KpiCard'
import { ServiceStatusCard } from '../components/ui/ServiceStatusCard'
import { SeverityBadge, StatusBadge } from '../components/Badge'
import { ActivityFeed } from '../components/analytics/ActivityFeed'
import { deriveExecutiveMetrics, deriveSystemHealth } from '../utils/executiveMetrics'
import { formatRelativeTime } from '../utils/incidentAnalytics'
import './Dashboard.css'

// Matches AnalyticsDashboard's own sample size for the same /incidents
// endpoint — one extra request beyond /dashboard, identical to what the
// previous home page already made (it fetched both too).
const INCIDENTS_SAMPLE_SIZE = 50

function buildExecutiveSummary(dashboardStats, metrics, systemHealth) {
  const unhealthy = systemHealth.filter((service) => service.status !== 'healthy')
  const unhealthyLabel =
    unhealthy.length === 0
      ? 'all core services are operating normally'
      : `${unhealthy.map((service) => service.label).join(', ')} ${
          unhealthy.length === 1 ? 'is' : 'are'
        } degraded`

  return `The platform is currently tracking ${dashboardStats.openIncidents} open incident${
    dashboardStats.openIncidents === 1 ? '' : 's'
  }, including ${dashboardStats.criticalIncidents} at critical severity. Payment success rate stands at ${
    dashboardStats.paymentSuccessRate
  }% with ${metrics.availability} availability. An estimated ${
    metrics.revenueAtRiskLabel
  } in revenue is at risk across ${metrics.affectedMerchants} merchant${
    metrics.affectedMerchants === 1 ? '' : 's'
  } and ${metrics.affectedPSPs} PSP${metrics.affectedPSPs === 1 ? '' : 's'}, with ${
    metrics.slaCompliance
  }% of open incidents currently within SLA. ${unhealthyLabel}.`
}

export function Dashboard() {
  const [dashboardStats, setDashboardStats] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let isMounted = true
    setStatus('loading')

    Promise.all([fetchJson('/dashboard'), fetchJson(`/incidents?pageSize=${INCIDENTS_SAMPLE_SIZE}`)])
      .then(([dashboard, incidentsPage]) => {
        if (!isMounted) return
        setDashboardStats(dashboard)
        setIncidents(incidentsPage.incidents)
        setStatus('success')
      })
      .catch(() => {
        if (isMounted) setStatus('error')
      })

    return () => {
      isMounted = false
    }
  }, [])

  if (status === 'loading') {
    return (
      <div className="exec-dashboard">
        <PageHeader
          title="Executive Dashboard"
          subtitle="Operational overview and executive summary across the payment platform."
        />
        <div className="exec-dashboard-skeleton">
          <div className="skeleton-block skeleton-kpi-row" />
          <div className="skeleton-block skeleton-kpi-row" />
          <div className="skeleton-block skeleton-panel" />
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="exec-dashboard">
        <PageHeader title="Executive Dashboard" />
        <p className="ui-empty-state">Unable to load dashboard. Is the backend running?</p>
      </div>
    )
  }

  const metrics = deriveExecutiveMetrics(dashboardStats, incidents)
  const systemHealth = deriveSystemHealth(incidents)
  const healthyCount = systemHealth.filter((service) => service.status === 'healthy').length

  const recentCritical = [...incidents]
    .filter((incident) => incident.severity === 'CRITICAL')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)

  const executiveSummary = buildExecutiveSummary(dashboardStats, metrics, systemHealth)

  return (
    <div className="exec-dashboard">
      <PageHeader
        title="Executive Dashboard"
        subtitle="Operational overview and executive summary across the payment platform."
      />

      <div className="page-section">
        <div className="ui-grid ui-grid-4">
          <KpiCard
            label="Open Incidents"
            value={dashboardStats.openIncidents}
            tone={dashboardStats.openIncidents > 0 ? 'warning' : 'success'}
          />
          <KpiCard
            label="Critical Incidents"
            value={dashboardStats.criticalIncidents}
            tone={dashboardStats.criticalIncidents > 0 ? 'critical' : 'success'}
          />
          <KpiCard label="Availability" value={metrics.availability} tone="success" />
          <KpiCard label="Success Rate" value={`${dashboardStats.paymentSuccessRate}%`} tone="success" />
          <KpiCard
            label="Revenue At Risk"
            value={metrics.revenueAtRiskLabel}
            tone={metrics.revenueAtRisk > 0 ? 'warning' : 'success'}
          />
          <KpiCard label="Affected Merchants" value={metrics.affectedMerchants} />
          <KpiCard label="Affected PSPs" value={metrics.affectedPSPs} />
          <KpiCard
            label="SLA Compliance"
            value={`${metrics.slaCompliance}%`}
            tone={metrics.slaCompliance >= 90 ? 'success' : 'warning'}
          />
        </div>
      </div>

      <div className="page-section">
        <h2 className="page-section-title">Operational Metrics</h2>
        <div className="ui-grid ui-grid-4">
          <KpiCard label="MTTD" value={metrics.mttd} hint="Mean time to detect" />
          <KpiCard label="MTTA" value={metrics.mtta} hint="Mean time to acknowledge" />
          <KpiCard label="MTTR" value={metrics.mttr} hint="Mean time to resolve" />
          <KpiCard label="Availability" value={metrics.availability} hint="Trailing 30 days" tone="success" />
          <KpiCard label="Transaction Volume" value={metrics.dailyVolumeLabel} hint="Estimated daily" />
          <KpiCard label="TPS" value={metrics.tps} hint="Transactions / second" />
        </div>
      </div>

      <div className="page-section">
        <h2 className="page-section-title">System Health Overview</h2>
        <div className="ui-grid ui-grid-4">
          {systemHealth.map((service) => (
            <ServiceStatusCard
              key={service.service}
              name={service.label}
              status={service.status}
              metricLabel="Open incidents"
              metricValue={service.openIncidents}
            />
          ))}
        </div>
        <p className="exec-dashboard-health-summary">
          {healthyCount} of {systemHealth.length} core services healthy
        </p>
      </div>

      <div className="exec-dashboard-columns">
        <div className="page-section">
          <h2 className="page-section-title">Recent Critical Incidents</h2>
          <div className="exec-critical-list">
            {recentCritical.length === 0 && (
              <p className="ui-empty-state">No critical incidents right now.</p>
            )}
            {recentCritical.map((incident) => (
              <Link to={`/incidents/${incident.id}`} className="exec-critical-row" key={incident.id}>
                <SeverityBadge severity={incident.severity} />
                <div className="exec-critical-row-body">
                  <span className="exec-critical-row-title">{incident.title}</span>
                  <span className="exec-critical-row-meta">
                    {incident.service} · {formatRelativeTime(incident.createdAt)}
                  </span>
                </div>
                <StatusBadge status={incident.status} />
              </Link>
            ))}
          </div>
        </div>

        <div className="page-section">
          <ActivityFeed incidents={incidents} />
        </div>
      </div>

      <div className="page-section">
        <h2 className="page-section-title">Executive Summary</h2>
        <div className="ui-card exec-summary-card">
          <p>{executiveSummary}</p>
        </div>
      </div>
    </div>
  )
}
