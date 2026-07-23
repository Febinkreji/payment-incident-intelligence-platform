// Human-readable narration of a priority/confidence tier the BACKEND already
// computed — this only describes already-known facts (how many rules
// matched, which ones), it never re-derives the tier itself. The exact
// escalation thresholds and which rules act as a "ceiling" are backend
// business logic (priorityConfig.js/confidenceConfig.js) and deliberately
// stay there; duplicating that table here to produce a more specific
// sentence would be exactly the kind of frontend logic duplication this
// feature is meant to avoid.
export function explainPriority(candidate) {
  const { matchedRules, priority } = candidate
  if (matchedRules.length === 1) {
    return `${priority} priority, based on a single matched rule: "${matchedRules[0].ruleName}".`
  }
  return `${priority} priority, reflecting ${matchedRules.length} independent matched rules (${matchedRules
    .map((r) => r.ruleName)
    .join(', ')}) — multiple rules matching the same entity is treated as a stronger signal.`
}

export function explainConfidence(candidate) {
  const { matchedRules, confidence } = candidate
  if (matchedRules.length === 1) {
    return `${confidence} confidence, based on the evidentiary strength of "${matchedRules[0].ruleName}" alone.`
  }
  return `${confidence} confidence — corroborated by ${matchedRules.length} independent rules, which strengthens confidence beyond any single rule's own evidence.`
}
