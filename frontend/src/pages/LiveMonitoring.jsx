import { useEffect, useState } from 'react'
import { fetchJson } from '../api/client'
import { PageHeader } from '../components/ui/PageHeader'
import { MetricTile } from '../components/ui/MetricTile'
import { ServiceStatusCard } from '../components/ui/ServiceStatusCard'
import { deriveLiveMetrics } from '../utils/liveMonitoringMetrics'
import { deriveSystemHealth } from '../utils/executiveMetrics'

// Read-only, Grafana-style view. Reuses the existing /dashboard + /incidents
// endpoints (same ones the Executive Dashboard already calls) — no new
// backend surface, no polling/interval, no snapshot subscription.
export function LiveMonitoring() {
  const [dashboardStats, setDashboardStats] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let isMounted = true
    setStatus('loading')

    Promise.all([fetchJson('/dashboard'), fetchJson('/incidents?pageSize=50')])
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
      <div>
        <PageHeader title="Live Monitoring" subtitle="Read-only operational telemetry." />
        <p className="ui-empty-state">Loading metrics…</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div>
        <PageHeader title="Live Monitoring" />
        <p className="ui-empty-state">Unable to load monitoring data. Is the backend running?</p>
      </div>
    )
  }

  const metrics = deriveLiveMetrics(dashboardStats)
  const systemHealth = deriveSystemHealth(incidents)

  return (
    <div>
      <PageHeader
        title="Live Monitoring"
        subtitle="Read-only operational telemetry across payment processing and infrastructure."
      />

      <div className="page-section">
        <h2 className="page-section-title">Payment Processing</h2>
        <div className="ui-grid ui-grid-4">
          {metrics.payments.map((metric) => (
            <MetricTile
              key={metric.key}
              label={metric.label}
              value={metric.value}
              unit={metric.unit}
              status={metric.status}
            />
          ))}
        </div>
      </div>

      <div className="page-section">
        <h2 className="page-section-title">Infrastructure</h2>
        <div className="ui-grid ui-grid-4">
          {metrics.infrastructure.map((metric) => (
            <MetricTile
              key={metric.key}
              label={metric.label}
              value={metric.value}
              unit={metric.unit}
              status={metric.status}
            />
          ))}
        </div>
      </div>

      <div className="page-section">
        <h2 className="page-section-title">Service Health</h2>
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
      </div>
    </div>
  )
}
