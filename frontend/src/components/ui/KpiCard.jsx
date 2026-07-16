export function KpiCard({ label, value, hint, tone = 'default', trend, Icon }) {
  return (
    <div className={`kpi-card kpi-card-${tone}`}>
      <div className="kpi-card-top">
        <span className="kpi-card-label">{label}</span>
        {Icon && <Icon className="kpi-card-icon" />}
      </div>
      <div className="kpi-card-value">{value}</div>
      {(hint || trend) && (
        <div className="kpi-card-meta">
          {trend && (
            <span className={`kpi-card-trend kpi-card-trend-${trend.direction}`}>{trend.label}</span>
          )}
          {hint && <span className="kpi-card-hint">{hint}</span>}
        </div>
      )}
    </div>
  )
}
