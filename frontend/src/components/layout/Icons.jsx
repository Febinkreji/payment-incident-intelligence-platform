// Minimal inline stroke icons (Feather-style) — no icon library dependency,
// no extra network request, no bundle bloat. 20x20 viewBox, currentColor.
const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export function DashboardIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  )
}

export function IncidentIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 L22 20 H2 Z" />
      <line x1="12" y1="9.5" x2="12" y2="14" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function MonitoringIcon(props) {
  return (
    <svg {...base} {...props}>
      <polyline points="2,13 7.5,13 9.5,5 13.5,19 15.5,13 22,13" />
    </svg>
  )
}

export function EvidenceIcon(props) {
  return (
    <svg {...base} {...props}>
      <polygon points="12,3 21,8.5 12,14 3,8.5" />
      <polyline points="3,13.5 12,19 21,13.5" />
    </svg>
  )
}

export function AnalyticsIcon(props) {
  return (
    <svg {...base} {...props}>
      <line x1="4" y1="20" x2="4" y2="11" />
      <line x1="10" y1="20" x2="10" y2="4" />
      <line x1="16" y1="20" x2="16" y2="14" />
      <line x1="21" y1="20" x2="3" y2="20" />
    </svg>
  )
}

export function ReportsIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 2.5h8l5 5v14H6z" />
      <path d="M14 2.5v5h5" />
      <line x1="9" y1="13" x2="17" y2="13" />
      <line x1="9" y1="17" x2="17" y2="17" />
    </svg>
  )
}

export function RunbooksIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 5.5c3-2 7-2 9.5 0v14c-2.5-2-6.5-2-9.5 0z" />
      <path d="M21.5 5.5c-3-2-7-2-9.5 0v14c2.5-2 6.5-2 9.5 0z" />
    </svg>
  )
}

export function SettingsIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 1.5v4M12 18.5v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1.5 12h4M18.5 12h4M4.2 19.8L7 17M17 7l2.8-2.8" />
    </svg>
  )
}

export function SunIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 1.5v3M12 19.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1.5 12h3M19.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  )
}

export function MoonIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" />
    </svg>
  )
}

export function BellIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  )
}

export function ChevronDownIcon(props) {
  return (
    <svg {...base} {...props}>
      <polyline points="5,8 12,15 19,8" />
    </svg>
  )
}

export function MenuIcon(props) {
  return (
    <svg {...base} {...props}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

export function UserIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" />
    </svg>
  )
}

export function HelpIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M9.2 9.2a2.8 2.8 0 1 1 4.4 2.3c-.9.6-1.6 1-1.6 2.3" />
      <circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function LogoutIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16,17 21,12 16,7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}
