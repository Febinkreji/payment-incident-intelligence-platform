import { hashString } from './incidentAnalytics'

// Grafana-style read-only tiles. There is no real per-second telemetry
// pipeline in this app (no APM/metrics backend), so every value here is a
// deterministic, day-seeded synthesis — same technique already used
// throughout incidentAnalytics.js — computed once per page load from data
// already in memory. No polling, no interval, no extra request.
function seededRange(key, min, max) {
  const seed = hashString(`${key}-${new Date().toISOString().slice(0, 10)}`)
  return min + (seed % (max - min + 1))
}

function statusFromValue(value, warnAt, criticalAt, higherIsWorse = true) {
  if (higherIsWorse) {
    if (value >= criticalAt) return 'critical'
    if (value >= warnAt) return 'warning'
    return 'healthy'
  }
  if (value <= criticalAt) return 'critical'
  if (value <= warnAt) return 'warning'
  return 'healthy'
}

export function deriveLiveMetrics(dashboardStats) {
  const criticalIncidents = dashboardStats?.criticalIncidents ?? 0
  const pressure = Math.min(criticalIncidents, 5) // nudges a few tiles when there's real trouble

  const tps = seededRange('tps', 800, 1400)
  const latencyMs = seededRange('latency', 45, 120) + pressure * 15
  const successRate = Math.max(95, (dashboardStats?.paymentSuccessRate ?? 98.6) - pressure * 0.4)

  const authorizationMs = seededRange('authorization', 60, 140)
  const captureMs = seededRange('capture', 80, 160)
  const refundMs = seededRange('refund', 100, 220)

  const cpuPct = seededRange('cpu', 35, 65) + pressure * 5
  const memoryPct = seededRange('memory', 40, 70) + pressure * 4
  const kafkaLagMs = seededRange('kafka-lag', 10, 180) + pressure * 60
  const redisLatencyMs = seededRange('redis-latency', 1, 6)
  const dbLatencyMs = seededRange('db-latency', 8, 30) + pressure * 8
  const gatewayLatencyMs = seededRange('gateway-latency', 20, 60)
  const settlementQueueDepth = seededRange('settlement-queue', 0, 40) + pressure * 20

  return {
    payments: [
      { key: 'tps', label: 'Transactions / sec', value: tps, unit: '', status: 'healthy' },
      {
        key: 'latency',
        label: 'Avg Latency',
        value: latencyMs,
        unit: 'ms',
        status: statusFromValue(latencyMs, 150, 250),
      },
      {
        key: 'success-rate',
        label: 'Success Rate',
        value: successRate.toFixed(1),
        unit: '%',
        status: statusFromValue(successRate, 97, 95, false),
      },
      {
        key: 'authorization',
        label: 'Authorization',
        value: authorizationMs,
        unit: 'ms',
        status: statusFromValue(authorizationMs, 180, 260),
      },
      {
        key: 'capture',
        label: 'Capture',
        value: captureMs,
        unit: 'ms',
        status: statusFromValue(captureMs, 200, 300),
      },
      {
        key: 'refund',
        label: 'Refund',
        value: refundMs,
        unit: 'ms',
        status: statusFromValue(refundMs, 260, 400),
      },
    ],
    infrastructure: [
      {
        key: 'cpu',
        label: 'CPU Utilization',
        value: cpuPct,
        unit: '%',
        status: statusFromValue(cpuPct, 75, 90),
      },
      {
        key: 'memory',
        label: 'Memory Utilization',
        value: memoryPct,
        unit: '%',
        status: statusFromValue(memoryPct, 80, 92),
      },
      {
        key: 'kafka-lag',
        label: 'Kafka Consumer Lag',
        value: kafkaLagMs,
        unit: 'ms',
        status: statusFromValue(kafkaLagMs, 200, 400),
      },
      {
        key: 'redis',
        label: 'Redis Latency',
        value: redisLatencyMs,
        unit: 'ms',
        status: statusFromValue(redisLatencyMs, 8, 15),
      },
      {
        key: 'database',
        label: 'Database Latency',
        value: dbLatencyMs,
        unit: 'ms',
        status: statusFromValue(dbLatencyMs, 35, 60),
      },
      {
        key: 'api-gateway',
        label: 'API Gateway Latency',
        value: gatewayLatencyMs,
        unit: 'ms',
        status: statusFromValue(gatewayLatencyMs, 80, 140),
      },
      {
        key: 'settlement',
        label: 'Settlement Queue Depth',
        value: settlementQueueDepth,
        unit: '',
        status: statusFromValue(settlementQueueDepth, 30, 60),
      },
    ],
  }
}
