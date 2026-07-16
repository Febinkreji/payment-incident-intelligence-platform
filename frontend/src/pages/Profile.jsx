import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Avatar } from '../components/ui/Avatar'
import './Profile.css'

// Demo-only organizational metadata keyed by role — Firebase custom claims
// carry only `role`, so department/team/region/access are illustrative
// profile content for the demo, not read from any backend.
const ROLE_PROFILE = {
  ADMIN: {
    department: 'Platform Engineering',
    team: 'Platform Team',
    region: 'Global',
    access: 'Full platform administration',
  },
  ENGINEER: {
    department: 'Site Reliability Engineering',
    team: 'SRE Team',
    region: 'North America',
    access: 'Incident response & workflow actions',
  },
  MANAGER: {
    department: 'Payment Operations',
    team: 'Operations Team',
    region: 'EMEA',
    access: 'Oversight, reporting & escalation approval',
  },
  VIEWER: {
    department: 'Business Operations',
    team: 'Read-Only Access',
    region: 'Global',
    access: 'Read-only — dashboards, analytics & investigations',
  },
}

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function Profile() {
  const { user, role } = useAuth()
  const { theme } = useTheme()

  const roleProfile = ROLE_PROFILE[role] || ROLE_PROFILE.VIEWER
  const provider = user?.providerData?.[0]?.providerId === 'google.com' ? 'Google' : 'Email & Password'

  return (
    <div className="profile-page">
      <PageHeader title="Profile" subtitle="Your account, role, and session information." />

      <Card className="profile-card profile-hero">
        <Avatar user={user} size={64} />
        <div>
          <h2>{user?.displayName || user?.email}</h2>
          <p>{user?.email}</p>
          {role && <span className="profile-role-badge">{role}</span>}
        </div>
      </Card>

      <div className="ui-grid ui-grid-2">
        <Card className="profile-card">
          <h3>Organization</h3>
          <dl className="profile-detail-list">
            <div>
              <dt>Department</dt>
              <dd>{roleProfile.department}</dd>
            </div>
            <div>
              <dt>Team</dt>
              <dd>{roleProfile.team}</dd>
            </div>
            <div>
              <dt>Region</dt>
              <dd>{roleProfile.region}</dd>
            </div>
            <div>
              <dt>Platform Access</dt>
              <dd>{roleProfile.access}</dd>
            </div>
          </dl>
        </Card>

        <Card className="profile-card">
          <h3>Session Information</h3>
          <dl className="profile-detail-list">
            <div>
              <dt>Sign-in Method</dt>
              <dd>{provider}</dd>
            </div>
            <div>
              <dt>Last Login</dt>
              <dd>{formatDateTime(user?.metadata?.lastSignInTime)}</dd>
            </div>
            <div>
              <dt>Member Since</dt>
              <dd>{formatDateTime(user?.metadata?.creationTime)}</dd>
            </div>
            <div>
              <dt>Theme</dt>
              <dd>{theme === 'light' ? 'Light' : 'Dark'}</dd>
            </div>
          </dl>
        </Card>

        <Card className="profile-card">
          <h3>Notification Preferences</h3>
          <p className="profile-note">
            Managed under <strong>Settings</strong> — critical alerts, SLA breach warnings, weekly digest, and
            product updates.
          </p>
        </Card>

        <Card className="profile-card">
          <h3>Security</h3>
          <dl className="profile-detail-list">
            <div>
              <dt>Authentication</dt>
              <dd>Firebase Authentication</dd>
            </div>
            <div>
              <dt>Role-Based Access Control</dt>
              <dd>Enforced via Firebase custom claims</dd>
            </div>
            <div>
              <dt>Email Verified</dt>
              <dd>{user?.emailVerified ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  )
}
