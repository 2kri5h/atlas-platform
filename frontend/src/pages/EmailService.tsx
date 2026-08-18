import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../utils/api'
import type { EmailRecord } from '../utils/api'
import './EmailService.css'
import { 
  Clock, 
  Sparkles, 
  RefreshCw, 
  Flame, 
  BookmarkCheck,
  Search,
  Mail,
  ChevronDown,
  ChevronUp,
  Inbox
} from 'lucide-react'

export default function EmailService() {
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') === 'events' ? 'events' : 'all'

  const [imapEmail, setImapEmail] = useState('')
  const [imapToken, setImapToken] = useState('')
  const [emails, setEmails] = useState<EmailRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [tab, setTab] = useState<'all' | 'events'>(initialTab)
  
  // Sync tab with URL query parameter changes
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'events') {
      setTab('events')
    } else if (tabParam === 'all') {
      setTab('all')
    }
  }, [searchParams])
  
  // Filtering & Search
  const [eventCategoryFilter, setEventCategoryFilter] = useState<string>('ALL')
  const [eventSearch, setEventSearch] = useState<string>('')
  const [emailSearch, setEmailSearch] = useState<string>('')
  const [emailCategoryFilter, setEmailCategoryFilter] = useState<string>('ALL')
  
  // Expanded email body
  const [expandedEmailIds, setExpandedEmailIds] = useState<Set<any>>(new Set())

  // Modal Edit States
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [comment, setComment] = useState('')
  const [isDeadline, setIsDeadline] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadExisting() {
      try {
        const res = await api.get<EmailRecord[]>('/emails/')
        setEmails(res.data)
        setRegistered(true)
      } catch {
        // not registered yet
      }
    }
    loadExisting()
  }, [])

  function showToast(msg: string) {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const toggleExpandEmail = (id: any) => {
    setExpandedEmailIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleRegister() {
    setLoading(true)
    try {
      await api.post('/emails/register', { imap_email: imapEmail, imap_token: imapToken })
      setRegistered(true)
      showToast('Email account connected successfully!')
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
      showToast('Emails updated!')
    } catch (err) {
      alert('Fetch failed: ' + err)
    } finally {
      setLoading(false)
    }
  }

  async function addToPlanner(ev: any, comment: string, asDeadline?: boolean) {
    const deadlineFlag =
      asDeadline ??
      (ev.event_type?.toLowerCase() === 'deadline' ||
        ev.category?.toLowerCase() === 'deadline' ||
        ev.title?.toLowerCase().includes('deadline') ||
        ev.title?.toLowerCase().includes('assignment'))

    const rawTime = editTime || ev.event_time || '09:00'
    const parts = rawTime.split(':')
    let h = parseInt(parts[0] || '9', 10)
    let m = parseInt(parts[1] || '0', 10)

    let startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    let endTime: string

    if (deadlineFlag) {
      if (h === 23 && m === 59) {
        startTime = '23:58'
        endTime = '23:59'
      } else {
        const nextM = (m + 1) % 60
        const nextH = m === 59 ? Math.min(23, h + 1) : h
        endTime = `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`
      }
    } else {
      if (h >= 23) {
        startTime = '23:00'
        endTime = '23:59'
      } else {
        endTime = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      }
    }

    const eventDate = editDate || ev.event_date || new Date().toISOString().split('T')[0]
    const title = ev.title || (deadlineFlag ? 'Untitled Deadline' : 'Untitled Event')
    const description = comment
      ? `${comment} (From email)`
      : `From email: ${ev.emailSubject || ''}`

    try {
      await api.post('/events/', {
        title,
        description,
        location: ev.location || '',
        date: eventDate,
        start_time: startTime,
        end_time: endTime,
        tag: deadlineFlag ? 'CRITICAL' : 'IMPORTANT',
        category: deadlineFlag ? 'CLASS' : 'OTHER',
        is_working_hour: true,
        is_recurring: false,
        user_comment: comment || '',
        ...(deadlineFlag && {
          deadline_date: eventDate,
          deadline_label: title,
        }),
      })

      showToast(deadlineFlag ? 'Added to Deadlines!' : 'Added to Planner!')
      setSelected(null)
    } catch (err: any) {
      const detail = err.response?.data?.detail
      console.error('API Error:', detail)
      alert(`Failed to add: ${JSON.stringify(detail || err.message)}`)
    }
  }

  const allEvents = useMemo(() => {
    return emails.flatMap((email) =>
      (email.events || []).map((ev) => ({ ...ev, emailSubject: email.subject }))
    )
  }, [emails])

  const filteredEvents = useMemo(() => {
    return allEvents.filter(ev => {
      const matchesSearch = !eventSearch.trim() || 
        ev.title?.toLowerCase().includes(eventSearch.toLowerCase()) ||
        ev.emailSubject?.toLowerCase().includes(eventSearch.toLowerCase())

      const type = (ev.event_type || 'OTHER').toUpperCase()
      const matchesCat = eventCategoryFilter === 'ALL' || type === eventCategoryFilter

      return matchesSearch && matchesCat
    })
  }, [allEvents, eventSearch, eventCategoryFilter])

  const filteredEmails = useMemo(() => {
    return emails.filter(em => {
      const matchesSearch = !emailSearch.trim() ||
        em.subject?.toLowerCase().includes(emailSearch.toLowerCase()) ||
        em.sender?.toLowerCase().includes(emailSearch.toLowerCase()) ||
        em.summary?.toLowerCase().includes(emailSearch.toLowerCase())

      const cat = (em.category || 'OTHER').toUpperCase()
      const matchesCat = emailCategoryFilter === 'ALL' || cat === emailCategoryFilter

      return matchesSearch && matchesCat
    })
  }, [emails, emailSearch, emailCategoryFilter])

  // Extract a clean display date directly from email data
  const formatEmailDate = (email: EmailRecord) => {
    const raw =
      email.email_date ||
      email.received_at ||
      email.date_received ||
      email.date ||
      email.created_at ||
      email.timestamp

    if (!raw) return ''

    try {
      const d = new Date(raw)
      if (isNaN(d.getTime())) return ''

      const hasTime = typeof raw === 'string' && (raw.includes(':') || raw.includes('T'))
      return d.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        ...(hasTime && { hour: '2-digit', minute: '2-digit' }),
      })
    } catch {
      return ''
    }
  }

  const getEventTypeMeta = (typeRaw?: string) => {
    const type = (typeRaw || 'OTHER').toUpperCase()
    switch (type) {
      case 'DEADLINE':
        return { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca', badge: 'Deadline' }
      case 'WORKSHOP':
        return { bg: '#f3e8ff', color: '#7e22ce', border: '#e9d5ff', badge: 'Workshop' }
      case 'TALK':
        return { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd', badge: 'Talk' }
      case 'EVENT':
        return { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0', badge: 'Event' }
      default:
        return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', badge: typeRaw || 'General' }
    }
  }

  const formatEventDate = (dateStr?: string) => {
    if (!dateStr) return { month: 'TBD', day: '--', dayName: '', relative: '' }
    const parts = dateStr.split('T')[0].split('-')
    if (parts.length !== 3) return { month: 'TBD', day: '--', dayName: '', relative: '' }
    
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
    const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
    const day = d.getDate().toString().padStart(2, '0')
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffDays = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    let relative = ''
    if (diffDays < 0) relative = `${Math.abs(diffDays)}d ago`
    else if (diffDays === 0) relative = 'Today'
    else if (diffDays === 1) relative = 'Tomorrow'
    else if (diffDays <= 7) relative = `In ${diffDays} days`

    return { month, day, dayName, relative, diffDays }
  }

  const getImportanceColor = (importance?: string) => {
    const imp = importance?.toLowerCase()
    if (imp === 'high' || imp === 'critical') return '#ef4444'
    if (imp === 'medium') return '#f59e0b'
    return '#cbd5e1'
  }

  const getCategoryBadge = (category?: string) => {
    const cat = category?.toLowerCase()
    if (cat === 'academic' || cat === 'class') return { bg: '#eef2ff', color: '#4338ca' }
    if (cat === 'event') return { bg: '#ecfdf5', color: '#047857' }
    if (cat === 'placement') return { bg: '#fffbeb', color: '#b45309' }
    if (cat === 'administrative') return { bg: '#f8fafc', color: '#475569' }
    return { bg: '#f8fafc', color: '#475569' }
  }

  return (
    <div className="email-service-container">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="email-toast">
          <span className="email-toast-check">✓</span> {toastMessage}
        </div>
      )}

      {/* Header Bar */}
      <div className="email-header-bar">
        <div>
          <div className="email-header-branding">
            <h1 className="email-header-title">Email Service</h1>
            <span className="email-header-badge">IITB Webmail</span>
          </div>
          <p className="email-header-subtitle">
            Campus updates, summaries, and extracted planner events
          </p>
        </div>

        <div className="email-header-actions">
          <button
            onClick={handleFetch}
            disabled={loading}
            className="email-sync-btn"
          >
            <RefreshCw size={15} className={loading ? 'spinning' : ''} />
            {loading ? 'Syncing...' : 'Fetch Emails'}
          </button>
          
          {registered && (
            <button
              onClick={() => setRegistered(false)}
              className="email-account-btn"
            >
              Account
            </button>
          )}
        </div>
      </div>

      {/* Registration Form */}
      {!registered && (
        <div className="email-setup-box">
          <h3>Connect IITB Webmail</h3>
          <input
            placeholder="IMAP email (e.g. rollnumber@iitb.ac.in)"
            value={imapEmail}
            onChange={(e) => setImapEmail(e.target.value)}
            className="email-setup-input"
          />
          <input
            placeholder="IMAP token / App Password"
            type="password"
            value={imapToken}
            onChange={(e) => setImapToken(e.target.value)}
            className="email-setup-input"
          />
          <button
            onClick={handleRegister}
            disabled={loading}
            className="email-setup-submit"
          >
            {loading ? 'Registering...' : 'Connect Webmail'}
          </button>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className="email-nav-tabs">
        <button
          onClick={() => setTab('all')}
          className={`email-nav-tab ${tab === 'all' ? 'active' : ''}`}
        >
          <Mail size={16} />
          <span>All Emails</span>
          <span className="email-nav-tab-count">
            {emails.length}
          </span>
        </button>

        <button
          onClick={() => setTab('events')}
          className={`email-nav-tab ${tab === 'events' ? 'active' : ''}`}
        >
          <Sparkles size={16} />
          <span>Extracted Events</span>
          <span className="email-nav-tab-count">
            {allEvents.length}
          </span>
        </button>
      </div>

      {/* ───────────────── TAB 1: ALL EMAILS (CLEAN & RESPONSIVE) ───────────────── */}
      {tab === 'all' && (
        <div>
          {/* Sub-toolbar */}
          <div className="email-toolbar">
            <div className="email-search-wrapper">
              <Search size={16} className="email-search-icon" />
              <input
                type="text"
                placeholder="Search emails..."
                value={emailSearch}
                onChange={e => setEmailSearch(e.target.value)}
                className="email-search-input"
              />
            </div>

            <div className="email-filter-pills">
              {['ALL', 'ACADEMIC', 'EVENT', 'PLACEMENT', 'ADMINISTRATIVE'].map(cat => {
                const isActive = emailCategoryFilter === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setEmailCategoryFilter(cat)}
                    className={`email-pill-btn ${isActive ? 'active' : ''}`}
                  >
                    {cat === 'ALL' ? 'All' : cat.toLowerCase()}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Clean Email Cards List */}
          <div className="email-feed-list">
            {filteredEmails.length === 0 ? (
              <div className="email-empty-state">
                <Inbox size={28} />
                <h4>No emails found</h4>
              </div>
            ) : (
              filteredEmails.map((email) => {
                const senderInitial = (email.sender || 'M').replace(/["']/g, '').trim().charAt(0).toUpperCase()
                const categoryBadge = getCategoryBadge(email.category)
                const importanceColor = getImportanceColor(email.importance)
                const isExpanded = expandedEmailIds.has(email.id)
                const dateText = formatEmailDate(email)

                return (
                  <div
                    key={email.id}
                    className="email-card"
                    style={{ borderLeft: `4px solid ${importanceColor}` }}
                  >
                    <div className="email-card-inner">
                      {/* Avatar */}
                      <div className="email-card-avatar">
                        {senderInitial}
                      </div>

                      {/* Content Area */}
                      <div className="email-card-content">
                        {/* Title & Date */}
                        <div className="email-card-header">
                          <h3 className="email-card-title">
                            {email.subject}
                          </h3>
                          {dateText && (
                            <span className="email-card-date">
                              {dateText}
                            </span>
                          )}
                        </div>

                        {/* Sender */}
                        <div className="email-card-sender">
                          {email.sender}
                        </div>

                        {/* Direct Summary */}
                        {email.summary && (
                          <p className="email-card-summary">
                            {email.summary}
                          </p>
                        )}

                        {/* Events Found In This Email */}
                        {email.events && email.events.length > 0 && (
                          <div className="email-events-wrapper">
                            <span className="email-events-label">
                              ✨ Events found in this email:
                            </span>
                            <div className="email-events-chips">
                              {email.events.map((ev: any, idx: number) => {
                                const typeMeta = getEventTypeMeta(ev.event_type)
                                return (
                                  <div
                                    key={idx}
                                    onClick={() => {
                                      setSelected({ ...ev, emailSubject: email.subject })
                                      setEditDate(ev.event_date || '')
                                      setEditTime(ev.event_time || '09:00')
                                      setComment('')
                                      setIsDeadline(ev.event_type?.toUpperCase() === 'DEADLINE')
                                    }}
                                    className="email-event-chip"
                                    style={{ borderColor: typeMeta.border }}
                                  >
                                    <span
                                      className="email-event-chip-tag"
                                      style={{ backgroundColor: typeMeta.bg, color: typeMeta.color }}
                                    >
                                      {typeMeta.badge}
                                    </span>
                                    <span className="email-event-chip-title">
                                      {ev.title}
                                    </span>
                                    {ev.event_date && (
                                      <span className="email-event-chip-date">
                                        • {ev.event_date}
                                      </span>
                                    )}
                                    <span className="email-event-chip-add">
                                      + Add
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Footer Badges & Full Body Accordion */}
                        <div className="email-card-footer">
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span
                              className="email-category-pill"
                              style={{
                                backgroundColor: categoryBadge.bg,
                                color: categoryBadge.color,
                              }}
                            >
                              {email.category || 'General'}
                            </span>
                            
                            <span className="email-priority-label">
                              • {email.importance || 'Normal'} priority
                            </span>
                          </div>

                          {email.body && (
                            <button
                              type="button"
                              onClick={() => toggleExpandEmail(email.id)}
                              className="email-toggle-body-btn"
                            >
                              {isExpanded ? 'Hide original message' : 'View original message'}
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          )}
                        </div>

                        {/* Expandable Body */}
                        {isExpanded && email.body && (
                          <div className="email-body-expanded">
                            {email.body}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ───────────────── TAB 2: EXTRACTED EVENTS (RESPONSIVE) ───────────────── */}
      {tab === 'events' && (
        <div>
          {/* Sub-toolbar */}
          <div className="email-toolbar">
            <div className="email-search-wrapper">
              <Search size={16} className="email-search-icon" />
              <input
                type="text"
                placeholder="Search extracted events..."
                value={eventSearch}
                onChange={e => setEventSearch(e.target.value)}
                className="email-search-input"
              />
            </div>

            <div className="email-filter-pills">
              {['ALL', 'DEADLINE', 'WORKSHOP', 'TALK', 'EVENT'].map(cat => {
                const isActive = eventCategoryFilter === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setEventCategoryFilter(cat)}
                    className={`email-pill-btn ${isActive ? 'active' : ''}`}
                  >
                    {cat === 'DEADLINE' && <Flame size={12} />}
                    {cat === 'ALL' ? 'All' : cat.toLowerCase()}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Events List */}
          <div className="email-feed-list">
            {filteredEvents.length === 0 ? (
              <div className="email-empty-state">
                <Sparkles size={32} />
                <h4>No matching events found</h4>
              </div>
            ) : (
              filteredEvents.map((ev, index) => {
                const typeMeta = getEventTypeMeta(ev.event_type)
                const dateInfo = formatEventDate(ev.event_date)
                const isDeadlineType = ev.event_type?.toUpperCase() === 'DEADLINE'

                return (
                  <div
                    key={ev.id || index}
                    onClick={() => {
                      setSelected(ev)
                      setEditDate(ev.event_date || '')
                      setEditTime(ev.event_time || '09:00')
                      setComment('')
                      setIsDeadline(isDeadlineType)
                    }}
                    className="email-event-card"
                  >
                    <div className="email-event-card-main">
                      <div className="email-event-date-box">
                        <div
                          className="email-event-month"
                          style={{
                            backgroundColor: isDeadlineType ? '#fee2e2' : '#e0e7ff',
                            color: isDeadlineType ? '#b91c1c' : '#4338ca',
                          }}
                        >
                          {dateInfo.month}
                        </div>
                        <div className="email-event-day">
                          {dateInfo.day}
                        </div>
                      </div>

                      <div className="email-event-details">
                        <div className="email-event-badges">
                          <span
                            className="email-event-type-badge"
                            style={{
                              backgroundColor: typeMeta.bg,
                              color: typeMeta.color,
                              border: `1px solid ${typeMeta.border}`,
                            }}
                          >
                            {typeMeta.badge}
                          </span>

                          {dateInfo.relative && (
                            <span
                              className="email-event-relative"
                              style={{
                                color: dateInfo.diffDays !== undefined && dateInfo.diffDays < 0 ? '#ef4444' : '#0284c7',
                              }}
                            >
                              • {dateInfo.relative}
                            </span>
                          )}
                        </div>

                        <h3 className="email-event-title">
                          {ev.title}
                        </h3>

                        <div className="email-event-meta">
                          {ev.event_time && (
                            <span>
                              <Clock size={12} />
                              {ev.event_time}
                            </span>
                          )}
                          {ev.emailSubject && (
                            <span className="email-event-origin">
                              ✉️ {ev.emailSubject}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="email-event-action-btn"
                      style={{
                        color: isDeadlineType ? '#b91c1c' : '#4338ca',
                      }}
                    >
                      <BookmarkCheck size={14} />
                      {isDeadlineType ? 'Add Deadline' : 'Add to Planner'}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Modal Popup */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          className="email-modal-overlay"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="email-modal-content"
          >
            <button
              onClick={() => setSelected(null)}
              className="email-modal-close-btn"
            >
              ✕
            </button>

            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', color: '#0f172a', fontWeight: 700 }}>Add to Planner</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 0, marginBottom: '16px', lineHeight: 1.4 }}>{selected.title}</p>

            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Date</label>
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', marginBottom: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', outline: 'none' }}
            />

            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Time</label>
            <input
              type="time"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', marginBottom: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', outline: 'none' }}
            />

            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Note</label>
            <input
              placeholder="Add note..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', marginBottom: '16px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', outline: 'none' }}
            />

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', cursor: 'pointer', fontSize: '0.85rem', color: '#334155', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={isDeadline}
                onChange={(e) => setIsDeadline(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: '#4f46e5', cursor: 'pointer' }}
              />
              <span>Treat as a deadline (routes to Deadlines board)</span>
            </label>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelected(null)}
                style={{ backgroundColor: '#f1f5f9', color: '#475569', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!editDate) { alert('Please pick a date'); return }
                  await addToPlanner(
                    { ...selected, event_date: editDate, event_time: editTime },
                    comment,
                    isDeadline
                  )
                }}
                style={{ backgroundColor: '#4f46e5', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                Confirm & Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}