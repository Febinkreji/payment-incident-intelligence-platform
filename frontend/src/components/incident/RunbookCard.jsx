import { useState } from 'react'
import { resolveRunbook, getRunbookByKey } from '../../data/runbookCatalog'
import '../RootCauseAnalysis.css'
import './RunbookCard.css'

function CopyButton({ command }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button type="button" className="runbook-copy-button" onClick={handleCopy}>
      {copied ? 'Copied ✓' : 'Copy'}
    </button>
  )
}

// Runbook content is a static, reusable template resolved by keyword from the
// recommendation's existing `runbookLink` field — the SAME template is shared
// across every incident with a matching root cause. Nothing is stored or
// read per incident; step-completion state is local to this component only.
// `runbookKey` lets callers (e.g. the standalone Runbooks browser) open a
// specific template directly, bypassing keyword resolution.
export function RunbookCard({ runbookLink, runbookKey }) {
  const [runbook, setRunbook] = useState(() =>
    runbookKey ? getRunbookByKey(runbookKey) : resolveRunbook(runbookLink)
  )
  const [expanded, setExpanded] = useState(true)
  const [completedSteps, setCompletedSteps] = useState(() => new Set())
  const [completedChecks, setCompletedChecks] = useState(() => new Set())
  const [showRollback, setShowRollback] = useState(false)

  function toggleStep(index) {
    setCompletedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function toggleCheck(index) {
    setCompletedChecks((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function openRelated(key) {
    setRunbook(getRunbookByKey(key))
    setCompletedSteps(new Set())
    setCompletedChecks(new Set())
  }

  const stepProgress = runbook.steps.length > 0 ? Math.round((completedSteps.size / runbook.steps.length) * 100) : 0

  return (
    <section className="runbook-card">
      <div className="runbook-card-header">
        <div>
          <h2>{runbook.name}</h2>
          <div className="runbook-card-tags">
            <span className="runbook-tag runbook-tag-category">{runbook.category}</span>
            <span className={`runbook-tag runbook-tag-difficulty runbook-tag-difficulty-${runbook.difficulty.toLowerCase()}`}>
              {runbook.difficulty}
            </span>
            <span className="runbook-tag">v{runbook.version.replace(/^v/i, '')}</span>
          </div>
        </div>
        <button type="button" className="runbook-toggle" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Collapse ▲' : 'Expand ▼'}
        </button>
      </div>

      <div className="runbook-meta-row">
        <span>
          <span className="meta-label">Owner Team</span>
          {runbook.ownerTeam}
        </span>
        <span>
          <span className="meta-label">Estimated Recovery Time</span>
          {runbook.estimatedRecoveryTime}
        </span>
        <span>
          <span className="meta-label">Last Updated</span>
          {runbook.lastUpdated}
        </span>
      </div>

      {expanded && (
        <>
          <p className="runbook-description">{runbook.description}</p>

          {runbook.prerequisites?.length > 0 && (
            <div className="runbook-section">
              <h3>Prerequisites</h3>
              <ul className="runbook-checklist runbook-prerequisites">
                {runbook.prerequisites.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {runbook.escalation && (
            <div className="runbook-section runbook-escalation">
              <h3>Escalation</h3>
              <p>{runbook.escalation}</p>
            </div>
          )}

          <div className="runbook-section">
            <div className="runbook-section-header">
              <h3>Recovery Steps</h3>
              <span className="runbook-progress-label">{completedSteps.size}/{runbook.steps.length} complete</span>
            </div>
            <div className="runbook-progress-track">
              <div className="runbook-progress-fill" style={{ width: `${stepProgress}%` }} />
            </div>
            <ol className="runbook-steps">
              {runbook.steps.map((step, index) => (
                <li key={index} className={completedSteps.has(index) ? 'runbook-step-done' : ''}>
                  <button type="button" className="runbook-step-checkbox" onClick={() => toggleStep(index)}>
                    {completedSteps.has(index) ? '✓' : index + 1}
                  </button>
                  <div className="runbook-step-body">
                    <span className="runbook-step-text">{step.text}</span>
                    {step.command && (
                      <div className="runbook-step-command">
                        <code>{step.command}</code>
                        <CopyButton command={step.command} />
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="runbook-section">
            <h3>Validation Checklist</h3>
            <ul className="runbook-checklist">
              {runbook.checklist.map((item, index) => (
                <li key={index} className={completedChecks.has(index) ? 'runbook-check-done' : ''} onClick={() => toggleCheck(index)}>
                  <span className="runbook-check-mark">{completedChecks.has(index) ? '✓' : ''}</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="runbook-section">
            <button type="button" className="runbook-rollback-toggle" onClick={() => setShowRollback((v) => !v)}>
              {showRollback ? 'Hide Rollback Procedure ▲' : 'Show Rollback Procedure ▼'}
            </button>
            {showRollback && (
              <ul className="runbook-rollback-list">
                {runbook.rollback.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            )}
          </div>

          {runbook.relatedRunbooks.length > 0 && (
            <div className="runbook-section">
              <h3>Related Runbooks</h3>
              <div className="rca-chip-row">
                {runbook.relatedRunbooks.map((key) => (
                  <button type="button" className="rca-chip rca-chip-factor runbook-related-chip" key={key} onClick={() => openRelated(key)}>
                    {getRunbookByKey(key).name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="runbook-section">
            <h3>Useful Links</h3>
            <div className="runbook-links">
              {runbook.usefulLinks.map((link) => (
                <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" className="runbook-link">
                  {link.label} ↗
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
