const engine = require('../../screening/screeningEngine')
const { resolveWindow, WINDOW_PRESETS, WINDOW_LABELS } = require('../../screening/timeWindow')
const { PRIORITY, ENTITY_TYPE } = require('../../screening/screeningModels')
const { DEFAULT_CANDIDATE_LIMIT } = require('../../screening/screeningConfig')
const { ValidationError } = require('../../shared/errors')
const { success } = require('../response/apiResponse')

const VALID_PRESETS = new Set([...Object.keys(WINDOW_PRESETS), 'today'])
const VALID_PRIORITIES = new Set(Object.values(PRIORITY))
const VALID_ENTITY_TYPES = new Set(Object.values(ENTITY_TYPE))
const RULE_IDS = new Set(engine.listRules().map((r) => r.id))

// Public pagination over the FINAL candidate list — distinct from
// perRuleLimit below, which bounds how many rows EACH rule's own repository
// query fetches (a Data Selection Layer concern, Stage 1). Conflating the
// two would mean a caller asking for "page 2 of candidates" accidentally
// changing how much raw data the engine scans per rule.
const DEFAULT_PAGE_LIMIT = 50
const MAX_PAGE_LIMIT = 200

function parseWindow(source) {
  const { preset, from, to } = source

  if (from || to) {
    if (!from || !to) throw new ValidationError('from and to must both be provided together for a custom range')
    const fromDate = new Date(from)
    const toDate = new Date(to)
    if (Number.isNaN(fromDate.getTime())) throw new ValidationError('from must be a valid ISO date')
    if (Number.isNaN(toDate.getTime())) throw new ValidationError('to must be a valid ISO date')
    if (fromDate >= toDate) throw new ValidationError('from must be earlier than to')
    return resolveWindow({ from: fromDate, to: toDate })
  }

  if (preset !== undefined && !VALID_PRESETS.has(preset)) {
    throw new ValidationError(`preset must be one of: ${[...VALID_PRESETS].join(', ')}`)
  }

  return resolveWindow({ preset })
}

function parseRuleIds(source) {
  if (source.ruleIds === undefined) return undefined
  const ids = Array.isArray(source.ruleIds) ? source.ruleIds : String(source.ruleIds).split(',').map((s) => s.trim())

  const unknown = ids.filter((id) => !RULE_IDS.has(id))
  if (unknown.length > 0) {
    throw new ValidationError(`Unknown rule id(s): ${unknown.join(', ')}. Valid ids: ${[...RULE_IDS].join(', ')}`)
  }
  return ids
}

function parsePriorityFilter(source) {
  if (source.priority === undefined) return undefined
  if (!VALID_PRIORITIES.has(source.priority)) {
    throw new ValidationError(`priority must be one of: ${[...VALID_PRIORITIES].join(', ')}`)
  }
  return source.priority
}

function parseEntityTypeFilter(source) {
  if (source.entityType === undefined) return undefined
  if (!VALID_ENTITY_TYPES.has(source.entityType)) {
    throw new ValidationError(`entityType must be one of: ${[...VALID_ENTITY_TYPES].join(', ')}`)
  }
  return source.entityType
}

// Free-text search across entityId, matched rule names, and reason —
// case-insensitive substring match, applied post-evaluation over the
// already-built candidate list (the same presentation-layer filtering
// pattern as priority/entityType above, not a new query).
function parseSearchFilter(source) {
  if (source.search === undefined) return undefined
  const trimmed = String(source.search).trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function matchesSearch(candidate, needle) {
  const haystack = [candidate.entityId, candidate.reason, ...candidate.matchedRules.map((r) => r.ruleName)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle.toLowerCase())
}

function parsePagination(source) {
  const rawLimit = parseInt(source.limit, 10)
  const rawOffset = parseInt(source.offset, 10)

  if (source.limit !== undefined && Number.isNaN(rawLimit)) throw new ValidationError('limit must be a number')
  if (source.offset !== undefined && Number.isNaN(rawOffset)) throw new ValidationError('offset must be a number')

  return {
    limit: Math.min(MAX_PAGE_LIMIT, Math.max(1, rawLimit || DEFAULT_PAGE_LIMIT)),
    offset: Math.max(0, rawOffset || 0),
  }
}

function parsePerRuleLimit(source) {
  if (source.perRuleLimit === undefined) return DEFAULT_CANDIDATE_LIMIT
  const value = parseInt(source.perRuleLimit, 10)
  if (Number.isNaN(value) || value < 1) throw new ValidationError('perRuleLimit must be a positive number')
  return value
}

// Shared by GET /screening/candidates (query string) and
// POST /screening/evaluate (JSON body) — same parameters, same validation,
// same response shape; the only difference is where the parameters come
// from. Keeping one implementation means the two endpoints can never quietly
// drift into different behavior for the same inputs.
async function runScreening(req, res, next, source) {
  try {
    const window = parseWindow(source)
    const ruleIds = parseRuleIds(source)
    const priorityFilter = parsePriorityFilter(source)
    const entityTypeFilter = parseEntityTypeFilter(source)
    const searchFilter = parseSearchFilter(source)
    const pagination = parsePagination(source)
    const perRuleLimit = parsePerRuleLimit(source)

    const { candidates, metadata } = await engine.evaluate({ window, ruleIds, limit: perRuleLimit })

    let filtered = candidates
    if (priorityFilter) filtered = filtered.filter((c) => c.priority === priorityFilter)
    if (entityTypeFilter) filtered = filtered.filter((c) => c.entityType === entityTypeFilter)
    if (searchFilter) filtered = filtered.filter((c) => matchesSearch(c, searchFilter))

    const page = filtered.slice(pagination.offset, pagination.offset + pagination.limit)

    return success(res, {
      candidates: page,
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset,
        total: filtered.length,
        hasMore: pagination.offset + page.length < filtered.length,
      },
      screening: metadata,
    })
  } catch (err) {
    next(err)
  }
}

async function getCandidates(req, res, next) {
  return runScreening(req, res, next, req.query)
}

async function evaluateScreening(req, res, next) {
  return runScreening(req, res, next, req.body || {})
}

function getRules(req, res) {
  return success(res, { rules: engine.listRules(), windowPresets: WINDOW_LABELS })
}

module.exports = { getCandidates, evaluateScreening, getRules }
