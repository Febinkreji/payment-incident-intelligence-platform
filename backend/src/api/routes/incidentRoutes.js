const { Router } = require('express')
const { getIncidentsByOrderId, getIncidentsByPaymentId } = require('../controllers/incidentController')
const { validateIdParam } = require('../middleware/validateRequest')

const router = Router()

router.get('/incidents/order/:orderId', validateIdParam('orderId'), getIncidentsByOrderId)
router.get('/incidents/payment/:paymentId', validateIdParam('paymentId'), getIncidentsByPaymentId)

module.exports = router
