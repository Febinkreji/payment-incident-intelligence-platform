function createInvestigation({ investigationId, incidentId, parsed, evidenceUsed, missingEvidence }) {
  return {
    investigationId,
    incidentId,
    executiveSummary: parsed.executiveSummary,
    // Sprint 9D.5: rule-aware investigation structure — detectedIncidents
    // (this incident plus any siblings on the same correlation),
    // alternativeExplanations, and businessImpact are new, additive fields;
    // everything below them is unchanged from Sprint 6.
    detectedIncidents: parsed.detectedIncidents,
    probableRootCause: parsed.probableRootCause,
    alternativeExplanations: parsed.alternativeExplanations,
    businessImpact: parsed.businessImpact,
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
    detectedIncidents: [],
    probableRootCause: null,
    alternativeExplanations: [],
    businessImpact: null,
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
