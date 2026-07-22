import { fetchApiEnvelope } from './newBackendClient'

export function getAnalysisByOrderId(orderId) {
  return fetchApiEnvelope(`/api/analyze/order/${encodeURIComponent(orderId)}`)
}

export function getAnalysisByPaymentId(paymentId) {
  return fetchApiEnvelope(`/api/analyze/payment/${encodeURIComponent(paymentId)}`)
}

export function getAnalysisByTerminalId(terminalId) {
  return fetchApiEnvelope(`/api/analyze/terminal/${encodeURIComponent(terminalId)}`)
}
