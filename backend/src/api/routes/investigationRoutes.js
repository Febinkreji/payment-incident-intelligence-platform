const { Router } = require('express')
const { getInvestigationByOrderId, getInvestigationByPaymentId } = require('../controllers/investigationController')
const { validateIdParam } = require('../middleware/validateRequest')

const router = Router()

router.get('/investigation/order/:orderId', validateIdParam('orderId'), getInvestigationByOrderId)
router.get('/investigation/payment/:paymentId', validateIdParam('paymentId'), getInvestigationByPaymentId)

module.exports = router
