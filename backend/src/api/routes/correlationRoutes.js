const { Router } = require('express')
const {
  getCorrelationByOrderId,
  getCorrelationByPaymentId,
  getCorrelationByTerminalId,
} = require('../controllers/correlationController')
const { validateIdParam } = require('../middleware/validateRequest')

const router = Router()

router.get('/correlation/order/:orderId', validateIdParam('orderId'), getCorrelationByOrderId)
router.get('/correlation/payment/:paymentId', validateIdParam('paymentId'), getCorrelationByPaymentId)
router.get('/correlation/terminal/:terminalId', validateIdParam('terminalId'), getCorrelationByTerminalId)

module.exports = router
