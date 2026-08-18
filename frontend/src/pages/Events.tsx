import { useState, useEffect } from 'react'
import { Plus, MapPin, Calendar as CalIcon, Archive } from 'lucide-react'
import api from '../utils/api'
import { Event } from '../utils/api'
import { DOMAINS, getDomainBadgeClass, formatDateTime } from '../utils/helpers'
import './Events.css'

function Events() {
  const [events, setEvents] = useState<Event[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('')
  const [form, setForm] = useState({ title: '', description: '', event_date: '', location: '', domain: '', organizer: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEvents()
  }, [showArchived, filter])

  const fetchEvents = async () => {
    try {
      const params = new URLSearchParams({ archived: showArchived ? 'true' : 'false' })
      if (filter) params.append('domain', filter)
      const res = await api.get(`/events/?${params}`)
      setEvents(res.data)
    } catch (err) {
      console.error('Failed to fetch events', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/events/', form)
      setShowForm(false)
      setForm({ title: '', description: '', event_date: '', location: '', domain: '', organizer: '' })
      fetchEvents()
    } catch (err) {
      console.error('Failed to create event', err)
    }
  }

  return (
    <div className="events-page">
      <div className="page-header">
        <div>
          <h1>Events</h1>
          <p>Workshops, talks, and opportunities across campus</p>
        </div>
        <button className="primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} /> Add Event
        </button>
      </div>

      {showForm && (
        <div className="card form-card">
          <h3>Post an Event</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Title *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Domain</label>
                <select value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}>
                  <option value="">Select domain</option>
                  {DOMAINS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Date & Time</label>
                <input type="datetime-local" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Organizer</label>
              <input value={form.organizer} onChange={(e) => setForm({ ...form, organizer: e.target.value })} />
            </div>
            <div className="form-actions">
              <button type="button" className="secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="primary">Post Event</button>
            </div>
          </form>
        </div>
      )}

      <div className="tab-header">
        <div className="filters">
          <button className={`filter-btn ${!filter ? 'active' : ''}`} onClick={() => setFilter('')}>All</button>
          {DOMAINS.map(d => (
            <button key={d.value} className={`filter-btn ${filter === d.value ? 'active' : ''}`} onClick={() => setFilter(d.value)}>
              {d.label}
            </button>
          ))}
        </div>
        <button className={`tab-btn ${showArchived ? 'active' : ''}`} onClick={() => setShowArchived(!showArchived)}>
          <Archive size={16} /> {showArchived ? 'Show Upcoming' : 'Show Archived'}
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : events.length === 0 ? (
        <div className="empty-state">No events found.</div>
      ) : (
        <div className="events-list">
          {events.map(event => (
            <div key={event.id} className="event-card card">
              <div className="event-header">
                {event.domain && <span className={getDomainBadgeClass(event.domain)}>{event.domain.toUpperCase()}</span>}
                {event.is_archived && <span className="archived-badge">Archived</span>}
              </div>
              <h3>{event.title}</h3>
              <p>{event.description}</p>
              <div className="event-meta">
                {event.event_date && (
                  <span><CalIcon size={14} /> {formatDateTime(event.event_date)}</span>
                )}
                {event.location && (
                  <span><MapPin size={14} /> {event.location}</span>
                )}
                {event.organizer && <span>By {event.organizer}</span>}
              </div>
              {(event.slides_link || event.recording_link) && (
                <div className="event-links">
                  {event.slides_link && <a href={event.slides_link} target="_blank" rel="noopener noreferrer">Slides</a>}
                  {event.recording_link && <a href={event.recording_link} target="_blank" rel="noopener noreferrer">Recording</a>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Events