import { useState, useEffect } from 'react'
import { User, Save, RefreshCw, Key, Plus, Trash2, Sun, Moon, Laptop } from 'lucide-react'

import api, { apiKeysAPI, Student, UserAPIKey } from '../utils/api'
import { DOMAINS } from '../utils/helpers'
import ApiKeyVaultModal from '../components/ApiKeyVaultModal'
import { useTheme } from '../context/ThemeContext'
import './Profile.css'

function Profile() {
  const { theme, setTheme } = useTheme()
  const [student, setStudent] = useState<Student | null>(null)
  const [form, setForm] = useState<Partial<Student>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  
  // BYOK Key Vault state
  const [isVaultOpen, setIsVaultOpen] = useState(false)
  const [userKeys, setUserKeys] = useState<UserAPIKey[]>([])

  useEffect(() => {
    fetchProfile()
    fetchKeys()
  }, [])

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

  const fetchKeys = async () => {
    try {
      const res = await apiKeysAPI.getKeys()
      setUserKeys(res.keys)
    } catch (err) {
      console.error('Failed to fetch keys', err)
    }
  }

  const handleDeleteKey = async (provider: string) => {
    if (!confirm(`Remove ${provider.toUpperCase()} API key?`)) return
    try {
      await apiKeysAPI.deleteKey(provider)
      fetchKeys()
    } catch (err) {
      console.error('Failed to delete key', err)
    }
  }

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
        <p>Manage your account, preferences, and AI Key Vault</p>
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

            {/* ── BYOK AI Key Vault Section ── */}
            <div className="form-section key-vault-profile-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Key size={18} color="#a78bfa" /> BYOK AI Key Vault
                </h3>
                <button
                  type="button"
                  onClick={() => setIsVaultOpen(true)}
                  style={{
                    background: 'rgba(124, 92, 252, 0.2)',
                    border: '1px solid #7c5cfc',
                    color: '#a78bfa',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Plus size={14} /> Add / Manage Keys
                </button>
              </div>
              <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 12px' }}>
                Connect your personal API key (Google Gemini, OpenAI, Claude, Grok) for zero-cost AI Mentor chat and email event extraction.
              </p>

              {userKeys.length === 0 ? (
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px dashed rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span>No keys connected yet. Google Gemini free tier key works out-of-the-box.</span>
                  <button
                    type="button"
                    onClick={() => setIsVaultOpen(true)}
                    style={{ background: '#7c5cfc', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Connect Key
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {userKeys.map(k => (
                    <div
                      key={k.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 700, fontSize: '14px', marginRight: '8px' }}>{k.provider.toUpperCase()}</span>
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>Model: {k.model_name || 'Default'}</span>
                        <span style={{ marginLeft: '10px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                          Active & Verified
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteKey(k.provider)}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                        title="Remove key"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Appearance & Theme ── */}
            <div className="form-section appearance-section">
              <h3 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sun size={18} color="var(--primary)" /> Appearance & Theme
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 12px' }}>
                Customize your visual interface experience.
              </p>
              <div className="theme-options-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: theme === 'dark' ? 'var(--primary-light)' : 'var(--surface-subtle)',
                    border: `1.5px solid ${theme === 'dark' ? 'var(--primary)' : 'var(--border)'}`,
                    color: theme === 'dark' ? 'var(--primary)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Moon size={20} />
                  <span>Dark Mode</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: theme === 'light' ? 'var(--primary-light)' : 'var(--surface-subtle)',
                    border: `1.5px solid ${theme === 'light' ? 'var(--primary)' : 'var(--border)'}`,
                    color: theme === 'light' ? 'var(--primary)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Sun size={20} />
                  <span>Light Mode</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('system')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: theme === 'system' ? 'var(--primary-light)' : 'var(--surface-subtle)',
                    border: `1.5px solid ${theme === 'system' ? 'var(--primary)' : 'var(--border)'}`,
                    color: theme === 'system' ? 'var(--primary)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Laptop size={20} />
                  <span>System Default</span>
                </button>
              </div>
            </div>

            {message && <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>{message}</div>}


            <button type="submit" className="primary" disabled={saving}>
              <Save size={18} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>

      {/* ── Key Vault Modal ── */}
      <ApiKeyVaultModal
        isOpen={isVaultOpen}
        onClose={() => {
          setIsVaultOpen(false)
          fetchKeys()
        }}
        onKeyUpdated={fetchKeys}
      />
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
