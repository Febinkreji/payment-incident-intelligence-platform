import { useMemo } from 'react'
import { useAsyncResource } from './useAsyncResource'
import {
  getCorrelationByOrderId,
  getCorrelationByPaymentId,
  getCorrelationByTerminalId,
} from '../api/correlationApi'

const FETCHERS = {
  order: getCorrelationByOrderId,
  payment: getCorrelationByPaymentId,
  terminal: getCorrelationByTerminalId,
}

// type: 'order' | 'payment' | 'terminal'. Pass a falsy id to stay idle.
export function useCorrelation(type, id) {
  const resourceKey = type && id ? `${type}:${id}` : null

  const fetcher = useMemo(
    () => async () => {
      const fn = FETCHERS[type]
      if (!fn) throw new Error(`Unsupported correlation lookup type: ${type}`)
      return fn(id)
    },
    [type, id]
  )

  return useAsyncResource(resourceKey, fetcher)
}
