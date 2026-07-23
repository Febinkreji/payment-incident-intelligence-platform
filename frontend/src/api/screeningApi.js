import { fetchApiEnvelope } from './newBackendClient'

function buildQuery(params) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    query.set(key, Array.isArray(value) ? value.join(',') : value)
  })
  return query.toString()
}

// Both the dashboard's "browse" view and its "apply filters" action hit the
// same GET /screening/candidates — the backend's GET already accepts every
// filter (window, ruleIds, priority, entityType, search, pagination), so
// there's no need for this client to also call POST /screening/evaluate.
export function getScreeningCandidates(params = {}) {
  const query = buildQuery(params)
  return fetchApiEnvelope(`/api/screening/candidates${query ? `?${query}` : ''}`)
}

export function getScreeningRules() {
  return fetchApiEnvelope('/api/screening/rules')
}
