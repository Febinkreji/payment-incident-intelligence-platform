const { Router } = require('express')
const { analyzeByOrderId, analyzeByPaymentId, analyzeByTerminalId } = require('../controllers/analyzeController')
const { validateIdParam } = require('../middleware/validateRequest')

const router = Router()

router.get('/analyze/order/:orderId', validateIdParam('orderId'), analyzeByOrderId)
router.get('/analyze/payment/:paymentId', validateIdParam('paymentId'), analyzeByPaymentId)
router.get('/analyze/terminal/:terminalId', validateIdParam('terminalId'), analyzeByTerminalId)

module.exports = router
