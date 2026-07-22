function success(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data })
}

function failure(res, { code, message }, statusCode) {
  return res.status(statusCode).json({ success: false, error: { code, message } })
}

module.exports = { success, failure }
