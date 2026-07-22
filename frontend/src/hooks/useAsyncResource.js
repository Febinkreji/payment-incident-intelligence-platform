import { useState, useEffect, useRef, useCallback } from 'react'

// Shared loading/success/error/retry state machine so useCorrelation,
// useIncidents, useInvestigation, and useHealth don't each reimplement it.
// `resourceKey` should be a primitive (or null/undefined to stay idle) that
// changes exactly when the fetch should re-run; `fetcher` is called with no
// arguments and is read via a ref so a new closure each render doesn't need
// to be listed as a dependency (and can't go stale either).
export function useAsyncResource(resourceKey, fetcher) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null })
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const run = useCallback(() => {
    if (resourceKey === null || resourceKey === undefined) {
      setState({ status: 'idle', data: null, error: null })
      return undefined
    }

    let cancelled = false
    setState({ status: 'loading', data: null, error: null })

    fetcherRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ status: 'success', data, error: null })
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', data: null, error })
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceKey])

  useEffect(() => run(), [run])

  return { status: state.status, data: state.data, error: state.error, retry: run }
}
