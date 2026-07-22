import { getBestTimestamp, formatTimestamp } from '../../utils/investigationFormat'
import './investigation.css'

export function EvidencePanel({ evidence }) {
  if (!evidence || evidence.length === 0) {
    return <p className="ui-empty-state">No evidence was recorded for this incident.</p>
  }

  return (
    <ul className="investigation-evidence-list">
      {evidence.map((item, index) => (
        <li key={index} className="investigation-evidence-item">
          <span className="investigation-evidence-source">{item.type}</span>
          <span className="investigation-evidence-timestamp">
            {formatTimestamp(getBestTimestamp(item.record))}
          </span>
          <div>{item.note}</div>
        </li>
      ))}
    </ul>
  )
}
