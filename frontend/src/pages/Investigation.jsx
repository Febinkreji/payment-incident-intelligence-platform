import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { EntityLookupForm } from '../components/investigation/EntityLookupForm'
import { CorrelationSummary } from '../components/investigation/CorrelationSummary'
import { CorrelationTimeline } from '../components/investigation/CorrelationTimeline'
import { WarningsPanel } from '../components/investigation/WarningsPanel'
import { IncidentsPanel } from '../components/investigation/IncidentsPanel'
import { useAnalysis } from '../hooks/useAnalysis'

// Sprint 8.5: a single GET /api/analyze/... call replaces the three
// independent correlation/incidents/investigation requests from Sprint 8 —
// one HTTP round trip, one correlation/detection/investigation execution
// server-side, and the response already carries each incident's own
// investigation nested in it, so there's nothing left for this page to match.
const VALID_LOOKUP_TYPES = new Set(['order', 'payment', 'terminal'])

export function Investigation() {
  const [searchParams] = useSearchParams()
  const deepLinkType = searchParams.get('type')
  const deepLinkId = searchParams.get('id')
  const hasValidDeepLink = VALID_LOOKUP_TYPES.has(deepLinkType) && Boolean(deepLinkId)

  // Sprint: Operational Screening Dashboard — a candidate's "Investigate"
  // button links here as `/investigate?type=...&id=...` instead of requiring
  // the operator to re-type an identifier they already have. Falls back to
  // the original null/manual-entry behavior whenever the link is missing or
  // malformed, so navigating to /investigate directly is unchanged.
  const [lookup, setLookup] = useState(hasValidDeepLink ? { type: deepLinkType, id: deepLinkId } : null)

  const analysis = useAnalysis(lookup?.type, lookup?.id)

  function handleSubmit(type, id) {
    setLookup({ type, id })
  }

  return (
    <div>
      <PageHeader
        title="Investigation"
        subtitle="Look up an order, payment, or terminal to correlate every related record and detect and investigate incidents."
      />

      <div className="page-section">
        <EntityLookupForm
          onSubmit={handleSubmit}
          isLoading={analysis.status === 'loading'}
          initialType={lookup?.type}
          initialId={lookup?.id}
        />
      </div>

      {!lookup && <p className="ui-empty-state">Enter an identifier above to begin an investigation.</p>}

      {lookup && (analysis.status === 'idle' || analysis.status === 'loading') && (
        <p className="ui-empty-state">Analyzing {lookup.type} {lookup.id}…</p>
      )}

      {lookup && analysis.status === 'error' && (
        <div className="page-section">
          <p className="ui-empty-state">
            Unable to load analysis ({analysis.error?.message || 'unknown error'}). Is the backend running?
          </p>
          <button type="button" className="investigation-lookup-submit" onClick={analysis.retry}>
            Retry
          </button>
        </div>
      )}

      {lookup && analysis.status === 'success' && !analysis.data && (
        <p className="ui-empty-state">No {lookup.type} found for &quot;{lookup.id}&quot;.</p>
      )}

      {lookup && analysis.status === 'success' && analysis.data && (
        <>
          <CorrelationSummary correlation={analysis.data.correlation} incidents={analysis.data.incidents} />

          <WarningsPanel warnings={analysis.data.correlation.warnings} />

          <CorrelationTimeline timeline={analysis.data.correlation.timeline} />

          <IncidentsPanel incidents={analysis.data.incidents} />
        </>
      )}
    </div>
  )
}
