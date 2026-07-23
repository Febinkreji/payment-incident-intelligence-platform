import { useMemo } from 'react'
import { useAsyncResource } from './useAsyncResource'
import { getScreeningCandidates, getScreeningRules } from '../api/screeningApi'

// Same shape as useAnalysis.js: a resourceKey that changes exactly when the
// filters that matter change, a fetcher read via useAsyncResource's ref (so
// a new closure each render never needs listing as a dependency), and no
// filtering logic here — every field in `filters` is passed straight
// through to the backend, which does the actual filtering.
export function useScreening(filters) {
  const resourceKey = useMemo(() => JSON.stringify(filters), [filters])

  const fetcher = useMemo(
    () => () => getScreeningCandidates(filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resourceKey]
  )

  return useAsyncResource(resourceKey, fetcher)
}

// Rule list rarely changes within a session — a constant resourceKey means
// useAsyncResource fetches it once on mount rather than re-fetching on every
// filter change, and the shared in-flight dedup in fetchApiEnvelope already
// collapses any accidental double-mount call.
export function useScreeningRules() {
  const fetcher = useMemo(() => () => getScreeningRules(), [])
  return useAsyncResource('screening-rules', fetcher)
}
