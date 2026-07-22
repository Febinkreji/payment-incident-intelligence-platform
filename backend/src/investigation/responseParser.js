const VALID_CONFIDENCE = ['LOW', 'MEDIUM', 'HIGH']

function tryParseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    // Real LLMs often wrap JSON in prose or a code fence — recover the
    // largest {...} block before giving up entirely.
    const match = typeof text === 'string' ? text.match(/\{[\s\S]*\}/) : null
    if (!match) return null
    try {
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }
}

// Never throws and never returns raw LLM text as the result — a malformed
// or non-JSON response degrades to a clearly-flagged (parseError: true)
// result instead of crashing the investigation.
function parseResponse(rawText, { incident }) {
  const parsed = tryParseJson(rawText)

  if (!parsed || typeof parsed !== 'object') {
    return {
      executiveSummary: 'The investigation response could not be parsed into a structured result.',
      probableRootCause: null,
      confidence: 'LOW',
      investigationSteps: [],
      recommendedActions: [],
      assumptions: ['Response parsing failed — output was not valid JSON and no JSON object could be recovered from it.'],
      parseError: true,
    }
  }

  return {
    executiveSummary: typeof parsed.executiveSummary === 'string' ? parsed.executiveSummary : 'No summary provided.',
    probableRootCause: typeof parsed.probableRootCause === 'string' ? parsed.probableRootCause : null,
    confidence: VALID_CONFIDENCE.includes(parsed.confidence) ? parsed.confidence : incident.confidence,
    investigationSteps: Array.isArray(parsed.investigationSteps) ? parsed.investigationSteps : [],
    recommendedActions: Array.isArray(parsed.recommendedActions) ? parsed.recommendedActions : [],
    assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
    parseError: false,
  }
}

module.exports = { parseResponse }
