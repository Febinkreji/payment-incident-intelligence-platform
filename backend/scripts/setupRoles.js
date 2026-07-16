require('../src/config/firebase/firebase')
const { getAuth } = require('firebase-admin/auth')
const { ROLES } = require('../src/shared/constants/roles')

const DEFAULT_PASSWORD = 'Password@123'

// Bootstrap set for a fresh Firebase project. Re-run this script (with no
// arguments) after every project migration — Firebase Auth users and custom
// claims are project-scoped and never carry over automatically.
const DEFAULT_USERS = [
  { email: 'admin@platform.com', role: 'ADMIN' },
  { email: 'engineer@platform.com', role: 'ENGINEER' },
  { email: 'manager@platform.com', role: 'MANAGER' },
  { email: 'viewer@platform.com', role: 'VIEWER' },
]

function parseArgs() {
  const [, , emailArg, roleArg] = process.argv

  if (emailArg && roleArg) {
    return [{ email: emailArg, role: roleArg.toUpperCase() }]
  }

  if (emailArg || roleArg) {
    throw new Error('Usage: node scripts/setupRoles.js [email] [role]  (both or neither)')
  }

  return DEFAULT_USERS
}

async function ensureUser(email, password) {
  try {
    return await getAuth().getUserByEmail(email)
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error
    return getAuth().createUser({ email, password, emailVerified: true })
  }
}

// Demo accounts are documented (README) to always sign in with
// DEFAULT_PASSWORD. Bug found during QA: ensureUser() only ever set the
// password at creation time — if a demo account's password ever drifted
// (changed out-of-band, or created with a different password originally),
// every later re-run of this script silently left it drifted, with no
// error, so "admin@platform.com / Password@123" from the README could
// quietly stop working. Only used for the fixed DEFAULT_USERS bootstrap
// list below — never for the single-user role-assignment CLI path, which
// must never reset a real user's password as a side effect of assigning a
// role.
async function ensureDemoUser(email, password) {
  const user = await ensureUser(email, password)
  await getAuth().updateUser(user.uid, { password })
  return user
}

async function setupRoles() {
  const users = parseArgs()
  const isDefaultBootstrap = users === DEFAULT_USERS

  for (const { email, role } of users) {
    if (!ROLES.includes(role)) {
      throw new Error(`Invalid role "${role}" for ${email}. Must be one of: ${ROLES.join(', ')}`)
    }

    const user = isDefaultBootstrap
      ? await ensureDemoUser(email, DEFAULT_PASSWORD)
      : await ensureUser(email, DEFAULT_PASSWORD)
    await getAuth().setCustomUserClaims(user.uid, { role })

    // Re-fetch to confirm the claim actually took, rather than trusting the write blindly.
    const updated = await getAuth().getUser(user.uid)
    console.log(`${email} -> uid=${user.uid} role=${updated.customClaims && updated.customClaims.role}`)
  }

  console.log(
    `\nDone. Password for any newly created account: ${DEFAULT_PASSWORD}\n` +
      'Custom claims only take effect on a user\'s NEXT ID token — already-signed-in ' +
      'sessions must log out/in again, or force a token refresh, to pick up the new role.'
  )
}

setupRoles()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('setupRoles failed:', error.message || error)
    process.exit(1)
  })
