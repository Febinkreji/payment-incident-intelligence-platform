import { useMemo } from 'react'
import { useAsyncResource } from './useAsyncResource'
import { getInvestigationByOrderId, getInvestigationByPaymentId } from '../api/investigationApi'

const FETCHERS = {
  order: getInvestigationByOrderId,
  payment: getInvestigationByPaymentId,
}

// type: 'order' | 'payment' — the API has no terminal-based investigation lookup.
export function useInvestigation(type, id) {
  const resourceKey = type && id ? `${type}:${id}` : null

  const fetcher = useMemo(
    () => async () => {
      const fn = FETCHERS[type]
      if (!fn) throw new Error(`Unsupported investigation lookup type: ${type}`)
      return fn(id)
    },
    [type, id]
  )

  return useAsyncResource(resourceKey, fetcher)
}
