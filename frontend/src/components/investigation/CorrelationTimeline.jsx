import { Card } from '../ui/Card'
import { formatTimestamp } from '../../utils/investigationFormat'
import './investigation.css'

// Sprint 9D.3: source-type badge text + which detail fields to surface, per
// sourceTable/apiType. Keeps the JSX below a plain lookup instead of a wall
// of if/else — reuses whatever timelineBuilder.js already computed (label,
// summary, details, outcome), no new business logic lives here.
function sourceBadge(event) {
  if (event.sourceTable === 'api_logs') {
    return event.details.apiType === 'RESPONSE' ? { text: 'API Response', arrow: '↓' } : { text: 'API Request', arrow: '↑' }
  }
  if (event.sourceTable === 'payment_events' || event.sourceTable === 'payments') return { text: 'Payment', arrow: '' }
  if (event.sourceTable === 'orders') return { text: 'Order', arrow: '' }
  if (event.sourceTable === 'terminal_events') return { text: 'Terminal', arrow: '' }
  return { text: event.sourceTable, arrow: '' }
}

const DETAIL_FIELD_LABELS = {
  merchantId: 'Merchant',
  terminalId: 'Terminal',
  paymentId: 'Payment',
  orderId: 'Order',
  responseTimeMs: 'Response Time',
  reason: 'Reason',
}

// Only these fields are ever rendered as separate detail rows — everything
// else in `details` (method, url, statusCode, status, amount, currency, ...)
// is either already folded into `label`/`summary` or not useful on its own,
// so showing it again here would just be noise.
const DETAIL_FIELD_ORDER = ['reason', 'responseTimeMs', 'merchantId', 'terminalId', 'paymentId', 'orderId']

function buildDetailRows(details) {
  return DETAIL_FIELD_ORDER
    .filter((field) => details[field] !== null && details[field] !== undefined && details[field] !== '')
    .map((field) => ({
      label: DETAIL_FIELD_LABELS[field],
      value: field === 'responseTimeMs' ? `${details[field]} ms` : details[field],
    }))
}

function TimelineEvent({ event }) {
  const badge = sourceBadge(event)
  const rows = buildDetailRows(event.details)

  return (
    <li className="investigation-timeline-item">
      <span className={`investigation-timeline-marker investigation-timeline-marker-${event.outcome}`} aria-hidden="true" />
      <div className="investigation-timeline-body">
        <div className="investigation-timeline-header">
          <span className={`badge investigation-timeline-badge investigation-timeline-badge-${event.sourceTable === 'api_logs' ? (event.details.apiType === 'RESPONSE' ? 'api-response' : 'api-request') : event.sourceTable}`}>
            {badge.arrow ? `${badge.arrow} ` : ''}{badge.text}
          </span>
          <span className="investigation-timeline-time">{formatTimestamp(event.timestamp)}</span>
        </div>
        <div className="investigation-timeline-label">{event.label || event.eventType}</div>
        <div className="investigation-timeline-summary">{event.summary}</div>
        {rows.length > 0 && (
          <dl className="investigation-timeline-details">
            {rows.map((row) => (
              <div className="investigation-timeline-detail" key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </li>
  )
}

export function CorrelationTimeline({ timeline }) {
  if (!timeline || timeline.length === 0) {
    return (
      <Card className="investigation-section">
        <div className="investigation-section-title">Timeline</div>
        <p className="ui-empty-state">No timeline events were found for this correlation.</p>
      </Card>
    )
  }

  return (
    <Card className="investigation-section">
      <div className="investigation-section-title">Timeline ({timeline.length} events)</div>
      <ol className="investigation-timeline">
        {timeline.map((event, index) => (
          <TimelineEvent event={event} key={`${event.identifier}-${event.sourceTable}-${index}`} />
        ))}
      </ol>
    </Card>
  )
}
