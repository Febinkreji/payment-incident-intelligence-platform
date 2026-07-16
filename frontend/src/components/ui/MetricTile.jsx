export function MetricTile({ label, value, unit, status = 'healthy' }) {
  return (
    <div className={`metric-tile metric-tile-${status}`}>
      <span className="metric-tile-label">{label}</span>
      <span className="metric-tile-value">
        {value}
        {unit && <span className="metric-tile-unit">{unit}</span>}
      </span>
    </div>
  )
}
