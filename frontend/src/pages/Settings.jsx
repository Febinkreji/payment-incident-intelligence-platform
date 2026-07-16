import { useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { useTheme } from '../context/ThemeContext'
import './Settings.css'

const NOTIFICATION_PREFS_KEY = 'pip-notification-prefs'

function getInitialPrefs() {
  try {
    const saved = window.localStorage.getItem(NOTIFICATION_PREFS_KEY)
    if (saved) return JSON.parse(saved)
  } catch {
    // ignore malformed storage
  }
  return { criticalAlerts: true, slaBreaches: true, weeklyDigest: false, productUpdates: false }
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="settings-toggle-row">
      <span className="settings-toggle-text">
        <span className="settings-toggle-label">{label}</span>
        {hint && <span className="settings-toggle-hint">{hint}</span>}
      </span>
      <span className={`settings-toggle ${checked ? 'settings-toggle-on' : ''}`} onClick={() => onChange(!checked)}>
        <span className="settings-toggle-knob" />
      </span>
    </label>
  )
}

// Every preference here is local-only (localStorage), for demo purposes —
// there is no backend settings endpoint and none is created by this page.
export function Settings() {
  const { theme, setTheme } = useTheme()
  const [prefs, setPrefs] = useState(getInitialPrefs)

  function updatePref(key, value) {
    setPrefs((current) => {
      const next = { ...current, [key]: value }
      window.localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(next))
      return next
    })
  }

  return (
    <div className="settings-page">
      <PageHeader title="Settings" subtitle="Local preferences for this browser session." />

      <Card className="settings-card">
        <h2>Appearance</h2>
        <div className="settings-theme-options">
          <button
            type="button"
            className={`settings-theme-option ${theme === 'light' ? 'active' : ''}`}
            onClick={() => setTheme('light')}
          >
            Light
          </button>
          <button
            type="button"
            className={`settings-theme-option ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => setTheme('dark')}
          >
            Dark
          </button>
        </div>
      </Card>

      <Card className="settings-card">
        <h2>Notification Preferences</h2>
        <Toggle
          label="Critical incident alerts"
          hint="Notify immediately when a CRITICAL incident is created."
          checked={prefs.criticalAlerts}
          onChange={(value) => updatePref('criticalAlerts', value)}
        />
        <Toggle
          label="SLA breach warnings"
          hint="Notify when an incident is approaching or has breached its SLA."
          checked={prefs.slaBreaches}
          onChange={(value) => updatePref('slaBreaches', value)}
        />
        <Toggle
          label="Weekly digest"
          hint="A weekly summary of incident volume and trends."
          checked={prefs.weeklyDigest}
          onChange={(value) => updatePref('weeklyDigest', value)}
        />
        <Toggle
          label="Product updates"
          hint="Occasional announcements about new PIP features."
          checked={prefs.productUpdates}
          onChange={(value) => updatePref('productUpdates', value)}
        />
      </Card>
    </div>
  )
}
