import { fetchApiEnvelope } from './newBackendClient'

export function getIncidentsByOrderId(orderId) {
  return fetchApiEnvelope(`/api/incidents/order/${encodeURIComponent(orderId)}`)
}

export function getIncidentsByPaymentId(paymentId) {
  return fetchApiEnvelope(`/api/incidents/payment/${encodeURIComponent(paymentId)}`)
}
