import { useEffect, useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { IncidentCard } from '../components/IncidentCard'
import { SearchBar } from '../components/SearchBar'
import { fetchJson } from '../api/client'
import './IncidentManagement.css'

const INCIDENTS_PAGE_SIZE = 12

function buildQuery(params) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value)
  })
  return query.toString()
}

// Reuses exactly the same /incidents + /search endpoints the old home
// Dashboard used — this page is that same experience, moved and restyled,
// not a new backend surface.
export function IncidentManagement() {
  const [incidentsPage, setIncidentsPage] = useState(null)
  const [status, setStatus] = useState('loading')
  const [incidentsCursor, setIncidentsCursor] = useState({ cursor: null, direction: 'next' })

  const [searchFilters, setSearchFilters] = useState(null)
  const [searchCursor, setSearchCursor] = useState({ cursor: null, direction: 'next' })
  const [searchResult, setSearchResult] = useState(null)
  const [searchStatus, setSearchStatus] = useState('idle')

  useEffect(() => {
    let isMounted = true
    setStatus('loading')

    const query = buildQuery({
      pageSize: INCIDENTS_PAGE_SIZE,
      cursor: incidentsCursor.cursor,
      direction: incidentsCursor.direction,
    })

    fetchJson(`/incidents?${query}`)
      .then((data) => {
        if (!isMounted) return
        setIncidentsPage(data)
        setStatus('success')
      })
      .catch(() => {
        if (!isMounted) return
        setStatus('error')
      })

    return () => {
      isMounted = false
    }
  }, [incidentsCursor])

  useEffect(() => {
    if (!searchFilters) return undefined

    let isMounted = true
    setSearchStatus('loading')

    const query = buildQuery({
      ...searchFilters,
      pageSize: 12,
      cursor: searchCursor.cursor,
      direction: searchCursor.direction,
    })

    fetchJson(`/search?${query}`)
      .then((data) => {
        if (!isMounted) return
        setSearchResult(data)
        setSearchStatus('success')
      })
      .catch(() => {
        if (!isMounted) return
        setSearchStatus('error')
      })

    return () => {
      isMounted = false
    }
  }, [searchFilters, searchCursor])

  function handleSearch(filters) {
    setSearchCursor({ cursor: null, direction: 'next' })
    setSearchFilters(filters)
  }

  function handleClearSearch() {
    setSearchFilters(null)
    setSearchResult(null)
    setSearchStatus('idle')
    setSearchCursor({ cursor: null, direction: 'next' })
  }

  const showingSearch = searchStatus !== 'idle'

  return (
    <div className="incident-mgmt">
      <PageHeader
        title="Incident Management"
        subtitle="Search, filter, and triage every payment incident across the platform."
      />

      <Card className="incident-mgmt-filters">
        <SearchBar onSearch={handleSearch} onClear={handleClearSearch} />
      </Card>

      {showingSearch ? (
        <div className="page-section">
          <h2 className="page-section-title">Search Results</h2>

          {searchStatus === 'loading' && <p className="ui-empty-state">Searching…</p>}
          {searchStatus === 'error' && (
            <p className="ui-empty-state">Search failed. Is the backend running?</p>
          )}
          {searchStatus === 'success' && searchResult && searchResult.results.length === 0 && (
            <p className="ui-empty-state">No incidents match your search.</p>
          )}
          {searchStatus === 'success' && searchResult && searchResult.results.length > 0 && (
            <>
              <div className="incident-mgmt-grid">
                {searchResult.results.map((incident) => (
                  <IncidentCard incident={incident} key={incident.id} />
                ))}
              </div>
              <div className="incident-mgmt-pagination">
                <button
                  type="button"
                  disabled={!searchResult.hasPreviousPage}
                  onClick={() =>
                    setSearchCursor({ cursor: searchResult.previousCursor, direction: 'previous' })
                  }
                >
                  ← Previous
                </button>
                <span>{searchResult.total} results</span>
                <button
                  type="button"
                  disabled={!searchResult.hasNextPage}
                  onClick={() => setSearchCursor({ cursor: searchResult.nextCursor, direction: 'next' })}
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="page-section">
          <h2 className="page-section-title">All Incidents</h2>

          {status === 'loading' && <p className="ui-empty-state">Loading incidents…</p>}
          {status === 'error' && (
            <p className="ui-empty-state">Unable to load incidents. Is the backend running?</p>
          )}
          {status === 'success' && incidentsPage && incidentsPage.incidents.length === 0 && (
            <p className="ui-empty-state">No incidents.</p>
          )}
          {status === 'success' && incidentsPage && incidentsPage.incidents.length > 0 && (
            <>
              <div className="incident-mgmt-grid">
                {incidentsPage.incidents.map((incident) => (
                  <IncidentCard incident={incident} key={incident.id} />
                ))}
              </div>
              <div className="incident-mgmt-pagination">
                <button
                  type="button"
                  disabled={!incidentsPage.hasPreviousPage}
                  onClick={() =>
                    setIncidentsCursor({ cursor: incidentsPage.previousCursor, direction: 'previous' })
                  }
                >
                  ← Previous
                </button>
                <button
                  type="button"
                  disabled={!incidentsPage.hasNextPage}
                  onClick={() =>
                    setIncidentsCursor({ cursor: incidentsPage.nextCursor, direction: 'next' })
                  }
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
