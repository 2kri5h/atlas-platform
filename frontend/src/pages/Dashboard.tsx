import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Calendar, CheckSquare, Clock, Target, TrendingUp } from 'lucide-react'
import {
  dashboardAPI,
  type BurnoutScore,
  type Student,
  type Task,
  type TodayDashboardData,
} from '../utils/api'
import { ErrorState, LoadingState } from '../components/ui'
import { formatDate } from '../utils/helpers'
import './Dashboard.css'

interface DeadlineEvent {
  id: number
  title: string
  deadline_date?: string
  deadline_label?: string
}

interface ConflictWarning {
  date?: string
  message: string
}

function Dashboard() {
  const [student, setStudent] = useState<Student | null>(null)
  const [burnout, setBurnout] = useState<BurnoutScore | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [nextDeadline, setNextDeadline] = useState<DeadlineEvent | null>(null)
  const [conflicts, setConflicts] = useState<ConflictWarning[]>([])
  const [today, setToday] = useState<TodayDashboardData | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    const loadDashboard = async () => {
      setLoading(true)
      setError(false)
      try {
        const overview = await dashboardAPI.getOverview()
        if (!active) return
        setToday(overview.today)
        setStudent(overview.student)
        setTasks(overview.tasks)
        setNextDeadline(overview.next_deadline)
        setConflicts(overview.conflicts)
        setBurnout(overview.burnout.exists
          ? { ...overview.burnout, recommendations: [] }
          : null)
      } catch {
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadDashboard()
    return () => { active = false }
  }, [reloadKey])

  if (loading) return <LoadingState label="Loading your day" />
  if (error) {
    return (
      <ErrorState
        message="Your dashboard could not be loaded. Check your connection and try again."
        onRetry={() => setReloadKey(value => value + 1)}
      />
    )
  }

  const firstName = student?.name?.split(' ')[0] || 'Student'
  const nextClass = today?.timetable?.[0]
  const deadlineSummary = nextDeadline?.deadline_label
    || (nextDeadline?.deadline_date ? `Due ${formatDate(nextDeadline.deadline_date)}` : 'Nothing due soon')
  const wellbeingSummary = burnout ? `${burnout.risk_level} risk` : 'Check in when ready'

  return (
    <div className={`dashboard ${showDetails ? 'show-details' : ''}`}>
      <header className="dashboard-header">
        <div>
          <p className="dashboard-date">
            {new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
          </p>
          <h1>Welcome back, {firstName}</h1>
          <p>Here is what needs your attention today.</p>
        </div>
        <Link to="/planner" className="primary-btn dashboard-primary-action">
          <Calendar size={16} /> Open planner
        </Link>
      </header>

      <section className="today-priority-grid" aria-label="Today at a glance">
        <Link to="/planner" className="today-priority-item">
          <Clock size={19} aria-hidden="true" />
          <span>
            <small>Up next</small>
            <strong>{nextClass?.title || 'No classes scheduled'}</strong>
            <em>{nextClass ? `${nextClass.start_time}-${nextClass.end_time}` : 'Your calendar is clear'}</em>
          </span>
        </Link>
        <Link to="/deadlines" className="today-priority-item">
          <Target size={19} aria-hidden="true" />
          <span>
            <small>Nearest deadline</small>
            <strong>{nextDeadline?.title || 'Nothing due soon'}</strong>
            <em>{deadlineSummary}</em>
          </span>
        </Link>
        <Link to="/ai" className="today-priority-item">
          <TrendingUp size={19} aria-hidden="true" />
          <span>
            <small>Wellbeing</small>
            <strong>{wellbeingSummary}</strong>
            <em>{burnout ? 'Review your workload signals' : 'No recent assessment'}</em>
          </span>
        </Link>
      </section>

      <button
        type="button"
        className="dashboard-details-toggle"
        onClick={() => setShowDetails(value => !value)}
        aria-expanded={showDetails}
        aria-controls="dashboard-details"
      >
        {showDetails ? 'Hide details' : 'View details'}
      </button>

      <div id="dashboard-details" className="dashboard-details">
        {conflicts.length > 0 && (
          <details className="dashboard-conflicts">
            <summary>
              <AlertCircle size={17} />
              {conflicts.length} schedule conflict{conflicts.length === 1 ? '' : 's'} to review
            </summary>
            <ul>
              {conflicts.slice(0, 3).map((conflict, index) => (
                <li key={`${conflict.date || 'conflict'}-${index}`}>{conflict.message}</li>
              ))}
            </ul>
            <Link to="/planner">Review in Planner</Link>
          </details>
        )}

        <div className="dashboard-sections">
          <section className="dashboard-section">
            <div className="dashboard-section-header">
              <div>
                <p>Schedule</p>
                <h2>Today</h2>
              </div>
              <Link to="/planner">Open planner</Link>
            </div>
            {!today?.timetable.length ? (
              <p className="dashboard-empty">No classes or blocks scheduled.</p>
            ) : (
              <ul className="dashboard-list">
                {today.timetable.slice(0, 5).map(block => (
                  <li key={block.id}>
                    <span className="dashboard-list-icon"><Clock size={16} /></span>
                    <span>
                      <strong>{block.title}</strong>
                      <small>
                        {block.start_time}-{block.end_time}
                        {block.location ? `, ${block.location}` : ''}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="dashboard-section">
            <div className="dashboard-section-header">
              <div>
                <p>Tasks</p>
                <h2>Due soon</h2>
              </div>
              <Link to="/deadlines">View tasks</Link>
            </div>
            {tasks.length === 0 ? (
              <p className="dashboard-empty">No pending tasks. You are caught up.</p>
            ) : (
              <ul className="dashboard-list">
                {tasks.slice(0, 5).map(task => (
                  <li key={task.id}>
                    <span className="dashboard-list-icon"><CheckSquare size={16} /></span>
                    <span>
                      <strong>{task.title}</strong>
                      <small>
                        {task.due_date ? `Due ${formatDate(task.due_date)}` : 'No due date'}
                        {task.estimated_hours ? `, ${task.estimated_hours}h estimated` : ''}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
