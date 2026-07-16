import { useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { Modal } from '../components/ui/Modal'
import { RunbookCard } from '../components/incident/RunbookCard'
import { getAllRunbooks } from '../data/runbookCatalog'
import './Runbooks.css'

function RunbookSummaryCard({ runbook, onOpen }) {
  return (
    <button type="button" className="runbook-browse-card" onClick={() => onOpen(runbook.key)}>
      <div className="runbook-browse-card-top">
        <span className="runbook-browse-card-category">{runbook.category}</span>
        <span className={`runbook-browse-card-difficulty runbook-browse-card-difficulty-${runbook.difficulty.toLowerCase()}`}>
          {runbook.difficulty}
        </span>
      </div>
      <h3>{runbook.name}</h3>
      <p>{runbook.description}</p>
      <div className="runbook-browse-card-meta">
        <span>{runbook.ownerTeam}</span>
        <span>{runbook.estimatedRecoveryTime}</span>
      </div>
    </button>
  )
}

// Fully static — the entire catalog lives in frontend/src/data/runbookCatalog.js.
// No fetch, no Firestore read, no backend endpoint of any kind.
export function Runbooks() {
  const runbooks = getAllRunbooks()
  const [openKey, setOpenKey] = useState(null)

  return (
    <div>
      <PageHeader
        title="Runbooks"
        subtitle="Reusable recovery procedures shared across every incident with a matching root cause."
      />

      <div className="ui-grid ui-grid-3">
        {runbooks.map((runbook) => (
          <RunbookSummaryCard runbook={runbook} key={runbook.key} onOpen={setOpenKey} />
        ))}
      </div>

      {openKey && (
        <Modal title="Runbook" onClose={() => setOpenKey(null)}>
          <RunbookCard runbookKey={openKey} />
        </Modal>
      )}
    </div>
  )
}
