const { Router } = require('express')
const { getCandidates, evaluateScreening, getRules } = require('../controllers/screeningController')

const router = Router()

// GET  /screening/candidates?preset=&from=&to=&ruleIds=&priority=&limit=&offset=&perRuleLimit=
// POST /screening/evaluate   — same parameters as a JSON body instead of a query string
// GET  /screening/rules      — rule introspection (id/displayName/description/entityType/
//                               version/defaultEnabled/configurableParams) for a future rule-
//                               configuration UI; never exposes buildParams/evaluate internals.
router.get('/screening/candidates', getCandidates)
router.post('/screening/evaluate', evaluateScreening)
router.get('/screening/rules', getRules)

module.exports = router
