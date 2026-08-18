import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Calendar, Map, CheckSquare, MessageCircle, Bot, TrendingUp, Clock, Target } from 'lucide-react'
import api from '../utils/api'
import { Student, BurnoutScore, BurnoutHistoryPoint, Task } from '../utils/api'
import { formatDate } from '../utils/helpers'
import './Dashboard.css'

function Dashboard() {
  const [student, setStudent] = useState<Student | null>(null)
  const [burnout, setBurnout] = useState<BurnoutScore | null>(null)
  const [burnoutHistory, setBurnoutHistory] = useState<BurnoutHistoryPoint[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studentRes, tasksRes] = await Promise.all([
          api.get('/auth/me'),
          api.get('/planner/'),
        ])
        setStudent(studentRes.data)
        setTasks(tasksRes.data.filter((t: Task) => !t.completed).slice(0, 5))
      } catch (err) {
        console.error('Failed to fetch dashboard data', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (!student) return
    // Use GET (no new DB row) to show latest cached burnout score
    const fetchLatestBurnout = async () => {
      try {
        const res = await api.get('/ai/burnout-score/latest')
        if (res.data.exists) {
          setBurnout({
            score: res.data.score,
            ml_score: res.data.ml_score,
            telemetry_score: res.data.telemetry_score,
            risk_level: res.data.risk_level,
            recommendations: [],
            signals: res.data.signals,
          })
        }
      } catch (err) {
        console.error('Failed to fetch latest burnout', err)
      }
    }
    const fetchHistory = async () => {
      try {
        const res = await api.get('/ai/burnout-history?days=14')
        setBurnoutHistory(res.data.history || [])
      } catch (err) {
        console.error('Failed to fetch burnout history', err)
      }
    }
    fetchLatestBurnout()
    fetchHistory()
  }, [student])

  if (loading) return <div className="loading">Loading...</div>

  const riskColor = burnout?.risk_level === 'High' ? '#ef4444' : burnout?.risk_level === 'Medium' ? '#f59e0b' : '#10b981'

  const stats = [
    { icon: CheckSquare, label: 'Active Tasks', value: tasks.length, color: '#4f46e5' },
    {
      icon: TrendingUp,
      label: 'Burnout Risk',
      value: burnout?.risk_level || 'N/A',
      color: riskColor,
    },
    { icon: Clock, label: 'Study Hours/Week', value: student?.study_hours_per_week || 0, color: '#8b5cf6' },
    { icon: Target, label: 'Goals', value: student?.goals?.split(',').length || 0, color: '#06b6d4' },
  ]

  const quickLinks = [
    { to: '/resources', icon: BookOpen, label: 'Browse Resources', desc: 'Find curated learning materials' },
    { to: '/emails?tab=events', icon: Calendar, label: 'Upcoming Events', desc: 'Workshops, talks, and sessions' },
    { to: '/journeys', icon: Map, label: 'Senior Journeys', desc: 'Learn from past experiences' },
    { to: '/anonymous', icon: MessageCircle, label: 'Anonymous Portal', desc: 'Ask questions privately' },
    { to: '/ai', icon: Bot, label: 'AI Assistant', desc: 'Get personalized guidance' },
  ]

  // Build SVG sparkline path from burnout history
  const renderSparkline = () => {
    if (burnoutHistory.length < 2) return null
    const W = 160, H = 36, pad = 4
    const scores = burnoutHistory.map(p => p.score)
    const minS = Math.min(...scores), maxS = Math.max(...scores)
    const range = maxS - minS || 1
    const pts = scores.map((s, i) => {
      const x = pad + (i / (scores.length - 1)) * (W - pad * 2)
      const y = H - pad - ((s - minS) / range) * (H - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
    const latest = scores[scores.length - 1]
    const color = latest > 65 ? '#ef4444' : latest > 40 ? '#f59e0b' : '#10b981'
    return (
      <svg width={W} height={H} style={{ overflow: 'visible' }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dot on latest */}
        {(() => {
          const lastPt = pts.split(' ').pop()!
          const [lx, ly] = lastPt.split(',')
          return <circle cx={lx} cy={ly} r="3" fill={color} />
        })()}
      </svg>
    )
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Welcome back, {student?.name?.split(' ')[0] || 'Student'}!</h1>
        <p>Here's what's happening with your productivity journey</p>
      </div>

      <div className="stats-grid">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="stat-card">
            <div className="stat-icon" style={{ background: `${color}15`, color }}>
              <Icon size={24} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{value}</span>
              <span className="stat-label">{label}</span>
            </div>
          </div>
        ))}
      </div>

      {burnout && burnout.risk_level !== 'Low' && (
        <div className="alert alert-warning">
          <strong>Heads up:</strong> Your burnout risk is {burnout.risk_level.toLowerCase()}. <Link to="/ai">Go to AI Assistant</Link> to check your live signals and get recommendations.
        </div>
      )}

      <div className="dashboard-grid">
        <div className="card">
          <h3>Upcoming Tasks</h3>
          {tasks.length === 0 ? (
            <p className="empty-state">No active tasks. <Link to="/planner">Create one</Link></p>
          ) : (
            <ul className="task-list">
              {tasks.map((task) => (
                <li key={task.id} className="task-item">
                  <span className={`priority priority-${task.priority}`}></span>
                  <div className="task-info">
                    <span className="task-title">{task.title}</span>
                    <span className="task-meta">
                      {task.estimated_hours}h estimated {task.due_date && `· Due ${formatDate(task.due_date)}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link to="/planner" className="view-all">View all tasks</Link>
        </div>

        {/* Enhanced Burnout Widget */}
        {burnout ? (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h3>Burnout Status</h3>
              <Link to="/ai" style={{ fontSize: '12px', color: '#6b7280', textDecoration: 'none' }}>
                Full Assessment →
              </Link>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '10px 0' }}>
              {/* Mini score ring */}
              <svg width="64" height="64" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                <circle
                  cx="32" cy="32" r="26" fill="none"
                  stroke={riskColor} strokeWidth="6"
                  strokeDasharray={2 * Math.PI * 26}
                  strokeDashoffset={2 * Math.PI * 26 - (burnout.score / 100) * 2 * Math.PI * 26}
                  strokeLinecap="round"
                  transform="rotate(-90 32 32)"
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
                <text x="32" y="36" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
                  {burnout.score}%
                </text>
              </svg>
              <div>
                <div style={{ color: riskColor, fontWeight: 700, fontSize: '16px' }}>
                  {burnout.risk_level} Risk
                </div>
                {burnout.signals?.weekly_working_hours != null && (
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                    {burnout.signals.weekly_working_hours.toFixed(1)}h working · {burnout.signals.deadline_pressure > 0 ? `${(burnout.signals.deadline_pressure * 100).toFixed(0)}% deadline load` : 'No deadlines'}
                  </div>
                )}
                {/* Sparkline */}
                <div style={{ marginTop: '6px' }}>
                  {renderSparkline()}
                  {burnoutHistory.length >= 2 && (
                    <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                      14-day trend
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <h3>Quick Actions</h3>
            <div className="quick-links">
              {quickLinks.map(({ to, icon: Icon, label, desc }) => (
                <Link key={to} to={to} className="quick-link">
                  <Icon size={20} />
                  <div>
                    <span className="quick-label">{label}</span>
                    <span className="quick-desc">{desc}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions row (always shown below) */}
      {burnout && (
        <div className="dashboard-grid" style={{ marginTop: '16px' }}>
          <div className="card">
            <h3>Quick Actions</h3>
            <div className="quick-links">
              {quickLinks.map(({ to, icon: Icon, label, desc }) => (
                <Link key={to} to={to} className="quick-link">
                  <Icon size={20} />
                  <div>
                    <span className="quick-label">{label}</span>
                    <span className="quick-desc">{desc}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
