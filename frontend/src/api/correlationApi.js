import { fetchApiEnvelope } from './newBackendClient'

export function getCorrelationByOrderId(orderId) {
  return fetchApiEnvelope(`/api/correlation/order/${encodeURIComponent(orderId)}`)
}

export function getCorrelationByPaymentId(paymentId) {
  return fetchApiEnvelope(`/api/correlation/payment/${encodeURIComponent(paymentId)}`)
}

export function getCorrelationByTerminalId(terminalId) {
  return fetchApiEnvelope(`/api/correlation/terminal/${encodeURIComponent(terminalId)}`)
}
