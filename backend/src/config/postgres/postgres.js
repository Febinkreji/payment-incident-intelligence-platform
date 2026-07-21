const { Pool } = require('pg')

function loadPoolConfig() {
  // Production (Render, etc.): a single connection string is the common
  // convention for managed Postgres add-ons.
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
    }
  }

  // Local dev: discrete PG* variables.
  if (process.env.PGHOST) {
    return {
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
    }
  }

  throw new Error(
    'PostgreSQL credentials not found. Set DATABASE_URL (production) or PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD (local dev) in .env.'
  )
}

const pool = new Pool(loadPoolConfig())

async function testConnection() {
  const client = await pool.connect()

  try {
    await client.query('SELECT 1')
  } finally {
    client.release()
  }
}

module.exports = { pool, testConnection }
