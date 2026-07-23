const rules = require('./screeningRules')
const repository = require('./screeningRepository')
const { resolvePriority, compareCandidates } = require('./priorityConfig')
const { resolveConfidence } = require('./confidenceConfig')
const { createCandidate, PRIORITY } = require('./screeningModels')
const { DEFAULT_CANDIDATE_LIMIT } = require('./screeningConfig')

// The ONLY place that maps a rule's declared dataSourceKey to an actual Data
// Selection Layer function. This is a lookup table, not branching logic —
// adding a rule that reuses an existing key requires no change here at all;
// a rule needing a genuinely new query requires one new repository function
// plus one new line here, which is a Data Selection Layer addition, not a
// change to how the engine evaluates/merges/prioritizes.
const DATA_SOURCES = {
  paymentsByStatus: repository.getPaymentsByStatus,
  serverErrorApiLogs: repository.getServerErrorApiLogs,
  apiTimeoutLogs: repository.getApiTimeoutLogs,
  slowApiLogs: repository.getSlowApiLogs,
  apiRetryGroups: repository.getApiRetryGroups,
  highValuePayments: repository.getHighValuePayments,
  duplicateTransactions: repository.getDuplicateTransactionPayments,
  multiPaymentOrders: repository.getMultiPaymentOrders,
  terminalHeartbeats: repository.getTerminalLastHeartbeat,
}

function activeRules(ruleIds) {
  return rules.filter((rule) => {
    if (rule.defaultEnabled === false) return false
    if (ruleIds && ruleIds.length > 0) return ruleIds.includes(rule.id)
    return true
  })
}

// Runs one rule end to end: resolve its declared data source, fetch rows,
// hand them to the rule's own pure evaluate(), tag each match with the rule
// that produced it. The rule itself never sees the repository, the window
// object, or any other rule — it only ever sees rows and returns matches.
// Also captures lightweight per-rule execution metrics (rows fetched, matches
// found, wall time) — cheap to record here since the engine already touches
// every one of these numbers, and it's the one place that can attribute
// timing to a specific rule/data-source pair for future tuning.
async function runRule(rule, window, limit, now) {
  const fetchRows = DATA_SOURCES[rule.dataSourceKey]
  if (!fetchRows) {
    throw new Error(`Screening rule "${rule.id}" declares unknown dataSourceKey "${rule.dataSourceKey}"`)
  }

  const startedAt = Date.now()
  const params = { ...rule.buildParams(window), from: window.from, to: window.to, limit }
  const rows = await fetchRows(params)
  const matches = rule.evaluate(rows, { now })
  const durationMs = Date.now() - startedAt

  return {
    matches: matches.map((match) => ({
      ...match,
      entityType: match.entityType || rule.entityType,
      ruleId: rule.id,
      ruleName: rule.displayName,
    })),
    metrics: {
      ruleId: rule.id,
      ruleName: rule.displayName,
      rowsEvaluated: rows.length,
      matchesFound: matches.length,
      durationMs,
    },
  }
}

// Merges every rule's matches into one candidate per distinct entity,
// resolves the final priority AND confidence via their centralized
// resolvers, and appends the two pieces of screening-level (not rule-level)
// context: which time window was used and when the evaluation ran. This is
// the only place any of that happens — no rule file computes its own
// priority, confidence, or window label.
function buildCandidates(matchGroups, window, now) {
  const byEntity = new Map()

  for (const matches of matchGroups) {
    for (const match of matches) {
      const key = `${match.entityType}:${match.entityId}`
      if (!byEntity.has(key)) byEntity.set(key, [])
      byEntity.get(key).push(match)
    }
  }

  const candidates = [...byEntity.values()].map((matches) => {
    const matchedRules = matches.map((m) => ({ ruleId: m.ruleId, ruleName: m.ruleName }))
    const ruleIds = matchedRules.map((r) => r.ruleId)
    const priority = resolvePriority(ruleIds)
    const confidence = resolveConfidence(ruleIds)
    const reason = matches.map((m) => m.reason).join(' ')
    const evidence = [
      ...matches.flatMap((m) => m.evidence),
      { label: 'Time Window', value: window.label },
      { label: 'Rule Evaluation Timestamp', value: now.toISOString() },
    ]

    return createCandidate({
      entityType: matches[0].entityType,
      entityId: matches[0].entityId,
      matchedRules,
      priority,
      confidence,
      reason,
      evidence,
      windowLabel: window.label,
      entityTimestamp: matches[0].entityTimestamp,
      recommendedNextAction: matches[0].recommendedNextAction,
    })
  })

  candidates.sort(compareCandidates)
  return candidates
}

// Public entry point. `window` is a resolved {from, to, label} from
// timeWindow.js — this function never computes "now" for the window itself,
// only for stamping when evaluation ran, so the caller stays in control of
// what "the monitoring window" means.
//
// Returns { candidates, metadata } rather than a bare array — screening is
// meant to be an operationally observable process, not a black box, so every
// call reports how much it looked at and how long it took alongside what it
// found. `entitiesEvaluated` is the sum of rows fetched across every rule
// (NOT deduplicated — an entity matched by two rules is counted once per
// rule, reflecting actual scan volume); `candidatesGenerated` is the
// deduplicated, post-merge count, i.e. candidates.length.
async function evaluate({ window, ruleIds, limit = DEFAULT_CANDIDATE_LIMIT }) {
  const evaluationStartedAt = Date.now()
  const now = new Date()
  const rulesToRun = activeRules(ruleIds)

  const results = await Promise.all(rulesToRun.map((rule) => runRule(rule, window, limit, now)))
  const matchGroups = results.map((r) => r.matches)
  const ruleMetrics = results.map((r) => r.metrics)

  const candidates = buildCandidates(matchGroups, window, now)
  const entitiesEvaluated = ruleMetrics.reduce((sum, m) => sum + m.rowsEvaluated, 0)

  // Priority breakdown for the dashboard's summary cards — a plain reduce
  // over candidates the engine already built, not a new query or a rule/
  // engine logic change. Computed here (not in the controller or frontend)
  // so it always reflects the true result of THIS window/ruleIds evaluation,
  // independent of any presentation-layer priority/entityType/search filter
  // applied afterward in screeningController.js.
  const priorityBreakdown = Object.fromEntries(
    Object.values(PRIORITY).map((tier) => [tier, candidates.filter((c) => c.priority === tier).length])
  )

  return {
    candidates,
    metadata: {
      window: { from: window.from.toISOString(), to: window.to.toISOString(), label: window.label },
      rulesExecuted: rulesToRun.length,
      entitiesEvaluated,
      candidatesGenerated: candidates.length,
      priorityBreakdown,
      evaluationTimeMs: Date.now() - evaluationStartedAt,
      generatedAt: now.toISOString(),
      ruleMetrics,
    },
  }
}

// Rule introspection for GET /screening/rules (Stage 3) — deliberately
// strips buildParams/evaluate/dataSourceKey so the API never exposes
// implementation internals, only what a future rule-configuration UI needs.
function listRules() {
  return rules.map((rule) => ({
    id: rule.id,
    displayName: rule.displayName,
    description: rule.description,
    entityType: rule.entityType,
    version: rule.version,
    defaultEnabled: rule.defaultEnabled,
    configurableParams: rule.configurableParams,
  }))
}

module.exports = { evaluate, listRules }
