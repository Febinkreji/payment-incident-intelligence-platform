import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { Avatar } from '../ui/Avatar'
import { BellIcon, ChevronDownIcon, HelpIcon, LogoutIcon, MenuIcon, MoonIcon, SettingsIcon, SunIcon, UserIcon } from './Icons'
import './TopHeader.css'

function useClickOutside(onOutside) {
  const ref = useRef(null)

  useEffect(() => {
    function handle(event) {
      if (ref.current && !ref.current.contains(event.target)) onOutside()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onOutside])

  return ref
}

function NotificationsMenu() {
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(() => setOpen(false))

  return (
    <div className="header-popover-wrap" ref={ref}>
      <button
        type="button"
        className="header-icon-button"
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
      >
        <BellIcon />
      </button>
      {open && (
        <div className="header-popover header-popover-notifications">
          <div className="header-popover-title">Notifications</div>
          <p className="header-popover-empty">You're all caught up.</p>
        </div>
      )}
    </div>
  )
}

export function TopHeader({ onOpenMobileSidebar }) {
  const { user, role, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useClickOutside(() => setMenuOpen(false))

  async function handleLogout() {
    setMenuOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="top-header">
      <div className="top-header-left">
        <button
          type="button"
          className="header-icon-button header-mobile-menu"
          onClick={onOpenMobileSidebar}
          title="Open menu"
        >
          <MenuIcon />
        </button>
        <Link to="/" className="top-header-brand">
          <span className="top-header-brand-mark">PIP</span>
          <span className="top-header-brand-full">Payment Incident Platform</span>
        </Link>
      </div>

      <div className="top-header-right">
        <button
          type="button"
          className="header-icon-button"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        >
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </button>

        <NotificationsMenu />

        <div className="header-popover-wrap" ref={menuRef}>
          <button type="button" className="profile-trigger" onClick={() => setMenuOpen((v) => !v)}>
            <Avatar user={user} />
            <span className="profile-trigger-text">
              <span className="profile-trigger-name">{user?.displayName || user?.email}</span>
              {role && <span className="profile-trigger-role">{role}</span>}
            </span>
            <ChevronDownIcon className="profile-trigger-chevron" />
          </button>

          {menuOpen && (
            <div className="header-popover profile-menu">
              <Link to="/profile" className="profile-menu-item" onClick={() => setMenuOpen(false)}>
                <UserIcon /> Profile
              </Link>
              <button type="button" className="profile-menu-item" onClick={() => setMenuOpen(false)}>
                <BellIcon /> Notifications
              </button>
              <button
                type="button"
                className="profile-menu-item"
                onClick={() => {
                  toggleTheme()
                  setMenuOpen(false)
                }}
              >
                {theme === 'light' ? <MoonIcon /> : <SunIcon />} Theme:{' '}
                {theme === 'light' ? 'Light' : 'Dark'}
              </button>
              <Link to="/settings" className="profile-menu-item" onClick={() => setMenuOpen(false)}>
                <SettingsIcon /> Settings
              </Link>
              <a
                className="profile-menu-item"
                href="https://github.com/Febinkreji/PIP#readme"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
              >
                <HelpIcon /> Help
              </a>
              <button type="button" className="profile-menu-item profile-menu-item-danger" onClick={handleLogout}>
                <LogoutIcon /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
