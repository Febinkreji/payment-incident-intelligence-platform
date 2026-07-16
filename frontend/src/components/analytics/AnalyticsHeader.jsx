import { PageHeader } from '../ui/PageHeader'
import './AnalyticsHeader.css'

function formatClock(date) {
  return date.toLocaleTimeString('en-US', { hour12: false })
}

// Slimmed down for the enterprise redesign — the platform title, theme,
// notifications, and profile now live in the global TopHeader/Sidebar, so
// this only keeps what's unique to Analytics: the live-refresh control.
export function AnalyticsHeader({ lastRefresh, onRefresh }) {
  return (
    <PageHeader
      title="Analytics"
      subtitle="Executive-quality trends, distributions, and impact analysis."
      actions={
        <button type="button" className="analytics-header-live" onClick={onRefresh}>
          <span className="analytics-header-pulse" />
          Live{lastRefresh ? ` · refreshed ${formatClock(lastRefresh)}` : ''}
        </button>
      }
    />
  )
}
