import { useAsyncResource } from './useAsyncResource'
import { getHealth } from '../api/healthApi'

export function useHealth() {
  return useAsyncResource('health', getHealth)
}
