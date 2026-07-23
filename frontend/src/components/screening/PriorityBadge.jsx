import { SeverityBadge } from '../Badge'

// Screening priority tiers (CRITICAL/HIGH/MEDIUM/LOW) are the exact same
// value set as incident severity — reusing SeverityBadge directly means the
// dashboard's color language for "how bad" is identical everywhere in the
// app, rather than a second, slightly-different palette invented for this
// one feature.
export function PriorityBadge({ priority }) {
  return <SeverityBadge severity={priority} />
}
