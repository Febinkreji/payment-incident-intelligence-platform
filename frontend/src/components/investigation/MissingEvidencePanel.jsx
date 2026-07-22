import './investigation.css'

const LABELS = {
  payment: 'Payment record missing',
  apiLogs: 'API logs unavailable',
  order: 'Order record missing',
}

export function MissingEvidencePanel({ missingEvidence }) {
  if (!missingEvidence || missingEvidence.length === 0) return null

  return (
    <ul className="investigation-missing-list">
      {missingEvidence.map((key, index) => (
        <li key={index} className="investigation-missing-item">
          ⚠ {LABELS[key] || `${key} missing`}
        </li>
      ))}
    </ul>
  )
}
