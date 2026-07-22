import { useMemo } from 'react'
import { useAsyncResource } from './useAsyncResource'
import { getIncidentsByOrderId, getIncidentsByPaymentId } from '../api/incidentApi'

const FETCHERS = {
  order: getIncidentsByOrderId,
  payment: getIncidentsByPaymentId,
}

// type: 'order' | 'payment' — the API has no terminal-based incident lookup.
export function useIncidents(type, id) {
  const resourceKey = type && id ? `${type}:${id}` : null

  const fetcher = useMemo(
    () => async () => {
      const fn = FETCHERS[type]
      if (!fn) throw new Error(`Unsupported incident lookup type: ${type}`)
      return fn(id)
    },
    [type, id]
  )

  return useAsyncResource(resourceKey, fetcher)
}
