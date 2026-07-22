// One entry per incident type. Adding a new incident type later means
// adding one new key here — investigationEngine.js never changes, it just
// looks up `templates[incident.incidentType] || templates.DEFAULT`.
//
// buildMockResponse() is only used by the mock provider (Sprint 6 has no
// real LLM integration) — it fabricates a plausible, evidence-grounded JSON
// response so the rest of the pipeline (response parsing, the Investigation
// model) can be exercised end-to-end without ever inventing evidence beyond
// what the incident itself already contains.

function evidenceCount(incident) {
  return incident.evidence?.length || 0
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
  buildMockResponse(incident) {
    return JSON.stringify({
      executiveSummary: `Payment ${incident.affectedPayment || 'unknown'} reached status PAYMENT_FAILED (${evidenceCount(incident)} evidence record(s)).`,
      probableRootCause: 'Card declined by issuer, or a payment gateway timeout — the evidence confirms the failed status but not the underlying decline reason.',
      confidence: incident.confidence,
      investigationSteps: this.investigationSteps,
      recommendedActions: this.recommendedActions,
      assumptions: ['The specific gateway decline code was not present in the evidence, so the root cause is a hypothesis, not a confirmed fact.'],
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
  buildMockResponse(incident) {
    return JSON.stringify({
      executiveSummary: `One or more API calls returned a server error (5xx) (${evidenceCount(incident)} evidence record(s)).`,
      probableRootCause: 'A server-side fault in the API handling this request — the specific cause (bug, dependency failure, resource exhaustion) is not determinable from status_code alone.',
      confidence: incident.confidence,
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
  buildMockResponse(incident) {
    return JSON.stringify({
      executiveSummary: `Terminal ${incident.affectedTerminal || 'unknown'} reported multiple ERROR events (${evidenceCount(incident)} evidence record(s)).`,
      probableRootCause: 'A device-level fault (connectivity, firmware, or hardware) — the specific cause requires inspecting event_body payloads not included in this evidence set.',
      confidence: incident.confidence,
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
  buildMockResponse(incident) {
    return JSON.stringify({
      executiveSummary: `Order(s) reached a resolved status but no linked payment record exists (${evidenceCount(incident)} evidence record(s)).`,
      probableRootCause: 'A payment webhook/callback was likely missed or failed, or the payment was processed out-of-band and never linked back to this order.',
      confidence: incident.confidence,
      investigationSteps: this.investigationSteps,
      recommendedActions: this.recommendedActions,
      assumptions: ['This may also reflect a sampling gap in imported data rather than a real production incident — see correlation warnings.'],
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
  buildMockResponse(incident) {
    return JSON.stringify({
      executiveSummary: `Payment ${incident.affectedPayment || 'unknown'} exists but has zero associated api_logs (${evidenceCount(incident)} evidence record(s)).`,
      probableRootCause: 'Either a logging/observability gap, or the payment was created through a path that does not emit api_logs entries.',
      confidence: incident.confidence,
      investigationSteps: this.investigationSteps,
      recommendedActions: this.recommendedActions,
      assumptions: ['Whether this is a logging gap vs. an alternate integration path cannot be determined from the evidence alone.'],
    })
  },
}

const DEFAULT = {
  investigationSteps: ['Manually review the evidence and timeline for this incident type, which has no dedicated template yet.'],
  recommendedActions: ['Add a dedicated template for this incident type to templates.js.'],
  buildMockResponse(incident) {
    return JSON.stringify({
      executiveSummary: `An incident of type ${incident.incidentType} was detected (${evidenceCount(incident)} evidence record(s)). No dedicated investigation template exists for this type yet.`,
      probableRootCause: null,
      confidence: incident.confidence,
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
  DEFAULT,
}
