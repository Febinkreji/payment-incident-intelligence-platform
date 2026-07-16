import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchJson } from '../api/client'
import { PageHeader } from '../components/ui/PageHeader'
import { Modal } from '../components/ui/Modal'
import {
  buildEvidenceSourcesOverview,
  groupEvidenceByCategory,
  buildEvidenceAiSummary,
} from '../utils/evidenceSourcesOverview'
import { formatRelativeTime } from '../utils/incidentAnalytics'
import './EvidenceSources.css'

function Sparkline({ data }) {
  const width = 100
  const height = 28
  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width
      const y = height - (value / 100) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="evidence-src-sparkline">
      <polyline points={points} fill="none" strokeWidth="1.5" />
    </svg>
  )
}

function SourceCard({ source, onOpen }) {
  return (
    <button type="button" className={`evidence-src-card evidence-src-${source.status}`} onClick={() => onOpen(source)}>
      <div className="evidence-src-card-top">
        <span className={`evidence-src-dot evidence-src-dot-${source.status}`} />
        <span className="evidence-src-label">{source.label}</span>
      </div>
      <div className="evidence-src-card-meta">
        <span>Contribution: {source.contribution}</span>
        <span>{source.anomalyCount} related</span>
      </div>
    </button>
  )
}

// Read-only. Built entirely from the same /incidents list already fetched
// elsewhere (Incident Management / Executive Dashboard) — one request,
// reused, no per-incident investigation fetches, no new endpoint.
export function EvidenceSources() {
  const [incidents, setIncidents] = useState([])
  const [status, setStatus] = useState('loading')
  const [selectedKey, setSelectedKey] = useState(null)

  useEffect(() => {
    let isMounted = true
    setStatus('loading')

    fetchJson('/incidents?pageSize=50')
      .then((data) => {
        if (!isMounted) return
        setIncidents(data.incidents)
        setStatus('success')
      })
      .catch(() => {
        if (isMounted) setStatus('error')
      })

    return () => {
      isMounted = false
    }
  }, [])

  if (status === 'loading') {
    return (
      <div>
        <PageHeader title="Evidence Sources" subtitle="Every investigation data source, read-only." />
        <p className="ui-empty-state">Loading evidence sources…</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div>
        <PageHeader title="Evidence Sources" />
        <p className="ui-empty-state">Unable to load evidence sources. Is the backend running?</p>
      </div>
    )
  }

  const overview = buildEvidenceSourcesOverview(incidents)
  const groups = groupEvidenceByCategory(overview)
  const selected = overview.find((source) => source.key === selectedKey) || null

  return (
    <div>
      <PageHeader
        title="Evidence Sources"
        subtitle="Every investigation data source PIP correlates against, grouped by category."
      />

      {groups.map((group) => (
        <div className="page-section" key={group.category}>
          <h2 className="page-section-title">{group.category}</h2>
          <div className="ui-grid ui-grid-4">
            {group.sources.map((source) => (
              <SourceCard source={source} key={source.key} onOpen={(s) => setSelectedKey(s.key)} />
            ))}
          </div>
        </div>
      ))}

      {selected && (
        <Modal title={selected.label} onClose={() => setSelectedKey(null)}>
          <div className="evidence-src-detail">
            <div className="evidence-src-detail-row">
              <span className="meta-label">Category</span>
              {selected.category}
            </div>
            <div className="evidence-src-detail-row">
              <span className="meta-label">Health</span>
              {selected.status}
            </div>
            <div className="evidence-src-detail-row">
              <span className="meta-label">Contribution</span>
              {selected.contribution} ({selected.confidence}% confidence)
            </div>

            <h3>Metrics</h3>
            <Sparkline data={selected.sparkline} />

            <h3>AI Summary</h3>
            <p className="evidence-src-ai-summary">{buildEvidenceAiSummary(selected)}</p>

            <h3>Anomalies</h3>
            <p>{selected.anomalyCount} anomal{selected.anomalyCount === 1 ? 'y' : 'ies'} detected in the current window.</p>

            <h3>Related Incidents</h3>
            {selected.relatedIncidents.length === 0 ? (
              <p className="ui-empty-state">No related incidents.</p>
            ) : (
              <ul className="evidence-src-related-list">
                {selected.relatedIncidents.map((incident) => (
                  <li key={incident.id}>
                    <Link to={`/incidents/${incident.id}`} onClick={() => setSelectedKey(null)}>
                      {incident.title}
                    </Link>
                    <span className="evidence-src-related-time">{formatRelativeTime(incident.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
