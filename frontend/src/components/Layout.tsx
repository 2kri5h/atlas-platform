import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, Map, CheckSquare,
  Bell, MessageCircle, Bot, User, LogOut, Mail, Menu, X, MoreHorizontal
} from 'lucide-react'
import { Breadcrumbs } from './Breadcrumbs'
import './Layout.css'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/resources', icon: BookOpen, label: 'Resources' },
  //{ to: '/events', icon: Calendar, label: 'Events' },
  { to: '/journeys', icon: Map, label: 'Journeys' },
  { to: '/planner', icon: CheckSquare, label: 'Planner' },
  { to: '/deadlines', icon: Bell, label: 'Deadlines' },
  { to: '/anonymous', icon: MessageCircle, label: 'Anonymous' },
  { to: '/ai', icon: Bot, label: 'AI Assistant' },
  { to: '/emails', icon: Mail, label: 'Email Service' },
]

// Primary items for mobile bottom bar
const bottomNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/planner', icon: CheckSquare, label: 'Planner' },
  { to: '/ai', icon: Bot, label: 'AI Assistant' },
  { to: '/deadlines', icon: Bell, label: 'Deadlines' },
]

// Pages that manage their own full-width layout
const FULL_WIDTH_ROUTES = ['/ai']

function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isFullWidth = FULL_WIDTH_ROUTES.some(r => location.pathname.startsWith(r))

  // Close mobile drawer and update unique page title when route changes
  useEffect(() => {
    setMobileMenuOpen(false)

    const titles: Record<string, string> = {
      '/': 'Dashboard — ATLAS IIT Bombay',
      '/planner': 'Timetable & Weekly Planner — ATLAS',
      '/deadlines': 'Deadlines & Tasks Manager — ATLAS',
      '/ai': 'AI Assistant & Study Mentor — ATLAS',
      '/emails': 'Webmail & Events Sync — ATLAS',
      '/resources': 'Resource Library & Notes — ATLAS',
      '/events': 'Campus Events & Workshops — ATLAS',
      '/journeys': 'Senior Placement Journeys — ATLAS',
      '/anonymous': 'Anonymous Student Portal — ATLAS',
      '/profile': 'Profile & Preferences — ATLAS',
    }
    const currentTitle = titles[location.pathname] || 'ATLAS — IIT Bombay Student Productivity'
    document.title = currentTitle
  }, [location.pathname])

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  // Get active page name for mobile top bar
  const activeNavItem = navItems.find(item =>
    item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
  )
  const activeTitle = activeNavItem ? activeNavItem.label : (location.pathname.startsWith('/profile') ? 'Profile' : 'ATLAS')

  return (
    <div className="layout">
      {/* ── Mobile Top App Bar (Visible on <= 1024px) ── */}
      <header className="mobile-top-bar">
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open Navigation Menu"
        >
          <Menu size={22} />
        </button>
        <div className="mobile-brand-title">
          <span className="mobile-logo-text">ATLAS</span>
          <span className="mobile-page-divider">/</span>
          <span className="mobile-page-title">{activeTitle}</span>
        </div>
        <NavLink to="/profile" className="mobile-profile-btn" aria-label="My Profile">
          <User size={20} />
        </NavLink>
      </header>

      {/* ── Mobile Drawer Backdrop & Slide-over ── */}
      {mobileMenuOpen && (
        <div
          className="mobile-drawer-overlay"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── Sidebar (Fixed Desktop + Slide-over Mobile) ── */}
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-branding">
            <h1 className="logo">ATLAS</h1>
            <span className="logo-sub">IIT Bombay</span>
          </div>
          <button
            className="sidebar-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close Menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="nav">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }: { isActive: boolean }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
              onClick={() => setMobileMenuOpen(false)}
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <NavLink
            to="/profile"
            className="nav-item"
            onClick={() => setMobileMenuOpen(false)}
          >
            <User size={20} />
            <span>Profile</span>
          </NavLink>
          <button onClick={handleLogout} className="nav-item logout-btn">
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content Body ── */}
      <main className="main-content">
        {isFullWidth ? (
          <Outlet />
        ) : (
          <div className="container">
            <Breadcrumbs />
            <Outlet />
          </div>
        )}
      </main>

      {/* ── Mobile Floating Bottom Navigation Bar (Visible on <= 768px) ── */}
      <nav className="mobile-bottom-nav">
        {bottomNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }: { isActive: boolean }) =>
              `bottom-nav-item ${isActive ? 'active' : ''}`
            }
          >
            <Icon size={20} />
            <span className="bottom-nav-label">{label}</span>
          </NavLink>
        ))}
        <button
          className={`bottom-nav-item ${mobileMenuOpen ? 'active' : ''}`}
          onClick={() => setMobileMenuOpen(prev => !prev)}
          aria-label="More Options"
        >
          <MoreHorizontal size={20} />
          <span className="bottom-nav-label">More</span>
        </button>
      </nav>
    </div>
  )
}

export default Layout
