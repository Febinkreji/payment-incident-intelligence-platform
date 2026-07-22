import { PageHeader } from '../components/ui/PageHeader'
import { MetricTile } from '../components/ui/MetricTile'
import { useHealth } from '../hooks/useHealth'

function formatUptime(seconds) {
  if (typeof seconds !== 'number') return '—'
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${hrs}h ${mins}m ${secs}s`
}

export function Health() {
  const { status, data, error, retry } = useHealth()

  // 'idle' is the state on the very first render, before the effect inside
  // useAsyncResource has had a chance to flip it to 'loading' — treating it
  // as anything other than a loading state would fall through to the success
  // branch below with data still null.
  if (status === 'idle' || status === 'loading') {
    return (
      <div>
        <PageHeader title="System Health" subtitle="Live status of the PostgreSQL-backed API." />
        <p className="ui-empty-state">Checking backend health…</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div>
        <PageHeader title="System Health" />
        <p className="ui-empty-state">
          Unable to reach the backend ({error?.message || 'network error'}). Is it running?
        </p>
        <button type="button" className="investigation-lookup-submit" onClick={retry}>
          Retry
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div>
        <PageHeader title="System Health" />
        <p className="ui-empty-state">No health data was returned by the backend.</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="System Health" subtitle="Live status of the PostgreSQL-backed API." />

      <div className="page-section">
        <div className="ui-grid ui-grid-4">
          <MetricTile
            label="API Status"
            value={data.status === 'ok' ? 'Healthy' : 'Degraded'}
            status={data.status === 'ok' ? 'healthy' : 'critical'}
          />
          <MetricTile
            label="Database"
            value={data.databaseReachable ? 'Reachable' : 'Unreachable'}
            status={data.databaseReachable ? 'healthy' : 'critical'}
          />
          <MetricTile label="Version" value={data.version} />
          <MetricTile label="Uptime" value={formatUptime(data.uptime)} />
        </div>
        <p className="ui-empty-state" style={{ marginTop: 'var(--space-4)' }}>
          Last checked: {new Date(data.timestamp).toLocaleString()}
        </p>
        <button type="button" className="investigation-lookup-submit" onClick={retry}>
          Refresh
        </button>
      </div>
    </div>
  )
}
