const { pool } = require('../../config/postgres/postgres')
const { version } = require('../../../package.json')
const { success } = require('../response/apiResponse')

async function getHealth(req, res) {
  let databaseReachable = true

  try {
    await pool.query('SELECT 1')
  } catch {
    databaseReachable = false
  }

  return success(
    res,
    {
      status: databaseReachable ? 'ok' : 'degraded',
      version,
      uptime: process.uptime(),
      databaseReachable,
      timestamp: new Date().toISOString(),
    },
    { statusCode: databaseReachable ? 200 : 503 }
  )
}

module.exports = { getHealth }
