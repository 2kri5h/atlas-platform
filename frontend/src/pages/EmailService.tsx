import { useState, useEffect } from 'react'
import api from '../utils/api'
import type { EmailRecord } from '../utils/api'

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
    <div style={{ padding: '1.5rem', maxWidth: 700 }}>
      <h2>Email Service</h2>

      {!registered && (
        <div style={{ marginBottom: '1.5rem' }}>
          <input
            placeholder="IMAP email"
            value={imapEmail}
            onChange={(e) => setImapEmail(e.target.value)}
            style={{ display: 'block', marginBottom: 8, width: '100%' }}
          />
          <input
            placeholder="IMAP token"
            type="password"
            value={imapToken}
            onChange={(e) => setImapToken(e.target.value)}
            style={{ display: 'block', marginBottom: 8, width: '100%' }}
          />
          <button onClick={handleRegister} disabled={loading}>
            {loading ? 'Registering...' : 'Set up Email Service'}
          </button>
        </div>
      )}

      <button onClick={handleFetch} disabled={loading}>
        {loading ? 'Fetching...' : 'Fetch Emails'}
      </button>
      {registered && (
        <button onClick={() => setRegistered(false)} style={{ marginLeft: 8 }}>
          Change Email Account
        </button>
      )}      

      <div style={{ marginTop: '1.5rem', borderBottom: '1px solid #ddd' }}>
        <button
          onClick={() => setTab('all')}
          style={{ fontWeight: tab === 'all' ? 'bold' : 'normal', marginRight: 16 }}
        >
          All ({emails.length})
        </button>
        <button
          onClick={() => setTab('events')}
          style={{ fontWeight: tab === 'events' ? 'bold' : 'normal' }}
        >
          Events ({allEvents.length})
        </button>
      </div>

      <div style={{ marginTop: '1rem' }}>
        {tab === 'all' &&
          emails.map((email) => (
            <div key={email.id} style={{ border: '1px solid #ccc', padding: 12, marginBottom: 10 }}>
              <strong>{email.subject}</strong>
              <div style={{ fontSize: 12, color: '#666' }}>
                {email.sender} · {email.category} · {email.importance}
              </div>
              <p>{email.summary}</p>
            </div>
          ))}

        {tab === 'events' &&
          allEvents.map((ev) => (
            <div
              key={ev.id}
              onClick={() => {
                setSelected(ev)
                setEditDate(ev.event_date || '')
                setEditTime(ev.event_time || '09:00')
                setComment('')
              }}
              style={{ border: '1px solid #ccc', padding: 12, marginBottom: 10, cursor: 'pointer' }}
            >
              <strong>{ev.title}</strong>
              <div style={{ fontSize: 12, color: '#666' }}>
                {ev.event_type} · {ev.event_date ?? 'no date'} {ev.event_time ?? ''}
              </div>
            </div>
          ))}

        {selected && (
          <div style={{ position: 'fixed', top: '20%', left: '30%', background: '#fff', border: '1px solid #333', padding: 20, zIndex: 10, width: 320 }}>
            <h3>{selected.title}</h3>

            <label>Date</label>
            <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} style={{ width: '100%', marginBottom: 6 }} />

            <label>Time</label>
            <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} style={{ width: '100%', marginBottom: 6 }} />

            <label>Note</label>
            <input placeholder="Add note" value={comment} onChange={(e) => setComment(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />

            <button onClick={async () => {
              if (!editDate) { alert('Please pick a date'); return }
              await addToPlanner({ ...selected, event_date: editDate, event_time: editTime }, comment)
              setSelected(null)
            }}>Confirm & Add to Planner</button>
            <button onClick={() => setSelected(null)} style={{ marginLeft: 8 }}>Cancel</button>
          </div>
        )}
              </div>
    </div>
  )
}