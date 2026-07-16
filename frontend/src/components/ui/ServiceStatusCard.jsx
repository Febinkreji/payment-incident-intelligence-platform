export function ServiceStatusCard({ name, status, metricLabel, metricValue }) {
  return (
    <div className={`service-status-card service-status-${status}`}>
      <span className="service-status-dot" />
      <div className="service-status-body">
        <span className="service-status-name">{name}</span>
        {metricLabel && (
          <span className="service-status-metric">
            {metricLabel}: {metricValue}
          </span>
        )}
      </div>
      <span className="service-status-label">{status}</span>
    </div>
  )
}
