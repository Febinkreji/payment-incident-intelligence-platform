const { getApiLogsPage } = require('../../correlation/relationshipResolver')
const { ValidationError } = require('../../shared/errors')
const { success } = require('../response/apiResponse')

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 500

function parsePagination(query) {
  const rawLimit = parseInt(query.limit, 10)
  const rawOffset = parseInt(query.offset, 10)

  if (query.limit !== undefined && Number.isNaN(rawLimit)) throw new ValidationError('limit must be a number')
  if (query.offset !== undefined && Number.isNaN(rawOffset)) throw new ValidationError('offset must be a number')
  if (query.sort !== undefined && query.sort !== 'asc' && query.sort !== 'desc') {
    throw new ValidationError('sort must be "asc" or "desc"')
  }

  return {
    limit: Math.min(MAX_LIMIT, Math.max(1, rawLimit || DEFAULT_LIMIT)),
    offset: Math.max(0, rawOffset || 0),
    sort: query.sort === 'desc' ? 'desc' : 'asc',
  }
}

function parseStatusCodeFilters(query) {
  const statusCodeMin = query.statusCodeMin !== undefined ? Number(query.statusCodeMin) : null
  const statusCodeMax = query.statusCodeMax !== undefined ? Number(query.statusCodeMax) : null

  if (statusCodeMin !== null && Number.isNaN(statusCodeMin)) throw new ValidationError('statusCodeMin must be a number')
  if (statusCodeMax !== null && Number.isNaN(statusCodeMax)) throw new ValidationError('statusCodeMax must be a number')

  return { statusCodeMin, statusCodeMax }
}

// Shared by all four lookup routes below — each supplies exactly one entity
// filter (its own path param); pagination/sort/status-code filtering are the
// same query-string contract on every one of them. This is a standalone
// browsing endpoint, distinct from the api_logs already embedded in a
// correlation result — no correlation/incident/investigation logic runs here.
async function respondWithApiLogsPage(req, res, next, entityFilters) {
  try {
    const pagination = parsePagination(req.query)
    const statusCodeFilters = parseStatusCodeFilters(req.query)

    const { rows, total } = await getApiLogsPage({ ...entityFilters, ...statusCodeFilters, ...pagination })

    return success(res, {
      apiLogs: rows,
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset,
        sort: pagination.sort,
        total,
        hasMore: pagination.offset + rows.length < total,
      },
    })
  } catch (err) {
    next(err)
  }
}

async function getApiLogsByOrderId(req, res, next) {
  return respondWithApiLogsPage(req, res, next, { orderId: req.params.orderId })
}

async function getApiLogsByPaymentId(req, res, next) {
  return respondWithApiLogsPage(req, res, next, { paymentId: req.params.paymentId })
}

async function getApiLogsByTerminalId(req, res, next) {
  return respondWithApiLogsPage(req, res, next, { terminalId: req.params.terminalId })
}

async function getApiLogsByMerchantId(req, res, next) {
  return respondWithApiLogsPage(req, res, next, { merchantId: req.params.merchantId })
}

module.exports = {
  getApiLogsByOrderId,
  getApiLogsByPaymentId,
  getApiLogsByTerminalId,
  getApiLogsByMerchantId,
}
