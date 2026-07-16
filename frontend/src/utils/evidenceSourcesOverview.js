import { EVIDENCE_CATALOG, EVIDENCE_CATEGORIES, CAUSE_FOCUS, hashString } from './incidentAnalytics'

const OPEN_STATUSES = new Set(['OPEN', 'TRIAGED', 'INVESTIGATING', 'MITIGATING', 'MONITORING'])

function localSeededInt(seed, min, max) {
  const hash = hashString(seed)
  return min + (hash % (max - min + 1))
}

function keysForIncident(incident) {
  const haystack = `${incident.rootCause || ''} ${incident.title || ''} ${incident.description || ''}`.toLowerCase()
  const keys = new Set()
  CAUSE_FOCUS.forEach(({ match, keys: matchedKeys }) => {
    if (match.test(haystack)) matchedKeys.forEach((key) => keys.add(key))
  })
  return keys
}

// Read-only, aggregate view over the already-fetched incident list — the
// same list the Incident Management / Executive Dashboard pages already
// fetch via GET /incidents. No investigation documents are read here (that
// would be one extra request per incident); instead this reuses the exact
// keyword→evidence-key mapping (CAUSE_FOCUS) that the per-incident Evidence
// Workspace uses, applied to each incident's own `rootCause`/title/description.
export function buildEvidenceSourcesOverview(incidents) {
  const openIncidents = incidents.filter((incident) => OPEN_STATUSES.has(incident.status))
  const incidentKeyMap = openIncidents.map((incident) => ({ incident, keys: keysForIncident(incident) }))

  return EVIDENCE_CATALOG.map((source) => {
    const related = incidentKeyMap
      .filter(({ keys }) => keys.has(source.key))
      .map(({ incident }) => incident)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    const hasCritical = related.some((incident) => incident.severity === 'CRITICAL')
    const status = related.length === 0 ? 'healthy' : hasCritical ? 'critical' : 'warning'
    const contribution =
      related.length === 0 ? 'None' : hasCritical ? 'High' : related.length > 1 ? 'Medium' : 'Low'
    const confidence = related.length === 0 ? 0 : 55 + localSeededInt(`${source.key}-confidence`, 0, 40)

    const sparkline = Array.from({ length: 10 }, (_, index) => {
      const base = related.length > 0 ? 55 : 20
      const noise = localSeededInt(`${source.key}-spark-${index}`, -10, 10)
      const drift = related.length > 0 ? index * 3 : 0
      return Math.max(0, Math.min(100, base + noise + drift))
    })

    return {
      ...source,
      status,
      anomalyCount: related.length,
      contribution,
      confidence,
      sparkline,
      relatedIncidents: related.slice(0, 5),
    }
  })
}

export function groupEvidenceByCategory(sources) {
  return EVIDENCE_CATEGORIES.map((category) => ({
    category,
    sources: sources.filter((source) => source.category === category),
  })).filter((group) => group.sources.length > 0)
}

export function buildEvidenceAiSummary(source) {
  if (source.anomalyCount === 0) {
    return `${source.label} is healthy with no correlated incidents in the current window.`
  }
  return `${source.label} is correlated with ${source.anomalyCount} open incident${
    source.anomalyCount === 1 ? '' : 's'
  } (${source.contribution.toLowerCase()} contribution, ${source.confidence}% confidence). ${
    source.relatedIncidents[0] ? `Most recent: ${source.relatedIncidents[0].title}.` : ''
  }`
}
