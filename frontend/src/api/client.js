import { auth } from '../firebase'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

export async function authorizedFetch(path, options = {}) {
  const token = auth?.currentUser ? await auth.currentUser.getIdToken() : null

  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  return fetch(`${API_BASE_URL}${path}`, { ...options, headers })
}

function isGetRequest(options) {
  return !options?.method || options.method.toUpperCase() === 'GET'
}

// React StrictMode intentionally double-invokes effects in development, which
// fires the same GET twice back-to-back before either resolves. Sharing the
// in-flight promise (keyed per calling function, since fetchJson and
// fetchJsonOrNull treat the same status codes differently) collapses those
// duplicate calls into a single network request without changing what any
// individual caller receives.
const inFlightGetRequests = new Map()

export function dedupedGet(cacheKey, run) {
  const existing = inFlightGetRequests.get(cacheKey)
  if (existing) return existing

  const promise = run().finally(() => {
    inFlightGetRequests.delete(cacheKey)
  })

  inFlightGetRequests.set(cacheKey, promise)
  return promise
}

export async function fetchJson(path, options) {
  async function run() {
    const res = await authorizedFetch(path, options)
    if (!res.ok) throw new Error(`Failed to fetch ${path}`)
    return res.json()
  }

  if (isGetRequest(options)) {
    return dedupedGet(`fetchJson:${path}`, run)
  }

  return run()
}

export async function fetchJsonOrNull(path, options) {
  async function run() {
    const res = await authorizedFetch(path, options)
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Failed to fetch ${path}`)
    return res.json()
  }

  if (isGetRequest(options)) {
    return dedupedGet(`fetchJsonOrNull:${path}`, run)
  }

  return run()
}
