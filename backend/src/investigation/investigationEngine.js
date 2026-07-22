const crypto = require('crypto')
const { buildPrompt } = require('./promptBuilder')
const { parseResponse } = require('./responseParser')
const { createInvestigation, createNoInvestigationNeeded } = require('./investigationModels')
const { getProvider } = require('./providers/llmProvider')

require('./providers/mockProvider') // registers the 'mock' provider

const DEFAULT_PROVIDER = 'mock'

// Consumes ONLY an Incident object from Sprint 5 — never touches Postgres,
// never runs SQL, never reads a CSV. Swapping `options.provider` to a real
// provider later is the only thing that changes; everything else here stays
// the same.
//
// Sprint 9D.5: `options.siblingIncidents` (all incidents detected on the same
// correlation, threaded in by investigateAll below) lets the prompt and mock
// response reference "Detected Incidents" plural — still zero new queries,
// since incidentEngine.detectIncidents() already returned that full array to
// whichever controller called investigateAll().
async function investigate(incident, options = {}) {
  if (!incident) {
    throw new Error('investigate requires an Incident object produced by the Incident Detection Engine')
  }

  const investigationId = crypto.randomUUID()

  if (!incident.incidentDetected) {
    return createNoInvestigationNeeded({ investigationId, incident })
  }

  const siblingIncidents = options.siblingIncidents || []
  const provider = getProvider(options.provider || DEFAULT_PROVIDER)
  const prompt = buildPrompt(incident, siblingIncidents)
  const rawResponse = await provider.generate(prompt, { incident, siblingIncidents })
  const parsed = parseResponse(rawResponse, { incident })

  return createInvestigation({
    investigationId,
    incidentId: incident.incidentId,
    parsed,
    evidenceUsed: (incident.evidence || []).map((e) => e.note),
    missingEvidence: incident.missingEvidence || [],
  })
}

async function investigateAll(incidents, options = {}) {
  const results = []
  for (const incident of incidents) {
    results.push(await investigate(incident, { ...options, siblingIncidents: incidents }))
  }
  return results
}

module.exports = { investigate, investigateAll }
