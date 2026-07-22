// Different fact-table records use different timestamp column names
// (orders.created_at, payments.created_at, api_logs.request_ts,
// terminal_events.event_timestamp) — this checks them in a sensible
// priority order rather than assuming one fixed field name.
const TIMESTAMP_FIELDS = ['event_timestamp', 'request_ts', 'created_at', 'order_date', 'detectedAt', 'generatedAt']

export function getBestTimestamp(record) {
  if (!record) return null
  for (const field of TIMESTAMP_FIELDS) {
    if (record[field]) return record[field]
  }
  return null
}

export function formatTimestamp(value) {
  if (!value) return 'Unknown time'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}
