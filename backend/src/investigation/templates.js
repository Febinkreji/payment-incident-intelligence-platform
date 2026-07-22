// One entry per incident type. Adding a new incident type later means
// adding one new key here — investigationEngine.js never changes, it just
// looks up `templates[incident.incidentType] || templates.DEFAULT`.
//
// buildMockResponse() is only used by the mock provider (no real LLM
// integration exists in this codebase yet) — it fabricates a plausible,
// evidence-grounded JSON response so the rest of the pipeline (response
// parsing, the Investigation model) can be exercised end-to-end without ever
// inventing evidence beyond what the incident itself already contains.
//
// Sprint 9D.5: every template now produces the fuller, rule-aware structure
// (detectedIncidents, alternativeExplanations, businessImpact) via the
// shared buildResponse() helper below, sourced from evidenceSummary.js so
// the mock's output and promptBuilder's prompt never disagree about what
// the evidence says.
const {
  summarizeApiLogEvidence,
  summarizePaymentEventEvidence,
  summarizePaymentAggregate,
  summarizeSiblingIncidents,
} = require('./evidenceSummary')

function evidenceCount(incident) {
  return incident.evidence?.length || 0
}

// Sprint 9C.3: an incident's evidence can now include 'payment_event' entries
// (the failed payment's own lifecycle, added by paymentFailureRule) alongside
// the 'payment' aggregate entry — this pulls out the failure event's own
// status_message/terminal_message, when present, for a grounded root cause
// instead of always falling back to a generic hypothesis.
function findFailureMessage(incident) {
  const failureEvent = (incident.evidence || [])
    .filter((e) => e.type === 'payment_event')
    .map((e) => e.record)
    .find((r) => r?.status_message || r?.terminal_message)
  return failureEvent ? failureEvent.status_message || failureEvent.terminal_message : null
}

function apiEvidenceAssumption(incident) {
  return summarizeApiLogEvidence(incident).present
    ? null
    : 'No API log evidence was available for this incident, so gateway-side timing/retry behavior could not be assessed.'
}

// Shared assembly for every template — computes the parts that are the same
// shape everywhere (detectedIncidents, confidence fallback) and folds a note
// about sibling incidents into the executive summary, then lets each
// template supply its own rule-specific content for everything else.
function buildResponse(incident, siblingIncidents, {
  executiveSummary,
  probableRootCause,
  alternativeExplanations,
  businessImpact,
  investigationSteps,
  recommendedActions,
  assumptions,
}) {
  const siblings = summarizeSiblingIncidents(incident, siblingIncidents)
  const detectedIncidents = [
    { incidentType: incident.incidentType, ruleName: incident.ruleName || incident.incidentType, severity: incident.severity },
    ...siblings,
  ]
  const summaryWithSiblings = siblings.length > 0
    ? `${executiveSummary} ${siblings.length} additional incident(s) were also detected on this correlation: ${siblings.map((s) => s.incidentType).join(', ')}.`
    : executiveSummary

  return JSON.stringify({
    executiveSummary: summaryWithSiblings,
    detectedIncidents,
    probableRootCause,
    alternativeExplanations,
    businessImpact,
    confidence: incident.confidence,
    investigationSteps,
    recommendedActions,
    assumptions: assumptions.filter(Boolean),
  })
}

const PAYMENT_FAILURE = {
  investigationSteps: [
    "Check the payment gateway's decline/response code for this payment_id",
    'Check whether the same order had repeated failed payment attempts',
    'Check the payment gateway status page for concurrent outages',
  ],
  recommendedActions: [
    'Contact the payment gateway provider with the payment_id and timestamp',
    'Ask the customer to retry with a different payment method',
    'Check for a cluster of failures across other payments in the same time window',
  ],
  buildMockResponse(incident, siblingIncidents) {
    const failureMessage = findFailureMessage(incident)
    const aggregate = summarizePaymentAggregate(incident)
    const amountText = aggregate?.amount != null ? `${aggregate.amount} ${aggregate.currency || ''}`.trim() : 'an unknown amount'

    return buildResponse(incident, siblingIncidents, {
      executiveSummary: `Payment ${incident.affectedPayment || 'unknown'} reached status PAYMENT_FAILED (${evidenceCount(incident)} evidence record(s)).`,
      probableRootCause: failureMessage
        ? `The payment's own failure event reported: "${failureMessage}".`
        : 'Card declined by issuer, or a payment gateway timeout — the evidence confirms the failed status but not the underlying decline reason.',
      alternativeExplanations: failureMessage
        ? ['Given the payment event recorded an explicit decline reason, no equally plausible alternative stands out in the evidence gathered.']
        : ['Could also reflect a gateway timeout rather than an explicit decline — the evidence does not confirm which.'],
      businessImpact: `The customer's checkout for ${amountText} did not complete — this transaction was not captured and may need a retry or manual follow-up.`,
      investigationSteps: this.investigationSteps,
      recommendedActions: this.recommendedActions,
      assumptions: [
        failureMessage ? null : 'The specific gateway decline code was not present in the evidence, so the root cause is a hypothesis, not a confirmed fact.',
        apiEvidenceAssumption(incident),
      ],
    })
  },
}

const API_FAILURE = {
  investigationSteps: [
    'Check application logs for the exact request_id at the failure timestamp',
    'Check whether the 5xx responses are isolated or part of a wider outage window',
    'Check upstream/downstream service health for the same time range',
  ],
  recommendedActions: [
    'Page the on-call engineer for the affected API',
    'Check recent deployments around the failure timestamp',
    'Add/verify alerting on 5xx rate for this endpoint if not already present',
  ],
  buildMockResponse(incident, siblingIncidents) {
    return buildResponse(incident, siblingIncidents, {
      executiveSummary: `One or more API calls returned a server error (5xx) (${evidenceCount(incident)} evidence record(s)).`,
      probableRootCause: 'A server-side fault in the API handling this request — the specific cause (bug, dependency failure, resource exhaustion) is not determinable from status_code alone.',
      alternativeExplanations: ['The 5xx could originate in this service itself, or in a downstream dependency it calls — status_code alone does not distinguish between these.'],
      businessImpact: incident.affectedPayment || incident.affectedOrder
        ? `This affected payment ${incident.affectedPayment || '(none)'} / order ${incident.affectedOrder || '(none)'} directly — the underlying request may not have completed as expected.`
        : 'This request was not tied to a specific payment or order in the evidence gathered, so the direct customer impact could not be confirmed.',
      investigationSteps: this.investigationSteps,
      recommendedActions: this.recommendedActions,
      assumptions: ['Application-level logs beyond status_code were not part of the evidence provided.'],
    })
  },
}

const TERMINAL_ERROR = {
  investigationSteps: [
    'Check the terminal_events event_body payloads for an error code or message',
    "Check the terminal's connectivity/battery telemetry around the same time",
    'Check whether other terminals at the same store/merchant show similar errors',
  ],
  recommendedActions: [
    'Dispatch a remote diagnostic or firmware check to the affected terminal',
    'Contact the merchant if the terminal appears offline or unresponsive',
    'Escalate to the terminal hardware/firmware vendor if the pattern repeats',
  ],
  buildMockResponse(incident, siblingIncidents) {
    return buildResponse(incident, siblingIncidents, {
      executiveSummary: `Terminal ${incident.affectedTerminal || 'unknown'} reported multiple ERROR events (${evidenceCount(incident)} evidence record(s)).`,
      probableRootCause: 'A device-level fault (connectivity, firmware, or hardware) — the specific cause requires inspecting event_body payloads not included in this evidence set.',
      alternativeExplanations: ['Could be a connectivity issue between the terminal and the platform rather than a hardware/firmware fault on the device itself — event_body detail (not in this evidence) would be needed to distinguish these.'],
      businessImpact: `Terminal ${incident.affectedTerminal || 'unknown'} may be degraded — this can affect every transaction routed through it, not just the one being investigated.`,
      investigationSteps: this.investigationSteps,
      recommendedActions: this.recommendedActions,
      assumptions: ['event_body contents were not expanded in the evidence summaries, so the exact error code is unknown.'],
    })
  },
}

const PAYMENT_NOT_CREATED = {
  investigationSteps: [
    'Check whether the customer abandoned checkout before completing payment',
    'Check for a missed or failed payment-gateway webhook for this order_id',
    'Check api_logs for a payment-creation call tied to this order that may have failed silently',
  ],
  recommendedActions: [
    'Reconcile against the payment gateway directly using the order_id/reference',
    'If a webhook was missed, replay it or manually verify payment status with the gateway',
    'Flag for manual reconciliation if the order is old enough that this is unlikely to self-resolve',
  ],
  buildMockResponse(incident, siblingIncidents) {
    return buildResponse(incident, siblingIncidents, {
      executiveSummary: `Order(s) reached a resolved status but no linked payment record exists (${evidenceCount(incident)} evidence record(s)).`,
      probableRootCause: 'A payment webhook/callback was likely missed or failed, or the payment was processed out-of-band and never linked back to this order.',
      alternativeExplanations: ['Could also reflect the customer abandoning checkout before payment, rather than a missed webhook — the resolved order_status alone does not distinguish these.'],
      businessImpact: `Order ${incident.affectedOrder || 'unknown'} reached a resolved status with no linked payment — depending on the order_status, this may be a reconciliation risk (customer charged without a recorded payment) or simply an abandoned checkout.`,
      investigationSteps: this.investigationSteps,
      recommendedActions: this.recommendedActions,
      assumptions: [
        'This may also reflect a sampling gap in imported data rather than a real production incident — see correlation warnings.',
        apiEvidenceAssumption(incident),
      ],
    })
  },
}

const MISSING_API_ACTIVITY = {
  investigationSteps: [
    'Check whether this payment was created through a different, unlogged integration path',
    'Check api_logs ingestion pipeline health for gaps in the same time window',
    'Check whether the payment_id/order_id used for lookup matches the format api_logs actually stores',
  ],
  recommendedActions: [
    'Verify the api_logs ETL/import pipeline is not silently dropping records for this time range',
    'If the payment truly bypassed the API layer, document the alternate path it took',
    'Add monitoring for payments with zero associated api_logs going forward',
  ],
  buildMockResponse(incident, siblingIncidents) {
    return buildResponse(incident, siblingIncidents, {
      executiveSummary: `Payment ${incident.affectedPayment || 'unknown'} exists but has zero associated api_logs (${evidenceCount(incident)} evidence record(s)).`,
      probableRootCause: 'Either a logging/observability gap, or the payment was created through a path that does not emit api_logs entries.',
      alternativeExplanations: ['Either the api_logs pipeline has a genuine gap for this time range, or this payment used an integration path that never emits api_logs — the evidence gathered does not distinguish between these two.'],
      businessImpact: 'This gap limits visibility into how the payment was processed — it does not by itself mean the payment failed, only that gateway-side activity for it cannot currently be verified.',
      investigationSteps: this.investigationSteps,
      recommendedActions: this.recommendedActions,
      assumptions: ['Whether this is a logging gap vs. an alternate integration path cannot be determined from the evidence alone.'],
    })
  },
}

const REPEATED_PAYMENT_FAILURES = {
  investigationSteps: [
    'Check whether every failure shares the same status_message/decline reason (see Payment Event History)',
    'Check whether the customer changed payment method between attempts',
    'Check for a cluster of repeated failures across other payments in the same time window',
  ],
  recommendedActions: [
    'Contact the payment gateway/PSP with the payment_id and the timestamps of every failed attempt',
    'If every attempt shares the same decline reason, treat it as a confirmed, persistent issuer-side decline rather than a transient error',
    'Suggest the customer try a different payment method if repeated attempts on the same one keep failing',
  ],
  buildMockResponse(incident, siblingIncidents) {
    const paymentEvents = summarizePaymentEventEvidence(incident)
    const reasons = paymentEvents.present
      ? [...new Set(paymentEvents.transitions.filter((t) => t.status === 'PAYMENT_FAILED' && t.reason).map((t) => t.reason))]
      : []
    const sameReasonEveryTime = reasons.length === 1

    return buildResponse(incident, siblingIncidents, {
      executiveSummary: incident.description || `A payment in this correlation failed more than once (${evidenceCount(incident)} evidence record(s)).`,
      probableRootCause: sameReasonEveryTime
        ? `Every failed attempt reported the same reason: "${reasons[0]}" — a persistent, not transient, decline.`
        : 'Multiple failed attempts were recorded, but the evidence gathered does not confirm whether they share the same underlying cause.',
      alternativeExplanations: sameReasonEveryTime
        ? ['Given every attempt shares the same decline reason, an intermittent/transient cause is unlikely based on the evidence gathered.']
        : ['Could be the same underlying issue repeating, or several distinct issues coinciding — the reasons recorded in Payment Event History above did not all match.'],
      businessImpact: 'Repeated failed attempts before this was flagged suggest the customer may have been blocked from completing checkout, which can affect conversion and customer experience.',
      investigationSteps: this.investigationSteps,
      recommendedActions: this.recommendedActions,
      assumptions: [apiEvidenceAssumption(incident)],
    })
  },
}

const RETRY_STORM = {
  investigationSteps: [
    'Check whether the client is retrying without backoff (see API Log Activity for the exact timestamps)',
    'Check whether the endpoint itself is timing out and triggering automatic retries',
    'Check whether this pattern is isolated to this payment or affects others in the same window',
  ],
  recommendedActions: [
    'Add/verify client-side retry backoff for the affected endpoint',
    'Check the endpoint for a root cause that would explain repeated calls (timeout, transient error, slow dependency)',
    'Monitor for duplicate side effects if each retry may have been processed independently downstream',
  ],
  buildMockResponse(incident, siblingIncidents) {
    const apiSummary = summarizeApiLogEvidence(incident)
    const endpoint = apiSummary.present ? apiSummary.calls[0]?.endpoint : null

    return buildResponse(incident, siblingIncidents, {
      executiveSummary: incident.description || `Repeated calls to the same endpoint were detected for this payment (${evidenceCount(incident)} evidence record(s)).`,
      probableRootCause: endpoint
        ? `The client (or platform) made multiple calls to ${endpoint} in rapid succession — consistent with a retry loop rather than independent, unrelated requests.`
        : 'Multiple calls to the same endpoint were recorded in rapid succession, consistent with a retry loop.',
      alternativeExplanations: ['Could be legitimate client-side polling (e.g. checking order/payment status) rather than a failure-driven retry — the API Log Activity above shows the actual response codes, which distinguishes these.'],
      businessImpact: 'If each retry was processed independently downstream, this could produce duplicate side effects (e.g. duplicate adjustment/status calls) worth checking for.',
      investigationSteps: this.investigationSteps,
      recommendedActions: this.recommendedActions,
      assumptions: [apiSummary.present ? null : 'API log evidence was expected for this rule but none was present — unusual for a RETRY_STORM detection and worth double-checking.'],
    })
  },
}

const SLOW_API_RESPONSE = {
  investigationSteps: [
    'Check the affected endpoint for downstream (gateway/PSP) latency around these timestamps',
    'Check for resource contention (CPU, DB connections, queueing) on the affected service at this time',
    'Check whether slow responses are isolated to this payment or widespread across the same window',
  ],
  recommendedActions: [
    'Investigate the affected endpoint/service for latency root cause',
    'Check whether a downstream dependency (gateway/PSP) was degraded at this time',
    'Consider a client-side timeout/retry review if this latency is recurring',
  ],
  buildMockResponse(incident, siblingIncidents) {
    const apiSummary = summarizeApiLogEvidence(incident)
    const slowest = apiSummary.present
      ? apiSummary.calls.reduce((max, c) => (c.latencyMs > (max?.latencyMs || 0) ? c : max), null)
      : null

    return buildResponse(incident, siblingIncidents, {
      executiveSummary: incident.description || `One or more API calls for this payment responded unusually slowly (${evidenceCount(incident)} evidence record(s)).`,
      probableRootCause: slowest
        ? `The slowest recorded call (${slowest.endpoint || 'unknown endpoint'}) took ${slowest.latencyMs}ms — well beyond typical response times, though the evidence does not confirm which downstream component caused the delay.`
        : 'One or more calls took unusually long to respond, though the evidence does not confirm which component caused the delay.',
      alternativeExplanations: ['Slowness could originate in this service itself, or in a downstream dependency (e.g. PSP) it calls — latency alone does not distinguish these.'],
      businessImpact: 'Slow responses on this payment’s API calls may have contributed to a degraded checkout experience or triggered client-side timeouts/retries.',
      investigationSteps: this.investigationSteps,
      recommendedActions: this.recommendedActions,
      assumptions: [apiSummary.present ? null : 'API log evidence was expected for this rule but none was present — unusual for a SLOW_API_RESPONSE detection and worth double-checking.'],
    })
  },
}

const LONG_RUNNING_PAYMENT_JOURNEY = {
  investigationSteps: [
    'Check the Payment Event History above for a long gap between two specific transitions',
    'Check whether the customer was waiting on an action (e.g. 3DS/redirect confirmation)',
    'Check whether the gateway callback for the final status was delayed',
  ],
  recommendedActions: [
    'If stuck on a customer-facing step, consider a reminder/notification to the customer',
    'If stuck waiting on a gateway callback, check the gateway/PSP for delayed webhook delivery',
    'Flag for manual review if the payment is still not in a final state after this long',
  ],
  buildMockResponse(incident, siblingIncidents) {
    const paymentEvents = summarizePaymentEventEvidence(incident)

    return buildResponse(incident, siblingIncidents, {
      executiveSummary: incident.description || `A payment in this correlation took unusually long to reach a final status (${evidenceCount(incident)} evidence record(s)).`,
      probableRootCause: 'The payment took significantly longer than typical to reach a final status — the evidence confirms the duration but not which specific step caused the delay.',
      alternativeExplanations: ['Could reflect genuine customer-side delay (e.g. completing a redirect/3DS confirmation) rather than a system fault — the Payment Event History above shows where the largest gap between transitions occurred.'],
      businessImpact: 'While this payment was pending, the order/customer experience was left in an unresolved state for an unusually long window, which can affect customer confidence even if it eventually completed.',
      investigationSteps: this.investigationSteps,
      recommendedActions: this.recommendedActions,
      assumptions: [
        paymentEvents.present ? null : 'Payment event evidence was expected for this rule but none was present — unusual for a LONG_RUNNING_PAYMENT_JOURNEY detection and worth double-checking.',
        apiEvidenceAssumption(incident),
      ],
    })
  },
}

const FAILURE_SPIKE = {
  investigationSteps: [
    'Check whether the affected payments share a common terminal, time window, or payment method',
    'Check whether this batch is isolated to one entry point (e.g. one terminal) or reflects a broader pattern',
    'Check for a corresponding spike in API failures or slow responses in the same window',
  ],
  recommendedActions: [
    'Treat this as a potential systemic issue, not independent failures, until ruled out',
    'Check upstream (gateway/terminal/network) health for the affected time window',
    'Escalate if the ratio continues to climb on subsequent lookups',
  ],
  buildMockResponse(incident, siblingIncidents) {
    return buildResponse(incident, siblingIncidents, {
      executiveSummary: incident.description || `A cluster of failed/cancelled payments was detected in this batch (${evidenceCount(incident)} evidence record(s)).`,
      probableRootCause: 'A batch of payments in this correlation failed or were cancelled at a rate well above what is typical — the evidence confirms the ratio but not the single underlying cause.',
      alternativeExplanations: ['Could indicate one root cause affecting the whole batch (e.g. a terminal, network, or gateway issue), or several independent, unrelated failures/cancellations that happen to coincide in this sample — check whether the affected payments share a common attribute.'],
      businessImpact: 'A spike of this size can affect multiple customers/transactions at once rather than a single isolated payment — treat it as higher-impact than a single PAYMENT_FAILURE until ruled out.',
      investigationSteps: this.investigationSteps,
      recommendedActions: this.recommendedActions,
      assumptions: [apiEvidenceAssumption(incident)],
    })
  },
}

const DEFAULT = {
  investigationSteps: ['Manually review the evidence and timeline for this incident type, which has no dedicated template yet.'],
  recommendedActions: ['Add a dedicated template for this incident type to templates.js.'],
  buildMockResponse(incident, siblingIncidents) {
    return buildResponse(incident, siblingIncidents, {
      executiveSummary: `An incident of type ${incident.incidentType} was detected (${evidenceCount(incident)} evidence record(s)). No dedicated investigation template exists for this type yet.`,
      probableRootCause: null,
      alternativeExplanations: [],
      businessImpact: null,
      investigationSteps: this.investigationSteps,
      recommendedActions: this.recommendedActions,
      assumptions: ['No incident-specific reasoning is available — this used the generic fallback template.'],
    })
  },
}

module.exports = {
  PAYMENT_FAILURE,
  API_FAILURE,
  TERMINAL_ERROR,
  PAYMENT_NOT_CREATED,
  MISSING_API_ACTIVITY,
  REPEATED_PAYMENT_FAILURES,
  RETRY_STORM,
  SLOW_API_RESPONSE,
  LONG_RUNNING_PAYMENT_JOURNEY,
  FAILURE_SPIKE,
  DEFAULT,
}
