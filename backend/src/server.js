require('dotenv').config()

const app = require('./app')

// Requiring firebase.js runs its initialization immediately (credentials
// loaded, admin app created) — reaching this line means it succeeded.
require('./config/firebase/firebase')
console.log('✓ Firebase initialized')

const { testConnection } = require('./config/postgres/postgres')

const PORT = process.env.PORT || 5000

async function start() {
  await testConnection()
  console.log('✓ PostgreSQL connected')

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

start().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
