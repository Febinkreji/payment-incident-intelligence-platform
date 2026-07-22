import { fetchApiEnvelope } from './newBackendClient'

export function getInvestigationByOrderId(orderId) {
  return fetchApiEnvelope(`/api/investigation/order/${encodeURIComponent(orderId)}`)
}

export function getInvestigationByPaymentId(paymentId) {
  return fetchApiEnvelope(`/api/investigation/payment/${encodeURIComponent(paymentId)}`)
}
