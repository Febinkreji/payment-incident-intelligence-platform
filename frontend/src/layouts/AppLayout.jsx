import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/layout/Sidebar'
import { TopHeader } from '../components/layout/TopHeader'
import '../components/ui/primitives.css'
import './AppLayout.css'

const COLLAPSE_KEY = 'pip-sidebar-collapsed'

function getInitialCollapsed() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(COLLAPSE_KEY) === '1'
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(getInitialCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)

  function toggleCollapse() {
    setCollapsed((current) => {
      const next = !current
      window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      return next
    })
  }

  return (
    <div className="app-shell">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        onNavigate={() => setMobileOpen(false)}
        className={mobileOpen ? 'sidebar-mobile-open' : ''}
      />
      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}

      <div className="app-shell-main">
        <TopHeader onOpenMobileSidebar={() => setMobileOpen(true)} />

        <main className="app-content">
          <Outlet />
        </main>

        <footer className="app-footer">
          <span>PIP (Payment Incident Platform)</span>
          <span>© {new Date().getFullYear()}</span>
        </footer>
      </div>
    </div>
  )
}
