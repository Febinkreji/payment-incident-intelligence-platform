import { authorizedFetch, dedupedGet } from './client'

// The Sprint 7 REST API wraps every response as {success, data} or
// {success:false, error:{code, message}} — this unwraps that envelope and
// throws an Error carrying the server's actual code/message, instead of the
// generic "Failed to fetch" the older fetchJson/fetchJsonOrNull produce.
// Reuses authorizedFetch/dedupedGet from the existing client rather than
// duplicating the auth-header or in-flight-request-dedup logic.
export async function fetchApiEnvelope(path) {
  async function run() {
    const res = await authorizedFetch(path)

    if (res.status === 404) return null

    let body = null
    try {
      body = await res.json()
    } catch {
      body = null
    }

    if (!res.ok || !body?.success) {
      const message = body?.error?.message || `Request to ${path} failed with status ${res.status}`
      const error = new Error(message)
      error.code = body?.error?.code || 'REQUEST_FAILED'
      error.status = res.status
      throw error
    }

    return body.data
  }

  return dedupedGet(`fetchApiEnvelope:${path}`, run)
}
