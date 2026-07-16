// Static, reusable runbook templates — keyed by category, NOT by incident.
// The same template is shared across every incident whose root cause maps to
// it, so nothing is duplicated per-incident and nothing is read from
// Firestore. `resolveRunbook(runbookLink)` maps a recommendation's existing
// `runbookLink` field (already loaded with the incident) to the best template
// via keyword matching — no schema change, no new collection.

const RUNBOOKS = {
  database: {
    key: 'database',
    name: 'Database Saturation & Slow Query Recovery',
    ownerTeam: 'Platform Team',
    version: 'v2.3',
    category: 'Database',
    difficulty: 'Intermediate',
    estimatedRecoveryTime: '20-40 minutes',
    lastUpdated: '2026-05-12',
    description:
      'Recovery procedure for connection pool exhaustion, lock contention, or sustained write-latency spikes on the primary database cluster.',
    prerequisites: ['Database admin (psql) access', 'kubectl access to the payment-orchestrator namespace'],
    escalation: 'If unresolved after 30 minutes, page the Platform Team secondary on-call via PagerDuty.',
    steps: [
      { text: 'Confirm saturation via connection pool and write-latency dashboards.', command: null },
      { text: 'Identify long-running or blocking queries.', command: 'SELECT * FROM pg_stat_activity WHERE state != \'idle\' ORDER BY query_start;' },
      { text: 'Scale the connection pool if utilization is above 90%.', command: 'kubectl set env deployment/payment-orchestrator DB_POOL_SIZE=200' },
      { text: 'Terminate blocking queries older than the SLA threshold.', command: 'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE query_start < now() - interval \'5 minutes\';' },
      { text: 'Monitor replication lag while the pool drains.', command: null },
    ],
    checklist: [
      'Write latency (p95) back under 60ms',
      'Connection pool utilization under 70%',
      'No blocking queries older than 60s',
      'Replication lag under 2s',
    ],
    rollback: [
      'Revert connection pool size to previous value if scaling caused resource pressure elsewhere.',
      'Re-enable any read-replica routing that was disabled during triage.',
    ],
    relatedRunbooks: ['redis', 'connectionPool'],
    usefulLinks: [
      { label: 'Grafana Dashboard', url: 'https://grafana.internal/d/db-overview' },
      { label: 'Kibana', url: 'https://kibana.internal/app/database-logs' },
      { label: 'Confluence', url: 'https://confluence.internal/database-runbooks' },
    ],
  },

  redis: {
    key: 'redis',
    name: 'Redis Cache Latency & Eviction Recovery',
    ownerTeam: 'Platform Team',
    version: 'v1.8',
    category: 'Cache',
    difficulty: 'Beginner',
    estimatedRecoveryTime: '10-15 minutes',
    lastUpdated: '2026-04-02',
    description: 'Recovery procedure for elevated Redis cache latency or eviction pressure affecting downstream read performance.',
    prerequisites: ['redis-cli access to the cache cluster', 'kubectl access to the redis-cache namespace'],
    escalation: 'If eviction pressure persists after 15 minutes, page the Platform Team on-call.',
    steps: [
      { text: 'Check eviction rate and memory usage on the Redis cluster.', command: 'redis-cli INFO memory' },
      { text: 'Clear stale keys if memory pressure is confirmed.', command: 'redis-cli --scan --pattern "session:*" | xargs redis-cli DEL' },
      { text: 'Verify TTL policy is being applied to new writes.', command: null },
      { text: 'Scale the cache cluster horizontally if pressure persists.', command: 'kubectl scale statefulset redis-cache --replicas=5' },
    ],
    checklist: ['Eviction rate back to baseline', 'Cache hit ratio above 90%', 'p99 latency under 5ms'],
    rollback: ['Scale cluster back down once traffic normalizes to avoid over-provisioning cost.'],
    relatedRunbooks: ['database'],
    usefulLinks: [
      { label: 'Grafana Dashboard', url: 'https://grafana.internal/d/redis-overview' },
      { label: 'Kubernetes Dashboard', url: 'https://k8s.internal/workloads/redis-cache' },
    ],
  },

  kafka: {
    key: 'kafka',
    name: 'Kafka Consumer Lag & Rebalance Recovery',
    ownerTeam: 'SRE Team',
    version: 'v2.0',
    category: 'Messaging',
    difficulty: 'Intermediate',
    estimatedRecoveryTime: '15-30 minutes',
    lastUpdated: '2026-03-20',
    description: 'Recovery procedure for consumer lag, repeated partition rebalancing, or stalled event processing.',
    prerequisites: ['kafka-consumer-groups CLI access', 'kubectl access to the payment-orchestrator-consumer deployment'],
    escalation: 'If lag continues climbing after a restart, page the SRE Team secondary on-call.',
    steps: [
      { text: 'Check consumer group lag across all partitions.', command: 'kafka-consumer-groups --describe --group payment-events --bootstrap-server kafka:9092' },
      { text: 'Restart the affected consumer group.', command: 'kubectl rollout restart deployment/payment-orchestrator-consumer' },
      { text: 'Quarantine malformed messages to the dead-letter topic if rebalancing persists.', command: null },
      { text: 'Scale consumer replicas to match partition count.', command: 'kubectl scale deployment/payment-orchestrator-consumer --replicas=12' },
    ],
    checklist: ['Consumer lag trending to zero', 'No active partition rebalances', 'Dead-letter queue depth stable'],
    rollback: ['Restore original consumer replica count once lag clears.'],
    relatedRunbooks: ['deadLetterQueue'],
    usefulLinks: [
      { label: 'Grafana Dashboard', url: 'https://grafana.internal/d/kafka-overview' },
      { label: 'Jaeger', url: 'https://jaeger.internal/search?service=payment-orchestrator' },
    ],
  },

  psp: {
    key: 'psp',
    name: 'PSP / Issuer Outage Failover',
    ownerTeam: 'Payments Team',
    version: 'v3.1',
    category: 'Payments',
    difficulty: 'Advanced',
    estimatedRecoveryTime: '30-60 minutes',
    lastUpdated: '2026-06-01',
    description: 'Failover procedure when a payment service provider or card issuer network is degraded or unavailable.',
    prerequisites: ['Payments Team routing-config access', 'PSP partner escalation contact on hand'],
    escalation: 'Immediately notify the Payments Team lead and open a partner escalation ticket.',
    steps: [
      { text: 'Confirm outage via the PSP status page and error-rate dashboards.', command: null },
      { text: 'Fail over routing to the secondary PSP.', command: 'kubectl set env deployment/payment-orchestrator PRIMARY_PSP=secondary' },
      { text: 'Notify the PSP partner of elevated error rates through the partner escalation channel.', command: null },
      { text: 'Monitor authorization success rate on the secondary route.', command: null },
    ],
    checklist: ['Authorization success rate above 95% on secondary route', 'PSP partner notified', 'Merchant-facing status page updated'],
    rollback: ['Fail back to the primary PSP once its status page confirms recovery, then monitor for 15 minutes before closing.'],
    relatedRunbooks: ['database'],
    usefulLinks: [
      { label: 'Grafana Dashboard', url: 'https://grafana.internal/d/psp-overview' },
      { label: 'Jira', url: 'https://jira.internal/browse/PAY' },
      { label: 'Confluence', url: 'https://confluence.internal/psp-failover' },
    ],
  },

  infrastructure: {
    key: 'infrastructure',
    name: 'Compute Saturation & Pod Crash-Loop Recovery',
    ownerTeam: 'SRE Team',
    version: 'v2.5',
    category: 'Infrastructure',
    difficulty: 'Intermediate',
    estimatedRecoveryTime: '15-30 minutes',
    lastUpdated: '2026-05-28',
    description: 'Recovery procedure for CPU/memory saturation, pod crash loops, or repeated container restarts.',
    prerequisites: ['kubectl access to the affected namespace', 'Access to the release/rollout history'],
    escalation: 'If CrashLoopBackOff persists after a rollback, page the SRE Team on-call.',
    steps: [
      { text: 'Check pod status and restart counts.', command: 'kubectl get pods -l app=payment-orchestrator -o wide' },
      { text: 'Inspect the crash-looping pod\'s logs for the failure signature.', command: 'kubectl logs -l app=payment-orchestrator --previous --tail=200' },
      { text: 'Roll back to the last known-good deployment if the crash started after a release.', command: 'kubectl rollout undo deployment/payment-orchestrator' },
      { text: 'Scale horizontally if the cause is sustained load rather than a bad release.', command: 'kubectl scale deployment/payment-orchestrator --replicas=8' },
    ],
    checklist: ['Pod restart count stable', 'CPU/memory back within normal range', 'No CrashLoopBackOff events'],
    rollback: ['Re-apply the rolled-forward release once the root cause is fixed and verified in staging.'],
    relatedRunbooks: ['deployment'],
    usefulLinks: [
      { label: 'Kubernetes Dashboard', url: 'https://k8s.internal/workloads/payment-orchestrator' },
      { label: 'Grafana Dashboard', url: 'https://grafana.internal/d/node-overview' },
    ],
  },

  security: {
    key: 'security',
    name: 'Certificate & TLS Failure Recovery',
    ownerTeam: 'Platform Team',
    version: 'v1.4',
    category: 'Security',
    difficulty: 'Intermediate',
    estimatedRecoveryTime: '15-25 minutes',
    lastUpdated: '2026-02-14',
    description: 'Recovery procedure for expired certificates, failed TLS handshakes, or secrets that need emergency rotation.',
    prerequisites: ['cert-manager / kubectl access', 'Secrets rotation approval from Security on-call'],
    escalation: 'Certificate or secret rotation always requires Security on-call sign-off before proceeding.',
    steps: [
      { text: 'Check certificate expiry across affected services.', command: 'kubectl get certificate -A' },
      { text: 'Force-renew the expired certificate.', command: 'kubectl cert-manager renew payment-api-tls' },
      { text: 'Rotate any secrets that were exposed or are expiring alongside the certificate.', command: null },
      { text: 'Restart pods to pick up the renewed certificate.', command: 'kubectl rollout restart deployment/checkout-api' },
    ],
    checklist: ['Certificate valid for 60+ days', 'TLS handshake success rate at 100%', 'Secrets rotation logged'],
    rollback: ['Keep the previous certificate available for 24 hours in case the new one has trust-chain issues.'],
    relatedRunbooks: ['network'],
    usefulLinks: [
      { label: 'Kibana', url: 'https://kibana.internal/app/tls-logs' },
      { label: 'Confluence', url: 'https://confluence.internal/certificate-rotation' },
    ],
  },

  deployment: {
    key: 'deployment',
    name: 'Deployment Rollback & Configuration Recovery',
    ownerTeam: 'Platform Team',
    version: 'v2.1',
    category: 'Deployment',
    difficulty: 'Beginner',
    estimatedRecoveryTime: '10-20 minutes',
    lastUpdated: '2026-06-10',
    description: 'Recovery procedure for a regression introduced by a recent deployment or configuration change.',
    prerequisites: ['kubectl rollout access', 'Feature-flag admin access'],
    escalation: 'If rollback does not resolve the regression, page the Platform Team on-call.',
    steps: [
      { text: 'Review the most recent release and configuration diff.', command: 'kubectl rollout history deployment/checkout-api' },
      { text: 'Roll back to the previous stable release.', command: 'kubectl rollout undo deployment/checkout-api' },
      { text: 'Disable any feature flag enabled alongside the release.', command: null },
      { text: 'Confirm error rate returns to baseline post-rollback.', command: null },
    ],
    checklist: ['Error rate back to baseline', 'Feature flag state confirmed', 'Release marked as rolled back in the release tracker'],
    rollback: ['Re-apply the release only after the regression is fixed and verified in staging.'],
    relatedRunbooks: ['infrastructure'],
    usefulLinks: [
      { label: 'Jira', url: 'https://jira.internal/browse/REL' },
      { label: 'Confluence', url: 'https://confluence.internal/release-process' },
    ],
  },

  network: {
    key: 'network',
    name: 'Network, DNS & Firewall Recovery',
    ownerTeam: 'SRE Team',
    version: 'v1.6',
    category: 'Networking',
    difficulty: 'Advanced',
    estimatedRecoveryTime: '20-45 minutes',
    lastUpdated: '2026-01-30',
    description: 'Recovery procedure for DNS resolution failures, firewall misconfiguration, or elevated packet loss between services.',
    prerequisites: ['kubectl exec access', 'Network/firewall policy change history'],
    escalation: 'Any firewall or network policy revert requires network on-call sign-off.',
    steps: [
      { text: 'Confirm DNS resolution from the affected pod.', command: 'kubectl exec -it deploy/checkout-api -- nslookup payment-orchestrator' },
      { text: 'Check recent firewall / security group changes.', command: null },
      { text: 'Revert the most recent network policy change.', command: 'kubectl apply -f network-policy-previous.yaml' },
      { text: 'Validate connectivity end-to-end after reverting.', command: null },
    ],
    checklist: ['DNS resolution succeeding', 'Packet loss under 0.1%', 'Firewall rule change reverted or approved'],
    rollback: ['Re-apply the network policy change only with explicit sign-off from the network on-call.'],
    relatedRunbooks: ['security'],
    usefulLinks: [
      { label: 'Grafana Dashboard', url: 'https://grafana.internal/d/network-overview' },
      { label: 'Kibana', url: 'https://kibana.internal/app/firewall-logs' },
    ],
  },

  traffic: {
    key: 'traffic',
    name: 'Rate Limiting & Traffic Shaping Recovery',
    ownerTeam: 'Fraud Team',
    version: 'v1.2',
    category: 'Traffic',
    difficulty: 'Beginner',
    estimatedRecoveryTime: '10-20 minutes',
    lastUpdated: '2026-05-05',
    description: 'Recovery procedure when overly aggressive rate limiting is rejecting legitimate traffic.',
    prerequisites: ['API gateway config access'],
    escalation: 'Notify affected merchants proactively if legitimate rejection rate exceeds 5%.',
    steps: [
      { text: 'Check current rate-limit thresholds against traffic volume.', command: null },
      { text: 'Temporarily raise the rate limit for the affected route.', command: 'kubectl set env deployment/api-gateway RATE_LIMIT_RPS=500' },
      { text: 'Drain excess traffic to a secondary pool if raising the limit is not sufficient.', command: null },
      { text: 'Notify affected merchants once traffic is flowing normally.', command: null },
    ],
    checklist: ['Legitimate request rejection rate under 1%', 'No abuse signal on raised threshold', 'Merchants notified'],
    rollback: ['Lower the rate limit back to its original value once traffic volume normalizes.'],
    relatedRunbooks: ['psp'],
    usefulLinks: [
      { label: 'Grafana Dashboard', url: 'https://grafana.internal/d/gateway-overview' },
      { label: 'Jira', url: 'https://jira.internal/browse/FRAUD' },
    ],
  },

  manual: {
    key: 'manual',
    name: 'General Manual Triage Runbook',
    ownerTeam: 'On-Call Engineering',
    version: 'v1.0',
    category: 'General',
    difficulty: 'Beginner',
    estimatedRecoveryTime: 'Varies',
    lastUpdated: '2026-01-01',
    description: 'No specific automated runbook matched this incident\'s root cause — follow general triage steps and escalate as needed.',
    prerequisites: ['Access to the incident\'s evidence workspace and AI analysis'],
    escalation: 'Escalate to the owning team\'s on-call if root cause is unclear after initial triage.',
    steps: [
      { text: 'Review AI root cause analysis and correlated evidence above.', command: null },
      { text: 'Check the service\'s dashboard for anomalies.', command: null },
      { text: 'Escalate to the owning team if the cause is not immediately clear.', command: null },
    ],
    checklist: ['Root cause identified', 'Owning team engaged if needed'],
    rollback: ['Not applicable — determine appropriate rollback once root cause is confirmed.'],
    relatedRunbooks: [],
    usefulLinks: [
      { label: 'Confluence', url: 'https://confluence.internal/incident-response' },
    ],
  },
}

// slug keyword -> template key
const KEYWORD_RULES = [
  { match: /database|sql|query|connection-pool/i, key: 'database' },
  { match: /redis|cache/i, key: 'redis' },
  { match: /kafka|consumer|queue|dead-letter/i, key: 'kafka' },
  { match: /psp|issuer|failover|payment/i, key: 'psp' },
  { match: /cpu|memory|pod|crash|infra/i, key: 'infrastructure' },
  { match: /certificate|tls|secret|security/i, key: 'security' },
  { match: /deployment|release|config/i, key: 'deployment' },
  { match: /network|dns|firewall|packet/i, key: 'network' },
  { match: /rate-limit|rate limiting|traffic/i, key: 'traffic' },
]

export function resolveRunbook(runbookLink) {
  const slug = String(runbookLink || '').split('/').filter(Boolean).pop() || ''
  const haystack = slug.replace(/-/g, ' ')

  for (const rule of KEYWORD_RULES) {
    if (rule.match.test(slug) || rule.match.test(haystack)) {
      return RUNBOOKS[rule.key]
    }
  }

  return RUNBOOKS.manual
}

export function getRunbookByKey(key) {
  return RUNBOOKS[key] || RUNBOOKS.manual
}

// For the standalone Runbooks browser page — the full static catalog, not
// resolved against any particular incident.
export function getAllRunbooks() {
  return Object.values(RUNBOOKS)
}
