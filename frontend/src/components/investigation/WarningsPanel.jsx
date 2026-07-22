import { Card } from '../ui/Card'
import './investigation.css'

export function WarningsPanel({ warnings }) {
  if (!warnings || warnings.length === 0) return null

  return (
    <Card className="investigation-section">
      <div className="investigation-section-title">Correlation Warnings</div>
      <ul className="investigation-warnings-list">
        {warnings.map((warning, index) => (
          <li key={index} className="investigation-warning-item">
            ⚠ {warning}
          </li>
        ))}
      </ul>
    </Card>
  )
}
