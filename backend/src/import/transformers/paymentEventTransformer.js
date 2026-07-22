const { emptyToNull } = require('../utils/emptyToNull')
const { parseJsonField } = require('../utils/parseJsonField')
const { parseTimestamp } = require('../utils/parseTimestamp')
const { parseBigIntString } = require('../utils/parseBigInt')
const { parseBoolean } = require('../utils/parseBoolean')

const TABLE_NAME = 'payment_events'

// Sprint 9C.3: one source CSV row -> one payment_events row (the "every CSV
// row -> one Payment Event" rule, Task 4). payment_events mirrors the FULL
// original row shape — payments is a pure derived aggregate computed by
// paymentEventsService.recomputePaymentAggregate() after this transformer's
// rows land, never assembled directly from a CSV row. Column mapping vs. the
// old (obsolete) paymentTransformer.js: last_updated_at -> event_timestamp,
// user_message_id -> status_message, terminal_code -> terminal_codes_raw,
// terminal_code_raw -> terminal_codes_raw; every other field keeps its name.
const COLUMNS = [
  'entry_id', 'payment_id', 'payment_status', 'event_timestamp', 'created_at',
  'order_id', 'amount', 'merchant_id', 'checkout_id', 'currency', 'payment_type',
  'payment_method', 'payee_phone_number', 'transaction_id', 'voided',
  'void_requested_at', 'void_status', 'store_id', 'card_brand',
  'purchase_payment_id', 'reference_payment_id', 'originated_by',
  'external_request_id', 'external_request_json', 'external_response_json',
  'request_id', 'created_by', 'status_message', 'terminal_message',
  'terminal_codes_raw', 'import_job_id',
]

function safeJson(field, value, warnings) {
  try {
    return parseJsonField(value)
  } catch (err) {
    warnings.push(`Failed to parse JSON field '${field}': ${err.message}`)
    return null
  }
}

function transform(rawRow, importJobId) {
  const warnings = []
  const record = {
    entry_id: emptyToNull(rawRow.entry_id),
    payment_id: emptyToNull(rawRow.payment_id),
    payment_status: emptyToNull(rawRow.payment_status),
    event_timestamp: parseTimestamp(rawRow.last_updated_at),
    created_at: parseTimestamp(rawRow.created_at),
    order_id: emptyToNull(rawRow.order_id),
    amount: parseBigIntString(rawRow.amount),
    merchant_id: emptyToNull(rawRow.merchant_id),
    checkout_id: emptyToNull(rawRow.checkout_id),
    currency: emptyToNull(rawRow.currency),
    payment_type: emptyToNull(rawRow.payment_type),
    payment_method: emptyToNull(rawRow.payment_method),
    payee_phone_number: emptyToNull(rawRow.payee_phone_number),
    transaction_id: emptyToNull(rawRow.transaction_id),
    voided: parseBoolean(rawRow.voided) ?? false,
    void_requested_at: parseTimestamp(rawRow.void_requested_at),
    void_status: emptyToNull(rawRow.void_status),
    store_id: emptyToNull(rawRow.store_id),
    card_brand: emptyToNull(rawRow.card_brand),
    purchase_payment_id: emptyToNull(rawRow.purchase_payment_id),
    reference_payment_id: emptyToNull(rawRow.reference_payment_id),
    originated_by: emptyToNull(rawRow.originated_by),
    external_request_id: emptyToNull(rawRow.external_request_id),
    external_request_json: safeJson('external_request_json', rawRow.external_request_json, warnings),
    external_response_json: safeJson('external_response_json', rawRow.external_response_json, warnings),
    request_id: emptyToNull(rawRow.request_id),
    created_by: emptyToNull(rawRow.created_by),
    status_message: emptyToNull(rawRow.user_message_id),
    terminal_message: emptyToNull(rawRow.terminal_message),
    terminal_codes_raw: safeJson('terminal_code', rawRow.terminal_code, warnings),
    import_job_id: importJobId,
  }
  return { record, warnings }
}

module.exports = { transform, COLUMNS, TABLE_NAME }
