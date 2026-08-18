import { useState, useEffect } from 'react'
import { User, Save, RefreshCw } from 'lucide-react'
import api from '../utils/api'
import { Student } from '../utils/api'
import { DOMAINS } from '../utils/helpers'
import './Profile.css'

function Profile() {
  const [student, setStudent] = useState<Student | null>(null)
  const [form, setForm] = useState<Partial<Student>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/auth/me')
        setStudent(res.data)
        setForm(res.data)
      } catch (err) {
        console.error('Failed to fetch profile', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const res = await api.put('/auth/me', form)
      setStudent(res.data)
      setMessage('Profile updated successfully!')
    } catch (err) {
      setMessage('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field: string, value: string | number) => {
    setForm({ ...form, [field]: value })
  }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="profile-page">
      <div className="page-header">
        <h1>Profile</h1>
        <p>Manage your account and preferences</p>
      </div>

      <div className="profile-content">
        <div className="card profile-card">
          <div className="profile-header">
            <div className="avatar">
              <User size={40} />
            </div>
            <div>
              <h2>{student?.name}</h2>
              <span className="roll-number">{student?.roll_number}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-section">
              <h3>Personal Information</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Name</label>
                  <input type="text" value={form.name || ''} onChange={(e) => handleChange('name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={form.email || ''} onChange={(e) => handleChange('email', e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Branch</label>
                  <input type="text" value={form.branch || ''} onChange={(e) => handleChange('branch', e.target.value)} placeholder="e.g., Computer Science" />
                </div>
                <div className="form-group">
                  <label>Year</label>
                  <select value={form.year || 1} onChange={(e) => handleChange('year', Number(e.target.value))}>
                    {[1, 2, 3, 4, 5].map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Academic Goals</h3>
              <div className="form-group">
                <label>Domain Interests</label>
                <select multiple onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map(o => o.value)
                  handleChange('domains', selected.join(','))
                }} value={form.domains?.split(',') || []} className="multi-select">
                  {DOMAINS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
                <small>Hold Ctrl/Cmd to select multiple</small>
              </div>
              <div className="form-group">
                <label>Goals (comma-separated)</label>
                <input type="text" value={form.goals || ''} onChange={(e) => handleChange('goals', e.target.value)} placeholder="e.g., placements, research internships" />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Weak Subjects</label>
                  <input
                    type="text"
                    value={form.weak_subjects || ''}
                    onChange={(e) => handleChange('weak_subjects', e.target.value)}
                    placeholder="e.g., Algorithms, OS"
                  />
                </div>

                <div className="form-group">
                  <label>Current CPI</label>
                  <input
                    type="number"
                    value={form.cpi || 0}
                    onChange={(e) => handleChange('cpi', Number(e.target.value))}
                    min={0}
                    max={10}
                    step={0.01}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Average Sleep (hrs/day)</label>
                  <input
                    type="number"
                    value={form.sleep_hours || 0}
                    onChange={(e) => handleChange('sleep_hours', Number(e.target.value))}
                    min={0}
                    max={24}
                    step={0.5}
                  />
                </div>

                <div className="form-group">
                  <label>Average Screen Time (hrs/day)</label>
                  <input
                    type="number"
                    value={form.screen_time_hours || 0}
                    onChange={(e) => handleChange('screen_time_hours', Number(e.target.value))}
                    min={0}
                    max={24}
                    step={0.5}
                  />
                </div>
              </div>

              <StudyHoursPicker
                value={form.study_hours_per_week || 0}
                onChange={(val) => handleChange('study_hours_per_week', val)}
              />
            </div>

            {message && <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>{message}</div>}

            <button type="submit" className="primary" disabled={saving}>
              <Save size={18} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Profile


// ── StudyHoursPicker ───────────────────────────────────────────────────────────
function StudyHoursPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (val: number) => void
}) {
  const [mode, setMode] = useState<'auto' | 'manual'>('manual')
  const [autoSource, setAutoSource] = useState<string>('')
  const [autoHours, setAutoHours] = useState<number | null>(null)
  const [autoLoading, setAutoLoading] = useState(false)
  const [autoError, setAutoError] = useState('')

  useEffect(() => {
    fetchAutoHours()
  }, [])

  const fetchAutoHours = async () => {
    setAutoLoading(true)
    setAutoError('')
    try {
      const res = await api.get('/ai/working-hours')
      const hrs = parseFloat((res.data.weekly_working_hours as number).toFixed(1))
      setAutoHours(hrs)
      setAutoSource(res.data.source)
      if (mode === 'auto') onChange(hrs)
    } catch {
      setAutoError('Could not load planner data. Make sure the backend is running.')
    } finally {
      setAutoLoading(false)
    }
  }

  const handleModeSwitch = (newMode: 'auto' | 'manual') => {
    setMode(newMode)
    if (newMode === 'auto' && autoHours !== null) {
      onChange(autoHours)
    }
  }

  const labelStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    border: `1.5px solid ${active ? 'var(--primary, #6366f1)' : 'rgba(255,255,255,0.12)'}`,
    background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
    color: active ? 'var(--primary, #6366f1)' : '#9ca3af',
    transition: 'all 0.15s ease',
    userSelect: 'none',
  })

  return (
    <div className="form-group">
      <label>Study / Working Hours per Week</label>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <span style={labelStyle(mode === 'auto')} onClick={() => handleModeSwitch('auto')}>
          📡 Auto (from Planner)
        </span>
        <span style={labelStyle(mode === 'manual')} onClick={() => handleModeSwitch('manual')}>
          ✏️ Enter Manually
        </span>
      </div>

      {mode === 'auto' ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 14px', borderRadius: '10px',
          background: 'rgba(99,102,241,0.08)',
          border: '1.5px solid rgba(99,102,241,0.2)',
        }}>
          {autoLoading ? (
            <span style={{ color: '#9ca3af', fontSize: '13px' }}>Loading from Planner...</span>
          ) : autoError ? (
            <span style={{ color: '#f59e0b', fontSize: '13px' }}>{autoError}</span>
          ) : (
            <>
              <span style={{ fontSize: '22px', fontWeight: 700, color: '#6366f1' }}>
                {autoHours ?? '—'}h
              </span>
              <span style={{ fontSize: '12px', color: '#9ca3af', flex: 1 }}>
                calculated from {autoSource || 'your last 7 days of working-hour Planner events'}
              </span>
            </>
          )}
          <button
            type="button"
            title="Refresh from Planner"
            onClick={fetchAutoHours}
            disabled={autoLoading}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#6366f1', padding: '4px', display: 'flex',
            }}
          >
            <RefreshCw size={15} className={autoLoading ? 'spinning' : ''} />
          </button>
        </div>
      ) : (
        <input
          type="number"
          value={value || 0}
          onChange={(e) => onChange(Number(e.target.value))}
          min={0}
          max={100}
          step={0.5}
          placeholder="e.g. 35"
        />
      )}

      <small style={{ color: '#6b7280', marginTop: '4px', display: 'block' }}>
        {mode === 'auto'
          ? 'This value is saved to your profile and used as a fallback when no planner data is available.'
          : 'Used by the AI burnout assessment when no Planner data exists for the current week.'}
      </small>
    </div>
  )
}
