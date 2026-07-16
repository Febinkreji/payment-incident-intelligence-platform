// Every function in this file is a PURE, IN-MEMORY derivation over the three
// documents IncidentDetails already fetches (incident, investigation,
// recommendation). Nothing here calls the network or Firestore — the richer
// UI built on top of these functions costs zero additional reads.
import { WORKFLOW_STAGES, STAGE_LABELS } from '../constants/workflow'

const ENGINEER_POOL = [
  'Alex Johnson', 'Priya Sharma', 'John Miller', 'Sarah Chen',
  'David Wilson', 'Mohammed Ali', 'Emily Brown',
]

export function hashString(value) {
  let hash = 0
  const str = String(value || '')
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  return hash
}

function seededInt(seed, min, max) {
  const range = max - min + 1
  return min + (hashString(seed) % range)
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

// ---------------------------------------------------------------------------
// Header derivations
// ---------------------------------------------------------------------------

export function deriveIncidentCommander(incident) {
  const idx = hashString(`${incident.id}-commander`) % ENGINEER_POOL.length
  const candidate = ENGINEER_POOL[idx]
  if (candidate === incident.owner) return ENGINEER_POOL[(idx + 1) % ENGINEER_POOL.length]
  return candidate
}

export function formatRelativeTime(iso) {
  if (!iso) return '—'
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'} ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function formatDurationFrom(iso) {
  if (!iso) return '—'
  const totalMinutes = Math.max(Math.floor((Date.now() - new Date(iso).getTime()) / 60000), 0)
  if (totalMinutes < 1) return 'less than a minute'
  if (totalMinutes < 60) return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours < 24) return `${hours}h ${minutes}m`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

// ---------------------------------------------------------------------------
// Workflow progress derivations
// ---------------------------------------------------------------------------

export function computeOverallProgress(status) {
  const idx = WORKFLOW_STAGES.indexOf(status)
  if (idx === -1) return 0
  return Math.round(((idx + 1) / WORKFLOW_STAGES.length) * 100)
}

// ---------------------------------------------------------------------------
// AI executive summary derivations
// ---------------------------------------------------------------------------

const RISK_BY_SEVERITY = { CRITICAL: 'HIGH', HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' }
const IMPACT_RANGE_BY_SEVERITY = {
  CRITICAL: [250, 600], HIGH: [100, 250], MEDIUM: [40, 120], LOW: [10, 40],
}
const STAGE_RECOVERY_BOOST = {
  OPEN: 0, TRIAGED: 2, INVESTIGATING: 4, MITIGATING: 8, MONITORING: 12, RESOLVED: 15, POSTMORTEM: 15,
}

export function deriveRiskLevel(severity) {
  return RISK_BY_SEVERITY[severity] || 'MEDIUM'
}

export function deriveRecoveryConfidence(aiConfidence, status) {
  const boost = STAGE_RECOVERY_BOOST[status] || 0
  return clamp(Math.round((aiConfidence || 50) * 0.8 + boost), 30, 99)
}

export function deriveBusinessImpact(incident) {
  const [min, max] = IMPACT_RANGE_BY_SEVERITY[incident.severity] || [20, 80]
  const pct = seededInt(`${incident.id}-impact-pct`, min, max)
  const psp = incident.psp ? ` via ${incident.psp}` : ''
  return `Payment authorization latency increased by ${pct}% for ${incident.service} transactions${psp}.`
}

export function deriveNextAction(recommendation, incident) {
  if (recommendation?.recommendedActions?.length) return recommendation.recommendedActions[0]
  if (incident?.status === 'RESOLVED') return 'Prepare postmortem review.'
  return 'Continue monitoring service health.'
}

// ---------------------------------------------------------------------------
// Evidence workspace — 7 real sources (backed by actual investigation data)
// plus additional synthesized sources for a richer investigation workspace.
// All synthesis is deterministic (seeded by incident id + source key), so the
// same incident always renders the same evidence on every view.
// ---------------------------------------------------------------------------

export const EVIDENCE_CATEGORIES = [
  'Application', 'Infrastructure', 'Data & Cache', 'Networking',
  'Payments', 'Observability', 'Deployment & Config', 'Security',
]

// key -> { label, category, unit, real (investigation field name, if backed by real data) }
export const EVIDENCE_CATALOG = [
  { key: 'grafanaMetrics', label: 'Grafana Metrics', category: 'Observability', real: 'grafanaMetrics', unit: '%' },
  { key: 'applicationLogs', label: 'Application Logs', category: 'Application', real: 'applicationLogs', unit: 'lines' },
  { key: 'infrastructureMetrics', label: 'Infrastructure Metrics', category: 'Infrastructure', real: 'infrastructureMetrics', unit: '%' },
  { key: 'database', label: 'Database', category: 'Data & Cache', real: 'database', unit: 'ms' },
  { key: 'kafka', label: 'Kafka', category: 'Data & Cache', real: 'kafka', unit: 'msgs' },
  { key: 'redis', label: 'Redis', category: 'Data & Cache', real: 'redis', unit: 'ms' },
  { key: 'pspResponse', label: 'PSP Response', category: 'Payments', real: 'pspResponse', unit: '%' },

  { key: 'apiGateway', label: 'API Gateway', category: 'Application', unit: '%' },
  { key: 'loadBalancer', label: 'Load Balancer', category: 'Application', unit: 'ms' },
  { key: 'ingressController', label: 'Ingress Controller', category: 'Application', unit: 'req/s' },
  { key: 'kubernetesPods', label: 'Kubernetes Pods', category: 'Infrastructure', unit: 'restarts' },
  { key: 'kubernetesEvents', label: 'Kubernetes Events', category: 'Infrastructure', unit: 'events' },
  { key: 'containerLogs', label: 'Container Logs', category: 'Infrastructure', unit: 'lines' },
  { key: 'nodeMetrics', label: 'Node Metrics', category: 'Infrastructure', unit: '%' },
  { key: 'memoryProfile', label: 'Memory Profile', category: 'Infrastructure', unit: '%' },
  { key: 'cpuProfile', label: 'CPU Profile', category: 'Infrastructure', unit: '%' },
  { key: 'threadDumps', label: 'Thread Dumps', category: 'Infrastructure', unit: 'threads' },
  { key: 'jvmMetrics', label: 'JVM Metrics', category: 'Infrastructure', unit: 'MB' },
  { key: 'gcMetrics', label: 'GC Metrics', category: 'Infrastructure', unit: 'ms' },
  { key: 'connectionPool', label: 'Connection Pool', category: 'Data & Cache', unit: '%' },
  { key: 'networkLatency', label: 'Network Latency', category: 'Networking', unit: 'ms' },
  { key: 'dnsResolution', label: 'DNS Resolution', category: 'Networking', unit: 'ms' },
  { key: 'tlsHandshake', label: 'TLS Handshake', category: 'Networking', unit: 'ms' },
  { key: 'certificateStatus', label: 'Certificate Status', category: 'Networking', unit: 'days left' },
  { key: 'serviceMesh', label: 'Service Mesh', category: 'Networking', unit: '%' },
  { key: 'otelTraces', label: 'OpenTelemetry Traces', category: 'Observability', unit: 'ms' },
  { key: 'distributedTracing', label: 'Distributed Tracing', category: 'Observability', unit: 'spans' },
  { key: 'paymentGatewayMetrics', label: 'Payment Gateway Metrics', category: 'Payments', unit: '%' },
  { key: 'acquirerResponse', label: 'Acquirer Response', category: 'Payments', unit: 'ms' },
  { key: 'issuerResponse', label: 'Issuer Response', category: 'Payments', unit: 'ms' },
  { key: 'visaNetwork', label: 'Visa Network', category: 'Payments', unit: '%' },
  { key: 'mastercardNetwork', label: 'Mastercard Network', category: 'Payments', unit: '%' },
  { key: 'tokenization', label: 'Tokenization', category: 'Payments', unit: 'ms' },
  { key: 'fraudEngine', label: 'Fraud Engine', category: 'Payments', unit: 'ms' },
  { key: 'riskEngine', label: 'Risk Engine', category: 'Payments', unit: 'ms' },
  { key: 'settlementEngine', label: 'Settlement Engine', category: 'Payments', unit: 'ms' },
  { key: 'reconciliationEngine', label: 'Reconciliation Engine', category: 'Payments', unit: '%' },
  { key: 'notificationService', label: 'Notification Service', category: 'Application', unit: 'ms' },
  { key: 'authenticationService', label: 'Authentication Service', category: 'Application', unit: 'ms' },
  { key: 'merchantApi', label: 'Merchant API', category: 'Application', unit: 'ms' },
  { key: 'authorizationApi', label: 'Authorization API', category: 'Payments', unit: 'ms' },
  { key: 'databaseReplication', label: 'Database Replication', category: 'Data & Cache', unit: 's lag' },
  { key: 'cacheHitRatio', label: 'Cache Hit Ratio', category: 'Data & Cache', unit: '%' },
  { key: 'queueDepth', label: 'Queue Depth', category: 'Data & Cache', unit: 'msgs' },
  { key: 'retryQueue', label: 'Retry Queue', category: 'Data & Cache', unit: 'msgs' },
  { key: 'deadLetterQueue', label: 'Dead Letter Queue', category: 'Data & Cache', unit: 'msgs' },
  { key: 'autoscalerEvents', label: 'Autoscaler Events', category: 'Infrastructure', unit: 'events' },
  { key: 'deploymentHistory', label: 'Deployment History', category: 'Deployment & Config', unit: 'deploys' },
  { key: 'recentReleases', label: 'Recent Releases', category: 'Deployment & Config', unit: 'releases' },
  { key: 'featureFlags', label: 'Feature Flags', category: 'Deployment & Config', unit: 'flags' },
  { key: 'configurationChanges', label: 'Configuration Changes', category: 'Deployment & Config', unit: 'changes' },
  { key: 'secretsRotation', label: 'Secrets Rotation', category: 'Deployment & Config', unit: 'days ago' },
  { key: 'firewallLogs', label: 'Firewall Logs', category: 'Security', unit: 'blocks' },
  { key: 'wafLogs', label: 'WAF Logs', category: 'Security', unit: 'blocks' },
  { key: 'cloudProviderMetrics', label: 'Cloud Provider Metrics', category: 'Infrastructure', unit: '%' },
  { key: 'diskIo', label: 'Disk I/O', category: 'Infrastructure', unit: 'MB/s' },
  { key: 'filesystemUsage', label: 'Filesystem Usage', category: 'Infrastructure', unit: '%' },
  { key: 'systemEvents', label: 'System Events', category: 'Infrastructure', unit: 'events' },
  { key: 'syntheticMonitoring', label: 'Synthetic Monitoring', category: 'Observability', unit: '%' },
  { key: 'healthChecks', label: 'Health Checks', category: 'Observability', unit: '%' },
  { key: 'externalDependencies', label: 'External Dependencies', category: 'Observability', unit: '%' },
]

// Root-cause keyword -> evidence categories/keys that should read as elevated.
// Exported so the Evidence Sources page can use the identical mapping when
// aggregating across a list of incidents (rather than one incident's own
// investigation), without duplicating this table.
export const CAUSE_FOCUS = [
  { match: /psp|issuer/i, keys: ['pspResponse', 'paymentGatewayMetrics', 'acquirerResponse', 'issuerResponse', 'visaNetwork', 'mastercardNetwork'] },
  { match: /database|sql|connection pool/i, keys: ['database', 'databaseReplication', 'connectionPool', 'cacheHitRatio'] },
  { match: /redis/i, keys: ['redis', 'cacheHitRatio'] },
  { match: /kafka/i, keys: ['kafka', 'queueDepth', 'retryQueue', 'deadLetterQueue'] },
  { match: /cpu|memory leak|high cpu/i, keys: ['cpuProfile', 'memoryProfile', 'nodeMetrics', 'gcMetrics', 'jvmMetrics'] },
  { match: /certificate|tls/i, keys: ['tlsHandshake', 'certificateStatus', 'secretsRotation'] },
  { match: /deployment/i, keys: ['deploymentHistory', 'recentReleases', 'configurationChanges'] },
  { match: /configuration/i, keys: ['configurationChanges', 'featureFlags', 'secretsRotation'] },
  { match: /dns/i, keys: ['dnsResolution', 'networkLatency'] },
  { match: /firewall/i, keys: ['firewallLogs', 'wafLogs', 'networkLatency'] },
  { match: /pod crash/i, keys: ['kubernetesPods', 'kubernetesEvents', 'containerLogs', 'autoscalerEvents'] },
  { match: /rate limit/i, keys: ['apiGateway', 'loadBalancer', 'riskEngine'] },
  { match: /network|packet loss/i, keys: ['networkLatency', 'dnsResolution', 'serviceMesh'] },
]

function focusKeysFor(incident, aiAnalysis) {
  const haystack = `${incident.rootCause || ''} ${aiAnalysis?.likelyRootCause || ''}`.toLowerCase()
  const focused = new Set()
  CAUSE_FOCUS.forEach(({ match, keys }) => {
    if (match.test(haystack)) keys.forEach((k) => focused.add(k))
  })
  // Always include the categories the real evidence naturally covers as a floor.
  if (focused.size === 0) ['infrastructureMetrics', 'applicationLogs', 'grafanaMetrics'].forEach((k) => focused.add(k))
  return focused
}

function buildSparkline(seed, isFocused, severity) {
  const points = 10
  const base = isFocused ? seededInt(seed, 55, 80) : seededInt(seed, 15, 35)
  const amplitude = isFocused ? (severity === 'CRITICAL' ? 30 : 18) : 8
  return Array.from({ length: points }, (_, i) => {
    const drift = isFocused ? (i / points) * amplitude : (seededInt(`${seed}-${i}`, -5, 5))
    const noise = seededInt(`${seed}-n${i}`, -6, 6)
    return clamp(Math.round(base + drift + noise), 0, 100)
  })
}

export function realLineText(line) {
  if (typeof line === 'string') return line
  if (line && typeof line === 'object' && 'label' in line) {
    return `${line.label}: ${line.value}${line.change ? ` (${line.change})` : ''}`
  }
  return String(line)
}

function realValueSummary(realData, unit) {
  if (!Array.isArray(realData) || realData.length === 0) return null
  if (unit === 'lines' || unit === 'msgs') return `${realData.length}`
  // Try to pull a leading numeric token out of the first line, e.g. "Write Latency (p95): 210ms (baseline 40ms)"
  const match = realLineText(realData[0]).match(/([\d.]+)\s*(ms|%|s)?/)
  return match ? `${match[1]}${match[2] || ''}` : String(realData.length)
}

export function synthesizeEvidence(incident, investigation) {
  const aiAnalysis = investigation?.aiAnalysis
  const focusKeys = focusKeysFor(incident, aiAnalysis)

  return EVIDENCE_CATALOG.map((source) => {
    const isFocused = focusKeys.has(source.key)
    const seed = `${incident.id}-${source.key}`
    const realData = source.real ? investigation?.[source.real] : null

    const severity = isFocused
      ? (incident.severity === 'CRITICAL' ? 'HIGH' : incident.severity === 'LOW' ? 'MEDIUM' : 'HIGH')
      : (seededInt(seed, 0, 9) === 0 ? 'MEDIUM' : 'LOW')
    const status = severity === 'HIGH' ? 'critical' : severity === 'MEDIUM' ? 'warning' : 'healthy'
    const contribution = isFocused ? (incident.severity === 'CRITICAL' ? 'High' : 'Medium') : (status === 'warning' ? 'Low' : 'None')
    const confidence = isFocused ? seededInt(`${seed}-conf`, 65, 96) : seededInt(`${seed}-conf`, 10, 45)
    const trend = isFocused ? (seededInt(`${seed}-trend`, 0, 1) === 0 ? 'increasing' : 'degrading') : 'stable'

    const normalLow = seededInt(`${seed}-lo`, 10, 40)
    const normalHigh = normalLow + seededInt(`${seed}-hi`, 15, 40)
    const currentValue = realData
      ? realValueSummary(realData, source.unit) || `${normalHigh + (isFocused ? seededInt(seed, 20, 90) : 0)}${source.unit}`
      : `${isFocused ? normalHigh + seededInt(seed, 15, 120) : seededInt(seed, normalLow, normalHigh)}${source.unit}`

    const observation = isFocused
      ? `${source.label} shows a measurable deviation consistent with the suspected root cause${incident.rootCause ? ` (${incident.rootCause.toLowerCase()})` : ''}.`
      : `${source.label} is within expected operating range for ${incident.service}.`

    return {
      key: source.key,
      label: source.label,
      category: source.category,
      status,
      currentValue,
      normalRange: `${normalLow}-${normalHigh}${source.unit}`,
      trend,
      sparkline: buildSparkline(seed, isFocused, incident.severity),
      severity,
      lastUpdated: incident.updatedAt,
      confidence,
      contribution,
      rootCauseLikelihood: deriveRootCauseLikelihood(contribution, confidence),
      observation,
      realLines: realData || null,
    }
  })
}

export function deriveRootCauseLikelihood(contribution, confidence) {
  if (contribution === 'High' && confidence >= 80) return 'Very Likely'
  if (contribution === 'High' || confidence >= 65) return 'Likely'
  if (contribution === 'Medium' || confidence >= 40) return 'Possible'
  return 'Unlikely'
}

// Highest-signal anomalies across ALL categories, regardless of which
// category tab is currently active — pure re-sort of the already-synthesized
// evidence array, no extra computation source.
export function derivePinnedAnomalies(evidencePanels, count = 3) {
  const weight = { High: 2, Medium: 1, Low: 0, None: -1 }
  return [...evidencePanels]
    .filter((panel) => panel.status !== 'healthy')
    .sort((a, b) => (weight[b.contribution] - weight[a.contribution]) || (b.confidence - a.confidence))
    .slice(0, count)
}

// ---------------------------------------------------------------------------
// Impact panel
// ---------------------------------------------------------------------------

const REVENUE_RANGE_BY_SEVERITY = {
  CRITICAL: [80000, 400000], HIGH: [20000, 90000], MEDIUM: [3000, 20000], LOW: [200, 3000],
}
const CUSTOMER_RANGE_BY_SEVERITY = {
  CRITICAL: [4000, 22000], HIGH: [800, 5000], MEDIUM: [100, 900], LOW: [5, 120],
}
const TXN_RANGE_BY_SEVERITY = {
  CRITICAL: [8000, 45000], HIGH: [1500, 9000], MEDIUM: [200, 1600], LOW: [10, 220],
}
const SUCCESS_DROP_BY_SEVERITY = { CRITICAL: [15, 45], HIGH: [6, 18], MEDIUM: [2, 8], LOW: [0.2, 2] }

export function deriveImpactMetrics(incident) {
  const severity = incident.severity
  const [revMin, revMax] = REVENUE_RANGE_BY_SEVERITY[severity] || REVENUE_RANGE_BY_SEVERITY.MEDIUM
  const [custMin, custMax] = CUSTOMER_RANGE_BY_SEVERITY[severity] || CUSTOMER_RANGE_BY_SEVERITY.MEDIUM
  const [txnMin, txnMax] = TXN_RANGE_BY_SEVERITY[severity] || TXN_RANGE_BY_SEVERITY.MEDIUM
  const [dropMin, dropMax] = SUCCESS_DROP_BY_SEVERITY[severity] || SUCCESS_DROP_BY_SEVERITY.MEDIUM

  const revenueAtRisk = seededInt(`${incident.id}-revenue`, revMin, revMax)
  const customersImpacted = seededInt(`${incident.id}-customers`, custMin, custMax)
  const failedTransactions = seededInt(`${incident.id}-txns`, txnMin, txnMax)
  const dropTenths = seededInt(`${incident.id}-drop`, dropMin * 10, dropMax * 10)
  const successRate = clamp(98.6 - dropTenths / 10, 40, 99.9)

  return {
    revenueAtRisk,
    customersImpacted,
    failedTransactions,
    successRate,
    affectedMerchants: incident.merchant ? [incident.merchant] : [],
    affectedRegions: incident.region ? [incident.region] : [],
    pspsImpacted: incident.psp ? [incident.psp] : [],
    paymentMethodsImpacted: ['Card', 'Wallet'].slice(0, seededInt(`${incident.id}-pm`, 1, 2)),
  }
}

// ---------------------------------------------------------------------------
// Workflow action panel — escalation / SLA
// ---------------------------------------------------------------------------

const SLA_MINUTES_BY_SEVERITY = { CRITICAL: 30, HIGH: 120, MEDIUM: 480, LOW: 1440 }
const ESCALATION_BY_SEVERITY = { CRITICAL: 'L3 — Executive', HIGH: 'L2 — Senior On-Call', MEDIUM: 'L1 — On-Call', LOW: 'L0 — Team Queue' }

export function deriveEscalation(incident) {
  const slaMinutes = SLA_MINUTES_BY_SEVERITY[incident.severity] || 480
  const elapsedMinutes = Math.floor((Date.now() - new Date(incident.createdAt).getTime()) / 60000)
  const remaining = slaMinutes - elapsedMinutes
  const isTerminal = incident.status === 'RESOLVED' || incident.status === 'POSTMORTEM'

  return {
    level: ESCALATION_BY_SEVERITY[incident.severity] || 'L1 — On-Call',
    slaTargetMinutes: slaMinutes,
    timeRemainingMinutes: remaining,
    isBreached: !isTerminal && remaining < 0,
    approvalStatus: incident.owner ? 'Assigned' : 'Pending Assignment',
  }
}

// ---------------------------------------------------------------------------
// Unified activity timeline — merges investigation.timeline (pipeline events)
// with incident.workflowHistory (stage transitions) into one sorted feed.
// ---------------------------------------------------------------------------

const CATEGORY_BY_KEYWORD = [
  { match: /ai|root cause|correlation/i, category: 'AI' },
  { match: /deploy|release|rollback/i, category: 'Deployment' },
  { match: /database|sql|query/i, category: 'Database' },
  { match: /network|dns|tls|firewall/i, category: 'Network' },
  { match: /pod|kubernetes|infrastructure|cpu|memory/i, category: 'Infrastructure' },
  { match: /engineer|assigned|triaged|escalated/i, category: 'Engineer' },
]

function categorize(title, user) {
  for (const { match, category } of CATEGORY_BY_KEYWORD) {
    if (match.test(title)) return category
  }
  return user && user !== 'System' && !user.includes('AI') ? 'Engineer' : 'System'
}

function parseTimelineTime(event, incidentCreatedAt) {
  // investigation.timeline entries store only "HH:MM" — anchor them to the
  // incident's creation date so they can be merged/sorted with ISO timestamps.
  if (/^\d{2}:\d{2}$/.test(event.time)) {
    const base = new Date(incidentCreatedAt)
    const [h, m] = event.time.split(':').map(Number)
    base.setHours(h, m, 0, 0)
    return base.toISOString()
  }
  return event.time
}

export function buildActivityTimeline(incident, investigation) {
  const entries = []

  ;(investigation?.timeline || []).forEach((event) => {
    const time = parseTimelineTime(event, incident.createdAt)
    entries.push({
      time,
      user: event.title.toLowerCase().includes('ai') ? 'AI Engine' : 'System',
      action: event.title,
      description: event.description,
      category: categorize(event.title, 'System'),
    })
  })

  ;(incident.workflowHistory || []).forEach((event) => {
    entries.push({
      time: event.time,
      user: event.user,
      action: `Moved to ${STAGE_LABELS[event.stage] || event.stage}`,
      description: event.comment,
      category: categorize(event.comment, event.user),
    })
  })

  entries.sort((a, b) => new Date(a.time) - new Date(b.time))

  return entries.map((entry, index) => {
    const next = entries[index + 1]
    const durationMs = next ? new Date(next.time) - new Date(entry.time) : null
    return { ...entry, key: `${entry.time}-${index}`, durationMs }
  })
}

// ---------------------------------------------------------------------------
// Live incident feed — real workflow-derived events plus a light synthetic
// operational narrative, sorted newest first.
// ---------------------------------------------------------------------------

const SYNTHETIC_FEED_TEMPLATES = [
  'AI confidence updated',
  'Pod restarted',
  'Deployment health check passed',
  'PSP latency recovering',
  'Merchant notified',
]

export function buildLiveFeedEvents(incident, investigation) {
  const real = (incident.workflowHistory || []).map((event) => ({
    key: `wf-${event.time}`,
    time: event.time,
    text: `${event.comment}`,
    tone: 'engineer',
  }))

  if (investigation?.aiAnalysis) {
    real.push({
      key: 'ai-analysis',
      time: investigation.createdAt,
      text: `AI analysis generated — ${investigation.aiAnalysis.confidence}% confidence`,
      tone: 'ai',
    })
  }

  const stageStart = new Date(incident.currentStageStartedAt || incident.createdAt).getTime()
  const synthetic = SYNTHETIC_FEED_TEMPLATES
    .filter((_, i) => hashString(`${incident.id}-feed-${i}`) % 3 !== 0)
    .map((text, i) => ({
      key: `synthetic-${i}`,
      time: new Date(stageStart + seededInt(`${incident.id}-feedtime-${i}`, 1, 40) * 60000).toISOString(),
      text,
      tone: text.includes('AI') ? 'ai' : 'system',
    }))
    .filter((event) => new Date(event.time).getTime() <= Date.now())

  return [...real, ...synthetic].sort((a, b) => new Date(b.time) - new Date(a.time))
}

// ---------------------------------------------------------------------------
// AI correlation graph — a static, fixed-layout dependency diagram of the
// platform's core payment services. Node health/latency/errors are derived
// entirely from the already-loaded incident + investigation (service,
// rootCause, aiAnalysis.impactedComponents) — not fetched, not a live
// topology, purely a visual explanation of how the AI reached its conclusion.
// ---------------------------------------------------------------------------

export const CORRELATION_GRAPH_NODES = [
  { name: 'API Gateway', x: 60, y: 220 },
  { name: 'Checkout API', x: 230, y: 220 },
  { name: 'Payment Orchestrator', x: 410, y: 220 },
  { name: 'Risk Engine', x: 580, y: 30 },
  { name: 'Fraud Engine', x: 580, y: 100 },
  { name: 'Tokenization', x: 580, y: 170 },
  { name: 'Redis', x: 580, y: 240 },
  { name: 'Kafka', x: 580, y: 310 },
  { name: 'Database', x: 580, y: 380 },
  { name: 'Issuer Connector', x: 760, y: 80 },
  { name: 'PSP', x: 760, y: 340 },
  { name: 'Settlement', x: 900, y: 210 },
  { name: 'Notification', x: 1000, y: 210 },
]

export const CORRELATION_GRAPH_EDGES = [
  ['API Gateway', 'Checkout API'],
  ['Checkout API', 'Payment Orchestrator'],
  ['Payment Orchestrator', 'Risk Engine'],
  ['Payment Orchestrator', 'Fraud Engine'],
  ['Payment Orchestrator', 'Tokenization'],
  ['Payment Orchestrator', 'Redis'],
  ['Payment Orchestrator', 'Kafka'],
  ['Payment Orchestrator', 'Database'],
  ['Risk Engine', 'Issuer Connector'],
  ['Fraud Engine', 'Issuer Connector'],
  ['Payment Orchestrator', 'PSP'],
  ['Issuer Connector', 'Settlement'],
  ['PSP', 'Settlement'],
  ['Settlement', 'Notification'],
]

const SERVICE_TO_NODE = {
  'checkout-api': 'Checkout API',
  'payment-orchestrator': 'Payment Orchestrator',
  'issuer-connector': 'Issuer Connector',
  'acquirer-connector': 'PSP',
  'fraud-detection-service': 'Fraud Engine',
  'tokenization-service': 'Tokenization',
  'reporting-service': 'Settlement',
  'settlement-service': 'Settlement',
  'notification-service': 'Notification',
  'merchant-api': 'Checkout API',
  'auth-service': 'API Gateway',
  'risk-engine': 'Risk Engine',
  'routing-engine': 'Payment Orchestrator',
  'database-cluster': 'Database',
  'redis-cache': 'Redis',
}

const NODE_FOCUS = [
  { match: /psp|issuer/i, nodes: ['Issuer Connector', 'PSP', 'Settlement'] },
  { match: /database|sql|connection pool/i, nodes: ['Database', 'Payment Orchestrator'] },
  { match: /redis/i, nodes: ['Redis', 'Payment Orchestrator'] },
  { match: /kafka/i, nodes: ['Kafka', 'Notification'] },
  { match: /cpu|memory leak|high cpu/i, nodes: ['Payment Orchestrator', 'Checkout API'] },
  { match: /certificate|tls/i, nodes: ['API Gateway', 'PSP'] },
  { match: /deployment/i, nodes: ['Checkout API', 'Payment Orchestrator'] },
  { match: /configuration/i, nodes: ['Payment Orchestrator'] },
  { match: /dns|network|packet loss/i, nodes: ['API Gateway', 'Checkout API'] },
  { match: /firewall/i, nodes: ['API Gateway', 'Checkout API'] },
  { match: /pod crash/i, nodes: ['Payment Orchestrator', 'Checkout API'] },
  { match: /rate limit/i, nodes: ['API Gateway', 'Risk Engine'] },
]

export function buildCorrelationGraph(incident, investigation) {
  const aiAnalysis = investigation?.aiAnalysis
  const haystack = `${incident.rootCause || ''} ${aiAnalysis?.likelyRootCause || ''}`.toLowerCase()
  const primaryNode = SERVICE_TO_NODE[incident.service] || null

  const focusedNodes = new Set()
  if (primaryNode) focusedNodes.add(primaryNode)
  NODE_FOCUS.forEach(({ match, nodes }) => {
    if (match.test(haystack)) nodes.forEach((n) => focusedNodes.add(n))
  })

  const impactedComponents = (aiAnalysis?.impactedComponents || []).map((c) => c.toLowerCase())

  const nodes = CORRELATION_GRAPH_NODES.map((node) => {
    const seed = `${incident.id}-graph-${node.name}`
    const isPrimary = node.name === primaryNode
    const isFocused = focusedNodes.has(node.name)
    const looksImpacted = impactedComponents.some(
      (c) => node.name.toLowerCase().includes(c) || c.includes(node.name.toLowerCase())
    )

    let status = 'healthy'
    if (isPrimary || (isFocused && incident.severity === 'CRITICAL')) status = 'critical'
    else if (isFocused || looksImpacted) status = 'warning'

    const latencyMs =
      status === 'critical' ? seededInt(`${seed}-lat`, 300, 900)
      : status === 'warning' ? seededInt(`${seed}-lat`, 100, 300)
      : seededInt(`${seed}-lat`, 10, 60)
    const errorRate =
      status === 'critical' ? seededInt(`${seed}-err`, 8, 35)
      : status === 'warning' ? seededInt(`${seed}-err`, 2, 8)
      : seededInt(`${seed}-err`, 0, 1)
    const contribution = status === 'critical' ? 'High' : status === 'warning' ? 'Medium' : 'None'
    const confidence =
      status === 'critical' ? seededInt(`${seed}-conf`, 75, 96)
      : status === 'warning' ? seededInt(`${seed}-conf`, 40, 70)
      : seededInt(`${seed}-conf`, 5, 30)

    return { ...node, status, isRootCause: isPrimary, latencyMs, errorRate, contribution, confidence }
  })

  const nodeByName = Object.fromEntries(nodes.map((n) => [n.name, n]))

  const edges = CORRELATION_GRAPH_EDGES.map(([from, to]) => ({
    from,
    to,
    failed: nodeByName[from].status !== 'healthy' && nodeByName[to].status !== 'healthy',
  }))

  return { nodes, edges, rootCauseNode: primaryNode }
}
