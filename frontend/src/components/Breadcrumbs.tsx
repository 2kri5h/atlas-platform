import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import './Breadcrumbs.css'

const ROUTE_LABELS: Record<string, string> = {
  '': 'Dashboard',
  'planner': 'Timetable & Planner',
  'deadlines': 'Deadlines & Tasks',
  'ai': 'AI Assistant',
  'emails': 'Email Service',
  'resources': 'Resource Library',
  'events': 'Events & Workshops',
  'journeys': 'Senior Journeys',
  'anonymous': 'Anonymous Forum',
  'profile': 'Profile & Settings',
}

export const Breadcrumbs: React.FC = () => {
  const location = useLocation()
  const pathSegments = location.pathname.split('/').filter(Boolean)

  if (pathSegments.length === 0) return null

  return (
    <nav className="breadcrumbs-nav" aria-label="Breadcrumb">
      <ol className="breadcrumbs-list">
        <li className="breadcrumb-item">
          <Link to="/" className="breadcrumb-link" title="Dashboard">
            <Home size={13} />
            <span>Dashboard</span>
          </Link>
        </li>

        {pathSegments.map((segment, index) => {
          const to = `/${pathSegments.slice(0, index + 1).join('/')}`
          const isLast = index === pathSegments.length - 1
          const label = ROUTE_LABELS[segment] || segment.replace(/-/g, ' ')

          return (
            <li key={to} className="breadcrumb-item">
              <ChevronRight size={12} className="breadcrumb-separator" />
              {isLast ? (
                <span className="breadcrumb-current" aria-current="page">
                  {label}
                </span>
              ) : (
                <Link to={to} className="breadcrumb-link">
                  {label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
