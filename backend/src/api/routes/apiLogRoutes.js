const { Router } = require('express')
const {
  getApiLogsByOrderId,
  getApiLogsByPaymentId,
  getApiLogsByTerminalId,
  getApiLogsByMerchantId,
} = require('../controllers/apiLogController')
const { validateIdParam } = require('../middleware/validateRequest')

const router = Router()

// Standalone, paginated api_logs browsing (Sprint 9D.6) — distinct from the
// api_logs already embedded in /correlation, /incidents, /analyze results.
// Query string on every route below: ?limit=&offset=&sort=asc|desc
// &statusCodeMin=&statusCodeMax=
router.get('/api-logs/order/:orderId', validateIdParam('orderId'), getApiLogsByOrderId)
router.get('/api-logs/payment/:paymentId', validateIdParam('paymentId'), getApiLogsByPaymentId)
router.get('/api-logs/terminal/:terminalId', validateIdParam('terminalId'), getApiLogsByTerminalId)
router.get('/api-logs/merchant/:merchantId', validateIdParam('merchantId'), getApiLogsByMerchantId)

module.exports = router
