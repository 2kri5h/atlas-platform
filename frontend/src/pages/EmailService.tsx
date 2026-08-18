import { useState, useEffect } from 'react'
import { RefreshCw, X, Calendar, Clock, Check } from 'lucide-react'
import api from '../utils/api'
import type { EmailRecord } from '../utils/api'
import './EmailService.css'

export default function EmailService() {
  const [imapEmail, setImapEmail] = useState('')
  const [imapToken, setImapToken] = useState('')
  const [emails, setEmails] = useState<EmailRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [tab, setTab] = useState<'all' | 'events'>('all')
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [comment, setComment] = useState('')

  useEffect(() => {
    async function loadExisting() {
      try {
        const res = await api.get<EmailRecord[]>('/emails/')
        setEmails(res.data)
        setRegistered(true)
      } catch {
        // not registered yet — leave the form showing
      }
    }
    loadExisting()
  }, [])

  async function handleRegister() {
    setLoading(true)
    try {
      await api.post('/emails/register', { imap_email: imapEmail, imap_token: imapToken })
      setRegistered(true)
    } catch (err) {
      alert('Registration failed: ' + err)
    } finally {
      setLoading(false)
    }
  }

  async function handleFetch() {
    setLoading(true)
    try {
      await api.post('/emails/fetch')
      const res = await api.get<EmailRecord[]>('/emails/')
      setEmails(res.data)
    } catch (err) {
      alert('Fetch failed: ' + err)
    } finally {
      setLoading(false)
    }
  }

  async function addToPlanner(ev: any, comment: string) {
    const startTime = ev.event_time || '09:00'
    const [h, m] = startTime.split(':').map(Number)
    const endTime = `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`

    await api.post('/events/', {
      title: ev.title,
      description: `From email: ${ev.emailSubject}`,
      location: ev.location || '',
      date: ev.event_date,
      start_time: startTime,
      end_time: endTime,
      tag: 'IMPORTANT',
      category: 'OTHER',
      is_recurring: false,
      user_comment: comment,
    })
  }

  const allEvents = emails.flatMap((email) =>
    email.events.map((ev) => ({ ...ev, emailSubject: email.subject }))
  )

  return (
    <div className="email-service-page">
      <div className="page-header">
        <h1>IITB Webmail Service</h1>
        <p>Sync circulars, notices, and academic deadlines directly into your ATLAS planner.</p>
      </div>

      {!registered && (
        <div className="email-setup-card">
          <h3>Set up IITB Webmail Sync</h3>
          <p>Enter your LDAP email and app token (stored with AES encryption):</p>
          <div className="email-form-grid">
            <input
              placeholder="e.g. rollnumber@iitb.ac.in"
              value={imapEmail}
              onChange={(e) => setImapEmail(e.target.value)}
            />
            <input
              placeholder="IMAP App Token"
              type="password"
              value={imapToken}
              onChange={(e) => setImapToken(e.target.value)}
            />
          </div>
          <button className="primary" onClick={handleRegister} disabled={loading}>
            {loading ? 'Registering...' : 'Save & Connect Webmail'}
          </button>
        </div>
      )}

      <div className="email-actions-bar">
        <button className="primary" onClick={handleFetch} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          {loading ? 'Syncing...' : 'Sync Emails from IMAP'}
        </button>
        {registered && (
          <button className="secondary" onClick={() => setRegistered(false)}>
            Change Account Credentials
          </button>
        )}
      </div>

      <div className="email-tab-nav">
        <button
          className={`email-tab-btn ${tab === 'all' ? 'active' : ''}`}
          onClick={() => setTab('all')}
        >
          All Notices ({emails.length})
        </button>
        <button
          className={`email-tab-btn ${tab === 'events' ? 'active' : ''}`}
          onClick={() => setTab('events')}
        >
          Extracted Deadlines ({allEvents.length})
        </button>
      </div>

      <div className="email-feed-list">
        {tab === 'all' && (
          emails.length === 0 ? (
            <div className="empty-state">No emails synced yet. Click "Sync Emails from IMAP" above.</div>
          ) : (
            emails.map((email) => (
              <div key={email.id} className="email-feed-card">
                <div className="email-card-header">
                  <span className="email-card-title">{email.subject}</span>
                </div>
                <div className="email-card-meta">
                  <span>{email.sender}</span>
                  <span>•</span>
                  <span>{email.category}</span>
                  <span>•</span>
                  <span>{email.importance}</span>
                </div>
                <p className="email-card-summary">{email.summary}</p>
              </div>
            ))
          )
        )}

        {tab === 'events' && (
          allEvents.length === 0 ? (
            <div className="empty-state">No deadline events extracted from your notices yet.</div>
          ) : (
            allEvents.map((ev) => (
              <div
                key={ev.id}
                className="email-feed-card interactive"
                onClick={() => {
                  setSelected(ev)
                  setEditDate(ev.event_date || '')
                  setEditTime(ev.event_time || '09:00')
                  setComment('')
                }}
              >
                <div className="email-card-header">
                  <span className="email-card-title">{ev.title}</span>
                  <span className="badge">{ev.event_type}</span>
                </div>
                <div className="email-card-meta">
                  <span><Calendar size={12} /> {ev.event_date ?? 'No date detected'}</span>
                  <span><Clock size={12} /> {ev.event_time ?? '09:00'}</span>
                </div>
              </div>
            ))
          )
        )}
      </div>

      {selected && (
        <div className="email-modal-overlay" onClick={() => setSelected(null)}>
          <div className="email-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="email-modal-header">
              <h3 className="email-modal-title">{selected.title}</h3>
              <button className="icon-btn" onClick={() => setSelected(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="form-group">
              <label>Event Date</label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Event Start Time</label>
              <input
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Optional Note / Checkpoint</label>
              <input
                placeholder="e.g. Submit via Moodle"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            <div className="email-modal-footer">
              <button className="secondary" onClick={() => setSelected(null)}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={async () => {
                  if (!editDate) { alert('Please select a date'); return }
                  await addToPlanner({ ...selected, event_date: editDate, event_time: editTime }, comment)
                  setSelected(null)
                  alert('Event successfully added to your Planner!')
                }}
              >
                <Check size={14} /> Add to Planner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}