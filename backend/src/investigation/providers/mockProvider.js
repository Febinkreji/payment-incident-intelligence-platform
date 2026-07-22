const { registerProvider } = require('./llmProvider')
const templates = require('../templates')

// No external AI is called here or anywhere in Sprint 6. This deterministically
// fabricates a plausible response from the SAME evidence promptBuilder used to
// build the prompt, so the rest of the pipeline (response parsing, the
// Investigation model) can be exercised end-to-end.
//
// A real provider implementation would only ever receive `prompt` (a plain
// string) — this mock is additionally handed `options.incident` purely as a
// convenience so its canned response can reference real field values (e.g.
// the actual payment_id) instead of being pure boilerplate. That's a mock-only
// affordance, not part of the provider contract itself.
async function generate(prompt, options = {}) {
  const { incident, siblingIncidents } = options
  const template = (incident && templates[incident.incidentType]) || templates.DEFAULT
  return template.buildMockResponse(incident, siblingIncidents || [])
}

registerProvider('mock', { generate })

module.exports = { generate }
