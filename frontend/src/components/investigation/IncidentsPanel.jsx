import { SeverityBadge } from '../Badge'
import { Card } from '../ui/Card'
import { EvidencePanel } from './EvidencePanel'
import { MissingEvidencePanel } from './MissingEvidencePanel'
import { AIInvestigationPanel } from './AIInvestigationPanel'
import './investigation.css'

// Post-Sprint-8.5: incidents come from the single /api/analyze/... call,
// each already carrying its own `.investigation` (associated server-side,
// in the same execution that generated both) — no separate loading/error
// state to track here, and no ID or index matching to do on the frontend.
export function IncidentsPanel({ incidents }) {
  const detected = (incidents || []).filter((incident) => incident.incidentDetected)

  return (
    <Card className="investigation-section">
      <div className="investigation-section-title">Detected Incidents ({detected.length})</div>

      {detected.length === 0 && <p className="ui-empty-state">No incident was detected for this correlation.</p>}

      {detected.map((incident) => (
        <div key={incident.incidentId} className="investigation-incident-card">
          <div className="investigation-incident-header">
            <span className="investigation-incident-title">{incident.incidentType}</span>
            <SeverityBadge severity={incident.severity} />
            <span className={`badge badge-confidence-${incident.confidence.toLowerCase()}`}>
              {incident.confidence} confidence
            </span>
          </div>

          <strong>Evidence</strong>
          <EvidencePanel evidence={incident.evidence} />
          <MissingEvidencePanel missingEvidence={incident.missingEvidence} />

          <AIInvestigationPanel investigation={incident.investigation} />
        </div>
      ))}
    </Card>
  )
}
