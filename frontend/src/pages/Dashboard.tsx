import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Calendar, Map, CheckSquare, MessageCircle, Bot, TrendingUp, Clock, Target } from 'lucide-react'
import api from '../utils/api'
import { Student, BurnoutScore, BurnoutHistoryPoint, Task } from '../utils/api'
import { formatDate } from '../utils/helpers'
import { FAQSection } from '../components/FAQSection'
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
    const W = 170, H = 36, pad = 5
    const scores = burnoutHistory.map(p => p.score)
    const latest = scores[scores.length - 1]
    const first = scores[0]
    const diff = latest - first
    
    // Normalize range with a minimum span of 20 so small differences don't become huge cliffs
    const dataMin = Math.min(...scores)
    const dataMax = Math.max(...scores)
    const mid = (dataMin + dataMax) / 2
    const minS = Math.max(0, Math.min(dataMin - 4, mid - 12))
    const maxS = Math.min(100, Math.max(dataMax + 4, mid + 12))
    const range = maxS - minS || 1

    const coords = scores.map((s, i) => {
      const x = pad + (i / (scores.length - 1)) * (W - pad * 2)
      const y = H - pad - ((s - minS) / range) * (H - pad * 2)
      return { x, y }
    })

    const pts = coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
    const areaPath = `M ${coords[0].x.toFixed(1)},${H - pad} L ${pts} L ${coords[coords.length - 1].x.toFixed(1)},${H - pad} Z`
    
    const color = latest > 65 ? '#ef4444' : latest > 40 ? '#f59e0b' : '#10b981'
    const gradId = `burnout-spark-grad-${latest > 65 ? 'high' : latest > 40 ? 'med' : 'low'}`

    return (
      <div className="burnout-sparkline-wrap">
        <svg width={W} height={H} className="burnout-sparkline-svg">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradId})`} />
          <polyline points={pts} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={coords[0].x} cy={coords[0].y} r="2.5" fill={color} opacity="0.6" />
          <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="3.5" fill={color} />
        </svg>
        <div className="burnout-sparkline-meta">
          <span className="sparkline-trend-label">14-day trend</span>
          <span className="sparkline-trend-diff" style={{ color: diff <= 0 ? 'var(--success)' : 'var(--warning)' }}>
            {Math.abs(diff) < 0.2 ? 'Stable' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}% ${diff > 0 ? '↑' : '↓'}`}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Welcome back, {student?.name?.split(' ')[0] || 'Student'}!</h1>
        <p>Here's what's happening with your productivity journey</p>
      </div>

      <div className="dashboard-hero-cta">
        <div className="dashboard-hero-content">
          <div className="dashboard-promise-pill">
            <span className="pulse-dot"></span>
            <span>⚡ Instant AI Mentorship • 🔄 Real-time IITB Sync Active</span>
          </div>
          <h2>Plan Smarter, Study Calmer</h2>
          <p>Manage your weekly course slots, track assignments, prevent burnout, and learn from graduating IITB seniors.</p>
        </div>
        <div className="dashboard-hero-buttons">
          <Link to="/planner" className="primary-btn hero-cta-btn">
            <Calendar size={15} /> Weekly Timetable
          </Link>
          <Link to="/deadlines" className="secondary-btn hero-cta-btn">
            <CheckSquare size={15} /> Deadlines Board
          </Link>
          <Link to="/ai" className="secondary-btn hero-cta-btn">
            <Bot size={15} /> Ask AI Mentor
          </Link>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="stat-card">
            <div className="stat-icon" style={{ background: `${color}15`, color }}>
              <Icon size={22} />
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
          <h3>Upcoming Deadlines & Tasks</h3>
          {tasks.length === 0 ? (
            <p className="empty-state">No pending tasks. You're all caught up!</p>
          ) : (
            <ul className="task-list">
              {tasks.map(task => (
                <li key={task.id} className="task-item">
                  <div className={`priority priority-${task.priority}`} />
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
          <div className="card burnout-widget-card">
            <div className="burnout-widget-header">
              <div className="burnout-widget-title-group">
                <div className="burnout-widget-icon" style={{ color: riskColor, background: `${riskColor}15` }}>
                  <TrendingUp size={16} />
                </div>
                <h3>Burnout Status</h3>
              </div>
              <Link to="/ai" className="burnout-widget-link">
                Full Assessment →
              </Link>
            </div>
            
            <div className="burnout-widget-body">
              {/* Mini score ring */}
              <div className="burnout-ring-wrapper">
                <svg width="68" height="68" viewBox="0 0 68 68" className="burnout-ring-svg">
                  <circle cx="34" cy="34" r="28" fill="none" stroke="var(--surface-hover)" strokeWidth="6" />
                  <circle
                    cx="34" cy="34" r="28" fill="none"
                    stroke={riskColor} strokeWidth="6"
                    strokeDasharray={2 * Math.PI * 28}
                    strokeDashoffset={2 * Math.PI * 28 - (Math.min(100, Math.max(0, burnout.score)) / 100) * 2 * Math.PI * 28}
                    strokeLinecap="round"
                    transform="rotate(-90 34 34)"
                    style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}
                  />
                  <text x="34" y="39" textAnchor="middle" fill="var(--text-primary)" fontSize="13" fontWeight="700" fontFamily="system-ui, -apple-system, sans-serif">
                    {Math.round(burnout.score)}%
                  </text>
                </svg>
              </div>

              <div className="burnout-info-group">
                <div className="burnout-risk-row">
                  <span className="burnout-risk-title" style={{ color: riskColor }}>
                    {burnout.risk_level} Risk
                  </span>
                  <span className="burnout-risk-tag" style={{ background: `${riskColor}18`, color: riskColor, borderColor: `${riskColor}33` }}>
                    {burnout.score < 30 ? 'Optimal' : burnout.score < 65 ? 'Moderate' : 'Elevated'}
                  </span>
                </div>

                {burnout.signals?.weekly_working_hours != null && (
                  <div className="burnout-signals-summary">
                    {burnout.signals.weekly_working_hours.toFixed(1)}h working · {burnout.signals.deadline_pressure > 0 ? `${Math.round(burnout.signals.deadline_pressure * 100)}% deadline load` : 'No deadlines'}
                  </div>
                )}

                {/* Sparkline */}
                {renderSparkline()}
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

      {/* ── 5 IIT Bombay FAQs & Knowledge Center ── */}
      <FAQSection />
    </div>
  )
}

export default Dashboard
