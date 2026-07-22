import { Card } from '../ui/Card'
import { formatTimestamp } from '../../utils/investigationFormat'
import './investigation.css'

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
          <li key={`${event.identifier}-${index}`} className="investigation-timeline-item">
            <span className="investigation-timeline-marker" aria-hidden="true" />
            <div className="investigation-timeline-body">
              <span className="investigation-timeline-meta">
                {formatTimestamp(event.timestamp)} · {event.sourceTable} · {event.eventType}
              </span>
              <span>{event.summary}</span>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}
