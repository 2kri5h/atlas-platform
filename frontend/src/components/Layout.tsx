import { useState, useEffect, lazy, Suspense } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, Map, CheckSquare,
  Bell, MessageCircle, Bot, User, LogOut, Mail, MoreHorizontal, X, Compass, ChevronRight,
  type LucideIcon
} from 'lucide-react'
import { Breadcrumbs } from './Breadcrumbs'
import PomodoroTimer from './PomodoroTimer'
import ThemeToggle from './ThemeToggle'
import { ToastHost } from './Toast'
import api, { setAuthToken } from '../utils/api'
import './Layout.css'

const AmbientCanvas = lazy(() => import('./ui/AmbientCanvas'))

interface NavSection {
  title?: string
  items: {
    to: string
    icon: LucideIcon
    label: string
    badge?: string
  }[]
}

const navSections: NavSection[] = [
  {
    title: 'CORE WORKSPACE',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/planner', icon: CheckSquare, label: 'Weekly Planner' },
      { to: '/deadlines', icon: Bell, label: 'Deadlines & Tasks' },
      { to: '/emails', icon: Mail, label: 'Email Intelligence', badge: 'Intel' },
    ]
  },
  {
    title: 'ACADEMICS & AI',
    items: [
      { to: '/resources', icon: BookOpen, label: 'Resource Vault' },
      { to: '/ai', icon: Bot, label: 'AI Study Mentor' },
      { to: '/events', icon: Compass, label: 'Campus Events' },
    ]
  },
  {
    title: 'COMMUNITY',
    items: [
      { to: '/journeys', icon: Map, label: 'Senior Journeys' },
      { to: '/anonymous', icon: MessageCircle, label: 'Anonymous Forum' },
    ]
  }
]

// Primary items for mobile bottom dock
const mobilePrimaryNav = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/planner', icon: CheckSquare, label: 'Planner' },
  { to: '/deadlines', icon: Bell, label: 'Tasks' },
  { to: '/emails', icon: Mail, label: 'Emails' },
]

// Secondary items displayed inside mobile "More" bottom sheet
const mobileMoreItems = [
  { to: '/resources', icon: BookOpen, label: 'Resource Vault', desc: 'Notes, papers & Google Drive sync' },
  { to: '/ai', icon: Bot, label: 'AI Study Mentor', desc: 'Ask Gemini, study plans, burnout check' },
  { to: '/events', icon: Compass, label: 'Campus Events', desc: 'Workshops, hackathons, seminars' },
  { to: '/journeys', icon: Map, label: 'Senior Journeys', desc: 'Placement roadmaps & insights' },
  { to: '/anonymous', icon: MessageCircle, label: 'Anonymous Forum', desc: 'Campus community discussions' },
  { to: '/profile', icon: User, label: 'Profile & Settings', desc: 'Preferences, sync and account' },
]

// Pages that manage their own full-width layout
const FULL_WIDTH_ROUTES = ['/ai']

function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)

  const isFullWidth = FULL_WIDTH_ROUTES.some(r => location.pathname.startsWith(r))

  // Close mobile drawer and update unique page title when route changes
  useEffect(() => {
    setMobileSheetOpen(false)

    const titles: Record<string, string> = {
      '/': 'Dashboard — ATLAS IIT Bombay',
      '/planner': 'Timetable & Weekly Planner — ATLAS',
      '/deadlines': 'Deadlines & Tasks Manager — ATLAS',
      '/ai': 'AI Study Mentor — ATLAS',
      '/emails': 'Email Intelligence Hub — ATLAS',
      '/resources': 'Resource Library & Notes — ATLAS',
      '/events': 'Campus Events & Workshops — ATLAS',
      '/journeys': 'Senior Placement Journeys — ATLAS',
      '/anonymous': 'Anonymous Student Portal — ATLAS',
      '/profile': 'Profile & Preferences — ATLAS',
    }
    const currentTitle = titles[location.pathname] || 'ATLAS — IIT Bombay Student OS'
    document.title = currentTitle
  }, [location.pathname])

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (mobileSheetOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileSheetOpen])

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // Ignore network/server errors during signout
    } finally {
      await setAuthToken(null)
      navigate('/login')
    }
  }

  // Get active page name for mobile top bar
  const allNavItems = navSections.flatMap(s => s.items)
  const activeNavItem = allNavItems.find(item =>
    item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
  )
  const activeTitle = activeNavItem ? activeNavItem.label : (location.pathname.startsWith('/profile') ? 'Profile' : 'ATLAS')

  return (
    <div className="layout">
      {/* ── Background Three.js ATLAS Celestial Armillary Astrolabe ── */}
      <Suspense fallback={null}>
        <AmbientCanvas className="layout-ambient-canvas" />
      </Suspense>

      {/* ── Mobile Top App Bar (Visible on <= 1024px) ── */}
      <header className="mobile-top-bar">
        <div className="mobile-brand-title">
          <span className="mobile-logo-badge">ATLAS</span>
          <span className="mobile-page-divider">/</span>
          <span className="mobile-page-title">{activeTitle}</span>
        </div>
        <div className="mobile-actions-group">
          <ThemeToggle />
          <NavLink to="/profile" className="mobile-profile-btn" aria-label="My Profile">
            <User size={18} />
          </NavLink>
        </div>
      </header>

      {/* ── Mobile "More" Bottom Sheet Overlay & Drawer ── */}
      {mobileSheetOpen && (
        <div
          className="mobile-sheet-overlay"
          onClick={() => setMobileSheetOpen(false)}
        />
      )}

      <div className={`mobile-bottom-sheet ${mobileSheetOpen ? 'open' : ''}`} aria-hidden={!mobileSheetOpen}>
        <div className="mobile-sheet-handle-bar" onClick={() => setMobileSheetOpen(false)}>
          <div className="mobile-sheet-handle" />
        </div>
        <div className="mobile-sheet-header">
          <div>
            <h3 className="mobile-sheet-title">All Applications</h3>
            <p className="mobile-sheet-sub">IIT Bombay Student Operating System</p>
          </div>
          <button
            className="mobile-sheet-close-btn"
            onClick={() => setMobileSheetOpen(false)}
            aria-label="Close sheet"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mobile-sheet-grid">
          {mobileMoreItems.map(({ to, icon: Icon, label, desc }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `mobile-sheet-item ${isActive ? 'active' : ''}`}
              onClick={() => setMobileSheetOpen(false)}
            >
              <div className="mobile-sheet-item-icon">
                <Icon size={18} />
              </div>
              <div className="mobile-sheet-item-content">
                <div className="mobile-sheet-item-title">{label}</div>
                <div className="mobile-sheet-item-desc">{desc}</div>
              </div>
              <ChevronRight size={14} className="mobile-sheet-arrow" />
            </NavLink>
          ))}
        </div>

        <div className="mobile-sheet-footer">
          <div className="mobile-sheet-theme">
            <ThemeToggle showLabel />
          </div>
          <button onClick={handleLogout} className="mobile-sheet-logout-btn">
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* ── Desktop Sidebar (>= 1024px) ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-branding">
            <div className="sidebar-logo-row">
              <span className="logo-symbol">▲</span>
              <h1 className="logo">ATLAS</h1>
              <span className="logo-badge">IITB</span>
            </div>
            <span className="logo-sub">Student Workspace</span>
          </div>
        </div>

        <div className="sidebar-content">
          {navSections.map((section, idx) => (
            <div key={idx} className="sidebar-section">
              {section.title && <div className="sidebar-section-title">{section.title}</div>}
              <nav className="nav-group">
                {section.items.map(({ to, icon: Icon, label, badge }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={17} className="nav-icon" />
                    <span className="nav-label">{label}</span>
                    {badge && <span className="nav-badge">{badge}</span>}
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-theme-row">
            <ThemeToggle showLabel className="sidebar-theme-toggle" />
          </div>
          <NavLink
            to="/profile"
            className={({ isActive }) => `nav-item profile-nav-item ${isActive ? 'active' : ''}`}
          >
            <User size={17} className="nav-icon" />
            <span className="nav-label">Profile & Settings</span>
          </NavLink>
          <button onClick={handleLogout} className="nav-item logout-btn">
            <LogOut size={17} className="nav-icon" />
            <span className="nav-label">Log Out</span>
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

      {/* ── Floating Pomodoro Focus Timer ── */}
      <PomodoroTimer />

      {/* ── Mobile Native Bottom App Dock (Visible on <= 1024px) ── */}
      <nav className="mobile-bottom-dock" aria-label="Mobile Navigation">
        {mobilePrimaryNav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `mobile-dock-btn ${isActive ? 'active' : ''}`}
          >
            <div className="mobile-dock-icon-wrap">
              <Icon size={19} />
            </div>
            <span className="mobile-dock-label">{label}</span>
          </NavLink>
        ))}

        {/* Tactile More Trigger */}
        <button
          type="button"
          className={`mobile-dock-btn more-trigger ${mobileSheetOpen ? 'active' : ''}`}
          onClick={() => setMobileSheetOpen(!mobileSheetOpen)}
          aria-label="More Features"
        >
          <div className="mobile-dock-icon-wrap">
            <MoreHorizontal size={19} />
          </div>
          <span className="mobile-dock-label">More</span>
        </button>
      </nav>

      {/* Toast Notification Container */}
      <ToastHost />
    </div>
  )
}

export default Layout
