import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from '../../api/client'
import { sumMatrixRows, reorderMondayFirst } from './analyticsUtils'
import { AnalyticsHeader } from './AnalyticsHeader'
import { AnalyticsFilters } from './AnalyticsFilters'
import { ExecutiveOverview } from './ExecutiveOverview'
import { OperationalHealth } from './OperationalHealth'
import { IncidentTrendChart } from './IncidentTrendChart'
import { SeverityChart } from './SeverityChart'
import { StatusChart } from './StatusChart'
import { ServiceChart } from './ServiceChart'
import { Heatmap } from './Heatmap'
import { RegionalHealth } from './RegionalHealth'
import { MerchantAnalytics } from './MerchantAnalytics'
import { AIInsights } from './AIInsights'
import { ActivityFeed } from './ActivityFeed'
import { ExportPanel } from './ExportPanel'
import './AnalyticsDashboard.css'

const HOUR_LABELS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const RECENT_INCIDENTS_PAGE_SIZE = 50

function buildSearchQuery(filters) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value && key !== 'engineer') params.set(key, value)
  })
  params.set('pageSize', RECENT_INCIDENTS_PAGE_SIZE)
  return params.toString()
}

export function AnalyticsDashboard() {
  const [dashboardStats, setDashboardStats] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  // A single bounded page of recent (or filter-matching) incidents — used only
  // by ActivityFeed/ExportPanel, which need individual incident rows. Every
  // aggregate section below is fed by dashboardStats/analytics instead.
  const [incidents, setIncidents] = useState([])
  const [status, setStatus] = useState('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [lastRefresh, setLastRefresh] = useState(null)
  const [isFiltered, setIsFiltered] = useState(false)

  const loadData = useCallback(async (filters) => {
    setStatus('loading')

    try {
      const hasFilters = filters && Object.values(filters).some(Boolean)

      const [dashboardData, analyticsData, incidentsData] = await Promise.all([
        fetchJson('/dashboard'),
        fetchJson('/analytics'),
        hasFilters
          ? fetchJson(`/search?${buildSearchQuery(filters)}`).then((result) => result.results)
          : fetchJson(`/incidents?pageSize=${RECENT_INCIDENTS_PAGE_SIZE}`).then((page) => page.incidents),
      ])

      setDashboardStats(dashboardData)
      setAnalytics(analyticsData)
      setIncidents(incidentsData)
      setIsFiltered(Boolean(hasFilters))
      setLastRefresh(new Date())
      setStatus('success')
    } catch (error) {
      // fetch() itself rejects with a TypeError only when the request never
      // reached a server (DNS/connection failure) — an HTTP error response
      // (e.g. a filter that the backend rejected) throws a plain Error in
      // fetchJson instead, so the two cases get distinct, accurate messages.
      setErrorMessage(
        error instanceof TypeError
          ? 'Unable to reach the backend. Is it running?'
          : 'One of the analytics requests failed. Try adjusting your filters or refreshing.'
      )
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    loadData(null)
  }, [loadData])

  if (status === 'loading' && !dashboardStats) {
    return (
      <div className="analytics-dashboard">
        <p className="analytics-loading">Loading enterprise analytics…</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="analytics-dashboard">
        <p className="analytics-error">
          {errorMessage}
          <button type="button" onClick={() => loadData(null)}>
            Retry
          </button>
        </p>
      </div>
    )
  }

  const hourDayMatrixMondayFirst = reorderMondayFirst(analytics.hourDayMatrix)
  const dayTotalsMondayFirst = reorderMondayFirst(sumMatrixRows(analytics.hourDayMatrix))

  return (
    <div className="analytics-dashboard">
      <AnalyticsHeader lastRefresh={lastRefresh} onRefresh={() => loadData(null)} />

      <AnalyticsFilters onApply={loadData} onReset={() => loadData(null)} />

      {isFiltered && (
        <p className="analytics-filter-note">
          Showing filtered results ({incidents.length} incidents) in the activity feed and export
          below. Every other section (KPIs, charts, heatmaps, regional/merchant/service health)
          reflects platform-wide precomputed data from /dashboard and /analytics, which are never
          recomputed per filter to avoid scanning the incidents collection.
        </p>
      )}

      {incidents.length === 0 ? (
        <p className="chart-empty analytics-empty-banner">
          No incidents match the current filters.
        </p>
      ) : null}

      <ExecutiveOverview dashboardStats={dashboardStats} analytics={analytics} />

      <OperationalHealth dashboardStats={dashboardStats} serviceHealth={analytics.serviceHealth} />

      <section className="incident-analytics">
        <h2 className="analytics-section-title">Incident Analytics</h2>
        <div className="incident-analytics-grid">
          <IncidentTrendChart data={analytics.incidentTrend} />
          <SeverityChart data={analytics.severityDistribution} />
          <StatusChart data={analytics.statusDistribution} />
          <ServiceChart data={analytics.topAffectedServices} />
        </div>
      </section>

      <section className="heatmap-section">
        <h2 className="analytics-section-title">Heatmaps</h2>
        <div className="heatmap-section-grid">
          <Heatmap
            title="Incident Frequency by Hour"
            rowLabels={DAY_LABELS}
            columnLabels={HOUR_LABELS}
            matrix={hourDayMatrixMondayFirst}
          />
          <Heatmap
            title="Incident Frequency by Day"
            rowLabels={['Incidents']}
            columnLabels={DAY_LABELS}
            matrix={[dayTotalsMondayFirst]}
          />
        </div>
      </section>

      <RegionalHealth countryHealth={analytics.countryHealth} regionHealth={analytics.regionHealth} />

      <MerchantAnalytics merchantHealth={analytics.merchantHealth} />

      <AIInsights dashboardStats={dashboardStats} analytics={analytics} />

      <ActivityFeed incidents={incidents} />

      <ExportPanel incidents={incidents} />
    </div>
  )
}
