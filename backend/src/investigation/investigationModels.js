function createInvestigation({ investigationId, incidentId, parsed, evidenceUsed, missingEvidence }) {
  return {
    investigationId,
    incidentId,
    executiveSummary: parsed.executiveSummary,
    probableRootCause: parsed.probableRootCause,
    confidence: parsed.confidence,
    evidenceUsed,
    missingEvidence,
    investigationSteps: parsed.investigationSteps,
    recommendedActions: parsed.recommendedActions,
    assumptions: parsed.assumptions,
    parseError: parsed.parseError || false,
    generatedAt: new Date().toISOString(),
  }
}

// Returned when incident.incidentDetected === false — no provider call is
// made, since there's nothing to investigate and a real LLM call would just
// burn tokens confirming that.
function createNoInvestigationNeeded({ investigationId, incident }) {
  return {
    investigationId,
    incidentId: incident.incidentId,
    executiveSummary: 'No incident was detected for this correlation — there is nothing to investigate.',
    probableRootCause: null,
    confidence: null,
    evidenceUsed: [],
    missingEvidence: incident.missingEvidence || [],
    investigationSteps: [],
    recommendedActions: [],
    assumptions: [],
    parseError: false,
    generatedAt: new Date().toISOString(),
  }
}

module.exports = { createInvestigation, createNoInvestigationNeeded }
