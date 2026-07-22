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
async function investigate(incident, options = {}) {
  if (!incident) {
    throw new Error('investigate requires an Incident object produced by the Incident Detection Engine')
  }

  const investigationId = crypto.randomUUID()

  if (!incident.incidentDetected) {
    return createNoInvestigationNeeded({ investigationId, incident })
  }

  const provider = getProvider(options.provider || DEFAULT_PROVIDER)
  const prompt = buildPrompt(incident)
  const rawResponse = await provider.generate(prompt, { incident })
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
    results.push(await investigate(incident, options))
  }
  return results
}

module.exports = { investigate, investigateAll }
