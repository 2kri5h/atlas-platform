import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, BookOpen, Calendar, Map, CheckSquare, Bell, MessageCircle, Bot, User, LogOut, Mail } from 'lucide-react'
import './Layout.css'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/resources', icon: BookOpen, label: 'Resources' },
  { to: '/events', icon: Calendar, label: 'Events' },
  { to: '/journeys', icon: Map, label: 'Journeys' },
  { to: '/planner', icon: CheckSquare, label: 'Planner' },
  { to: '/deadlines', icon: Bell, label: 'Deadlines' },
  { to: '/anonymous', icon: MessageCircle, label: 'Anonymous' },
  { to: '/ai', icon: Bot, label: 'AI Assistant' },
  { to: '/emails', icon: Mail, label: 'Email Service' },
]

// Pages that manage their own full-width layout
const FULL_WIDTH_ROUTES = ['/ai']

function Layout() {
  const navigate = useNavigate()
  const location = useLocation()

  const isFullWidth = FULL_WIDTH_ROUTES.some(r => location.pathname.startsWith(r))

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="logo">ATLAS</h1>
          <span className="logo-sub">IIT Bombay</span>
        </div>
        <nav className="nav">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }: { isActive: boolean }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <NavLink to="/profile" className="nav-item">
            <User size={20} />
            <span>Profile</span>
          </NavLink>
          <button onClick={handleLogout} className="nav-item logout-btn">
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
      <main className="main-content">
        {isFullWidth ? (
          <Outlet />
        ) : (
          <div className="container">
            <Outlet />
          </div>
        )}
      </main>
    </div>
  )
}

export default Layout
