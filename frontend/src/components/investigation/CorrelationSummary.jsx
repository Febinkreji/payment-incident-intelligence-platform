import { Card } from '../ui/Card'
import './investigation.css'

function summarizeInvestigationStatus(hasIncidents, detected) {
  if (!hasIncidents) return 'Not run'
  if (detected.length === 0) return 'No incident to investigate'
  if (detected.some((incident) => !incident.investigation)) return 'Not available'
  if (detected.some((incident) => incident.investigation.parseError)) return 'Partially available'
  return 'Complete'
}

// The single top-of-page summary requested for the Investigation page —
// distinct from the legacy Executive Dashboard, since these fields (a
// single incident's type/severity/confidence) only make sense once one
// specific order/payment/terminal has actually been looked up.
//
// Post-Sprint-8.5: `incidents` comes straight from /api/analyze/... (each
// entry already carries its own `.investigation`), rather than from two
// separate incidents/investigations results.
export function CorrelationSummary({ correlation, incidents }) {
  const hasIncidents = Array.isArray(incidents)
  const detected = hasIncidents ? incidents.filter((incident) => incident.incidentDetected) : []
  const primaryIncident = detected[0] || null

  const overallStatus = !hasIncidents
    ? 'Correlation only (no incident data requested)'
    : primaryIncident
      ? 'Incident detected'
      : 'No incident detected'

  return (
    <Card className="investigation-section">
      <div className="investigation-section-title">Overview</div>
      <div className="investigation-summary-grid">
        <div className="investigation-summary-item">
          <span className="investigation-summary-label">Overall Status</span>
          <span className="investigation-summary-value">{overallStatus}</span>
        </div>
        <div className="investigation-summary-item">
          <span className="investigation-summary-label">Incident Type</span>
          <span className="investigation-summary-value">{primaryIncident?.incidentType || '—'}</span>
        </div>
        <div className="investigation-summary-item">
          <span className="investigation-summary-label">Severity</span>
          <span className="investigation-summary-value">{primaryIncident?.severity || '—'}</span>
        </div>
        <div className="investigation-summary-item">
          <span className="investigation-summary-label">Confidence</span>
          <span className="investigation-summary-value">{primaryIncident?.confidence || '—'}</span>
        </div>
        <div className="investigation-summary-item">
          <span className="investigation-summary-label">Investigation Status</span>
          <span className="investigation-summary-value">{summarizeInvestigationStatus(hasIncidents, detected)}</span>
        </div>
        <div className="investigation-summary-item">
          <span className="investigation-summary-label">Merchant</span>
          <span className="investigation-summary-value">{correlation.merchant?.merchant_id || '—'}</span>
        </div>
        <div className="investigation-summary-item">
          <span className="investigation-summary-label">Store</span>
          <span className="investigation-summary-value">{correlation.store?.store_id || '—'}</span>
        </div>
        <div className="investigation-summary-item">
          <span className="investigation-summary-label">Terminal</span>
          <span className="investigation-summary-value">{correlation.terminal?.terminal_id || '—'}</span>
        </div>
      </div>
      {detected.length > 1 && (
        <p className="investigation-parse-warning" style={{ marginTop: 'var(--space-3)' }}>
          {detected.length} incidents were detected for this correlation — see the Detected Incidents section below for all of them.
        </p>
      )}
    </Card>
  )
}
