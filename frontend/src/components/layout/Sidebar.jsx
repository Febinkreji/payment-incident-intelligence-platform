import { NavLink } from 'react-router-dom'
import {
  DashboardIcon,
  IncidentIcon,
  MonitoringIcon,
  EvidenceIcon,
  AnalyticsIcon,
  ReportsIcon,
  RunbooksIcon,
  SettingsIcon,
  MenuIcon,
} from './Icons'
import './Sidebar.css'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', Icon: DashboardIcon, end: true },
  { to: '/incidents', label: 'Incident Management', Icon: IncidentIcon },
  { to: '/monitoring', label: 'Live Monitoring', Icon: MonitoringIcon },
  { to: '/evidence', label: 'Evidence Sources', Icon: EvidenceIcon },
  { to: '/analytics', label: 'Analytics', Icon: AnalyticsIcon },
  { to: '/reports', label: 'Reports', Icon: ReportsIcon },
  { to: '/runbooks', label: 'Runbooks', Icon: RunbooksIcon },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
]

export function Sidebar({ collapsed, onToggleCollapse, onNavigate, className = '' }) {
  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${className}`}>
      <div className="sidebar-toggle-row">
        <button
          type="button"
          className="sidebar-toggle-button"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <MenuIcon />
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            title={collapsed ? label : undefined}
          >
            <Icon className="sidebar-link-icon" />
            <span className="sidebar-link-label">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
