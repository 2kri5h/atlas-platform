import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { DOMAINS } from '../utils/helpers'
import './Auth.css'

const getErrorMessage = (detail: any): string => {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item: any) => {
        if (typeof item === 'string') return item
        if (item?.msg) {
          return item.msg.replace(/^Value error,\s*/i, '')
        }
        return JSON.stringify(item)
      })
      .join('. ')
  }
  if (detail && typeof detail === 'object') {
    return detail.msg ? detail.msg.replace(/^Value error,\s*/i, '') : JSON.stringify(detail)
  }
  return 'Registration failed'
}

function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    roll_number: '',
    name: '',
    email: '',
    password: '',
    branch: '',
    year: 1,
    domains: '',
    goals: '',
    weak_subjects: '',
    cpi: 8.0,
    sleep_hours: 7,
    screen_time_hours: 6,
    study_hours_per_week: 20,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/register', form)
      navigate('/login')
    } catch (err: any) {
      setError(getErrorMessage(err.response?.data?.detail))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card register-card">
        <h1>Join ATLAS</h1>
        <p className="auth-subtitle">Create your student account</p>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Roll Number *</label>
              <input
                type="text"
                value={form.roll_number}
                onChange={(e) => setForm({ ...form, roll_number: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Password *</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Branch *</label>
              <input
                type="text"
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
                placeholder="e.g., Computer Science"
                required
              />
            </div>
            <div className="form-group">
              <label>Year</label>
              <select value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Domain Interests</label>
            <select multiple onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions).map(o => o.value)
              setForm({ ...form, domains: selected.join(',') })
            }} className="multi-select">
              {DOMAINS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
            <small>Hold Ctrl/Cmd to select multiple</small>
          </div>
          <div className="form-group">
            <label>Goals (comma-separated)</label>
            <input
              type="text"
              value={form.goals}
              onChange={(e) => setForm({ ...form, goals: e.target.value })}
              placeholder="e.g., placements, research internships"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Weak Subjects</label>
              <input
                type="text"
                value={form.weak_subjects}
                onChange={(e) => setForm({ ...form, weak_subjects: e.target.value })}
                placeholder="e.g., Algorithms, OS"
              />
            </div>
            <div className="form-group">
              <label>CPI *</label>
              <input
                type="number"
                required
                value={form.cpi}
                onChange={(e) => setForm({ ...form, cpi: Number(e.target.value) })}
                min={0}
                max={10}
                step={0.01}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Average Sleep Hours *</label>
              <input
                type="number"
                required
                value={form.sleep_hours}
                onChange={(e) => setForm({ ...form, sleep_hours: Number(e.target.value) })}
                min={0}
                max={24}
                step={0.5}
              />
            </div>
            <div className="form-group">
              <label>Average Screen Time (hrs/day) *</label>
              <input
                type="number"
                required
                value={form.screen_time_hours}
                onChange={(e) => setForm({ ...form, screen_time_hours: Number(e.target.value) })}
                min={0}
                max={24}
                step={0.5}
              />
            </div>
            <div className="form-group">
              <label>Study Hours per Week *</label>
              <input
                type="number"
                required
                value={form.study_hours_per_week}
                onChange={(e) => setForm({ ...form, study_hours_per_week: Number(e.target.value) })}
                min={0}
                max={80}
              />
            </div>
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="primary" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
        <p className="auth-footer">
          Already have an account? <a href="/login">Sign In</a>
        </p>
      </div>
    </div>
  )
}

export default Register
