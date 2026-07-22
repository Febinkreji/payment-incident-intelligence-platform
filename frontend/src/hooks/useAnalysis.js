import { useMemo } from 'react'
import { useAsyncResource } from './useAsyncResource'
import { getAnalysisByOrderId, getAnalysisByPaymentId, getAnalysisByTerminalId } from '../api/analyzeApi'

const FETCHERS = {
  order: getAnalysisByOrderId,
  payment: getAnalysisByPaymentId,
  terminal: getAnalysisByTerminalId,
}

// Single-request replacement for useCorrelation + useIncidents +
// useInvestigation together — one call to /api/analyze/... returns
// correlation + incidents (each already carrying its own .investigation).
export function useAnalysis(type, id) {
  const resourceKey = type && id ? `${type}:${id}` : null

  const fetcher = useMemo(
    () => async () => {
      const fn = FETCHERS[type]
      if (!fn) throw new Error(`Unsupported analysis lookup type: ${type}`)
      return fn(id)
    },
    [type, id]
  )

  return useAsyncResource(resourceKey, fetcher)
}
