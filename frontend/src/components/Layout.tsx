import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, Map, CheckSquare,
  Bell, MessageCircle, Bot, User, LogOut, Mail, MoreHorizontal, Compass,
  Timer, Link2, HelpCircle,
  type LucideIcon
} from 'lucide-react'
import { Breadcrumbs } from './Breadcrumbs'
import PomodoroTimer from './PomodoroTimer'
import ThemeToggle from './ThemeToggle'
import { ToastHost } from './Toast'
import { Modal } from './ui'
import api, { setAuthToken } from '../utils/api'
import './Layout.css'

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
      { to: '/quick-links', icon: Link2, label: 'Quick Links', badge: 'Hub' },
      { to: '/ai', icon: Bot, label: 'AI Study Mentor' },
      { to: '/events', icon: Compass, label: 'Campus Events' },
    ]
  },
  {
    title: 'COMMUNITY & SUPPORT',
    items: [
      { to: '/journeys', icon: Map, label: 'Senior Journeys' },
      { to: '/anonymous', icon: MessageCircle, label: 'Anonymous Forum' },
      { to: '/contact', icon: HelpCircle, label: 'Contact Us' },
    ]
  }
]

// Primary items for mobile bottom dock
const mobilePrimaryNav = [
  { to: '/', icon: LayoutDashboard, label: 'Today' },
  { to: '/planner', icon: CheckSquare, label: 'Planner' },
  { to: '/deadlines', icon: Bell, label: 'Tasks' },
]

const mobileMoreSections = [
  {
    title: 'Study',
    items: [
      { to: '/quick-links', icon: Link2, label: 'Quick Links' },
      { to: '/ai', icon: Bot, label: 'AI Mentor' },
      { to: '/resources', icon: BookOpen, label: 'Resources' },
      { to: '/emails', icon: Mail, label: 'Email' },
    ],
  },
  {
    title: 'Campus',
    items: [
      { to: '/events', icon: Compass, label: 'Events' },
      { to: '/journeys', icon: Map, label: 'Journeys' },
      { to: '/anonymous', icon: MessageCircle, label: 'Forum' },
      { to: '/contact', icon: HelpCircle, label: 'Contact Us' },
    ],
  },
  {
    title: 'Account',
    items: [{ to: '/profile', icon: User, label: 'Profile & settings' }],
  },
]

// Pages that manage their own full-width layout
const FULL_WIDTH_ROUTES = ['/ai', '/planner']

function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [focusTimerOpen, setFocusTimerOpen] = useState(false)

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
      '/quick-links': 'Quick Links & Portals — ATLAS',
      '/events': 'Campus Events & Workshops — ATLAS',
      '/journeys': 'Senior Placement Journeys — ATLAS',
      '/anonymous': 'Anonymous Student Portal — ATLAS',
      '/contact': 'Contact Us & Student Help — ATLAS',
      '/profile': 'Profile & Preferences — ATLAS',
    }
    const currentTitle = titles[location.pathname] || 'ATLAS — IIT Bombay Student OS'
    document.title = currentTitle
  }, [location.pathname])

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
      <Modal
        open={mobileSheetOpen}
        onClose={() => setMobileSheetOpen(false)}
        title="More"
        variant="sheet"
        className="mobile-more-sheet"
      >
        <div className="mobile-more-sections">
          {mobileMoreSections.map(section => (
            <section key={section.title} className="mobile-more-section" aria-labelledby={`more-${section.title}`}>
              <h4 id={`more-${section.title}`}>{section.title}</h4>
              <div className="mobile-more-grid">
                {section.items.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) => `mobile-sheet-item ${isActive ? 'active' : ''}`}
                    onClick={() => setMobileSheetOpen(false)}
                  >
                    <span className="mobile-sheet-item-icon"><Icon size={19} /></span>
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="mobile-sheet-footer">
          <button
            type="button"
            className="mobile-sheet-focus-btn"
            onClick={() => {
              setMobileSheetOpen(false)
              setFocusTimerOpen(true)
            }}
          >
            <Timer size={16} /> Focus timer
          </button>
          <ThemeToggle showLabel />
          <button type="button" onClick={handleLogout} className="mobile-sheet-logout-btn">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </Modal>

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
                    aria-label={label}
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
          <button
            type="button"
            className="nav-item"
            onClick={() => setFocusTimerOpen(true)}
            aria-label="Open focus timer"
          >
            <Timer size={17} className="nav-icon" />
            <span className="nav-label">Focus Timer</span>
          </button>
          <div className="sidebar-theme-row">
            <ThemeToggle showLabel className="sidebar-theme-toggle" />
          </div>
          <NavLink
            to="/profile"
            aria-label="Profile and settings"
            className={({ isActive }) => `nav-item profile-nav-item ${isActive ? 'active' : ''}`}
          >
            <User size={17} className="nav-icon" />
            <span className="nav-label">Profile & Settings</span>
          </NavLink>
          <button onClick={handleLogout} className="nav-item logout-btn" aria-label="Log out">
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
      <PomodoroTimer
        open={focusTimerOpen}
        onOpenChange={setFocusTimerOpen}
        showLauncher={false}
      />

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
