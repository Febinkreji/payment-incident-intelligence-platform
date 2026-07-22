import { fetchApiEnvelope } from './newBackendClient'

export function getHealth() {
  return fetchApiEnvelope('/api/health')
}
