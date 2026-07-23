import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { ScreeningSummary } from '../components/screening/ScreeningSummary'
import { ScreeningFilters } from '../components/screening/ScreeningFilters'
import { CandidateTable } from '../components/screening/CandidateTable'
import { useScreening, useScreeningRules } from '../hooks/useScreening'
import './Screening.css'

const PAGE_SIZE = 50
const DEFAULT_FILTERS = { preset: 'last-hour', offset: 0, limit: PAGE_SIZE }

const HAS_ACTIVE_NARROWING_FILTER = (filters) =>
  Boolean(filters.priority || filters.entityType || (filters.ruleIds && filters.ruleIds.length > 0) || filters.search)

export function Screening() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const navigate = useNavigate()

  const screening = useScreening(filters)
  const rulesResource = useScreeningRules()

  // Any real filter change (window/priority/entityType/rules/search) starts
  // the operator back at page 1 — only explicit Prev/Next touches `offset`
  // on its own.
  const handleFilterChange = useCallback((partial) => {
    setFilters((previous) => ({ ...previous, ...partial, offset: 0 }))
  }, [])

  const handlePageChange = useCallback((nextOffset) => {
    setFilters((previous) => ({ ...previous, offset: nextOffset }))
  }, [])

  const handleInvestigate = useCallback(
    (candidate) => {
      const params = new URLSearchParams({ type: candidate.entityType, id: candidate.entityId })
      navigate(`/investigate?${params.toString()}`)
    },
    [navigate]
  )

  const candidates = screening.data?.candidates
  const pagination = screening.data?.pagination
  const metadata = screening.data?.screening

  const isValidationError = screening.status === 'error' && screening.error?.status === 400
  const hasActiveFilter = useMemo(() => HAS_ACTIVE_NARROWING_FILTER(filters), [filters])

  return (
    <div>
      <PageHeader
        title="Operational Screening"
        subtitle="Which operational events require investigation right now — ranked by priority, backed by evidence."
      />

      {screening.status === 'success' && metadata && (
        <div className="page-section">
          <ScreeningSummary metadata={metadata} />
        </div>
      )}

      <Card className="screening-filters-card">
        <ScreeningFilters
          filters={filters}
          rules={rulesResource.data?.rules}
          rulesStatus={rulesResource.status}
          onChange={handleFilterChange}
        />
      </Card>

      <div className="page-section">
        <h2 className="page-section-title">Investigation Candidates</h2>

        {(screening.status === 'idle' || screening.status === 'loading') && (
          <p className="ui-empty-state">Screening the selected window…</p>
        )}

        {screening.status === 'error' && isValidationError && (
          <p className="ui-empty-state">Invalid filter: {screening.error.message}</p>
        )}

        {screening.status === 'error' && !isValidationError && (
          <div>
            <p className="ui-empty-state">
              Unable to load screening candidates ({screening.error?.message || 'unknown error'}). Is the backend
              running?
            </p>
            <button type="button" className="screening-investigate-button" onClick={screening.retry}>
              Retry
            </button>
          </div>
        )}

        {screening.status === 'success' && candidates && candidates.length === 0 && !hasActiveFilter && (
          <p className="ui-empty-state">
            No candidates in this screening window — nothing in {metadata.window.label.toLowerCase()} matched any
            rule.
          </p>
        )}

        {screening.status === 'success' && candidates && candidates.length === 0 && hasActiveFilter && (
          <p className="ui-empty-state">No candidates match your current filters. Try widening them.</p>
        )}

        {screening.status === 'success' && candidates && candidates.length > 0 && (
          <>
            <CandidateTable candidates={candidates} onInvestigate={handleInvestigate} />

            <div className="screening-pagination">
              <button
                type="button"
                disabled={pagination.offset === 0}
                onClick={() => handlePageChange(Math.max(0, pagination.offset - pagination.limit))}
              >
                ← Previous
              </button>
              <span>
                {pagination.offset + 1}–{Math.min(pagination.offset + pagination.limit, pagination.total)} of{' '}
                {pagination.total}
              </span>
              <button
                type="button"
                disabled={!pagination.hasMore}
                onClick={() => handlePageChange(pagination.offset + pagination.limit)}
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
