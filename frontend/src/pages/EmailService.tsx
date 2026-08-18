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
    <div style={{ padding: '2.5rem 1.5rem', maxWidth: 960, margin: '0 auto', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            padding: '12px 22px',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '0.9rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            border: '1px solid #334155'
          }}
        >
          <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> {toastMessage}
        </div>
      )}

      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.025em' }}>
              Email Service
            </h1>
            <span style={{ backgroundColor: '#e0e7ff', color: '#4338ca', fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: '20px' }}>
              IITB Webmail
            </span>
          </div>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>
            Campus updates, summaries, and extracted planner events
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleFetch}
            disabled={loading}
            style={{
              backgroundColor: '#4f46e5',
              color: '#fff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '9px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
              transition: 'all 0.2s ease'
            }}
          >
            <RefreshCw size={15} className={loading ? 'spinning' : ''} />
            {loading ? 'Syncing...' : 'Fetch Emails'}
          </button>
          
          {registered && (
            <button
              onClick={() => setRegistered(false)}
              style={{
                backgroundColor: '#ffffff',
                color: '#475569',
                border: '1px solid #e2e8f0',
                padding: '10px 14px',
                borderRadius: '9px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Account
            </button>
          )}
        </div>
      </div>

      {/* Registration Form */}
      {!registered && (
        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#1e293b', fontSize: '1.05rem', fontWeight: 700 }}>Connect IITB Webmail</h3>
          <input
            placeholder="IMAP email (e.g. rollnumber@iitb.ac.in)"
            value={imapEmail}
            onChange={(e) => setImapEmail(e.target.value)}
            style={{ display: 'block', marginBottom: '10px', width: '100%', padding: '11px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box', outline: 'none' }}
          />
          <input
            placeholder="IMAP token / App Password"
            type="password"
            value={imapToken}
            onChange={(e) => setImapToken(e.target.value)}
            style={{ display: 'block', marginBottom: '14px', width: '100%', padding: '11px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box', outline: 'none' }}
          />
          <button
            onClick={handleRegister}
            disabled={loading}
            style={{ backgroundColor: '#0f172a', color: '#fff', border: 'none', padding: '11px 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}
          >
            {loading ? 'Registering...' : 'Connect Webmail'}
          </button>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setTab('all')}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'none',
              borderBottom: tab === 'all' ? '3px solid #4f46e5' : '3px solid transparent',
              fontWeight: tab === 'all' ? 700 : 600,
              color: tab === 'all' ? '#4f46e5' : '#64748b',
              cursor: 'pointer',
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Mail size={16} />
            <span>All Emails</span>
            <span style={{
              backgroundColor: tab === 'all' ? '#e0e7ff' : '#f1f5f9',
              color: tab === 'all' ? '#4338ca' : '#64748b',
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: 700
            }}>
              {emails.length}
            </span>
          </button>

          <button
            onClick={() => setTab('events')}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'none',
              borderBottom: tab === 'events' ? '3px solid #4f46e5' : '3px solid transparent',
              fontWeight: tab === 'events' ? 700 : 600,
              color: tab === 'events' ? '#4f46e5' : '#64748b',
              cursor: 'pointer',
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Sparkles size={16} />
            <span>Extracted Events</span>
            <span style={{
              backgroundColor: tab === 'events' ? '#e0e7ff' : '#f1f5f9',
              color: tab === 'events' ? '#4338ca' : '#64748b',
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: 700
            }}>
              {allEvents.length}
            </span>
          </button>
        </div>
      </div>

      {/* ───────────────── TAB 1: ALL EMAILS (CLEAN & HUMAN) ───────────────── */}
      {tab === 'all' && (
        <div>
          {/* Sub-toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search emails..."
                value={emailSearch}
                onChange={e => setEmailSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.875rem',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
              {['ALL', 'ACADEMIC', 'EVENT', 'PLACEMENT', 'ADMINISTRATIVE'].map(cat => {
                const isActive = emailCategoryFilter === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setEmailCategoryFilter(cat)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '20px',
                      border: isActive ? '1px solid #4f46e5' : '1px solid #e2e8f0',
                      backgroundColor: isActive ? '#4f46e5' : '#ffffff',
                      color: isActive ? '#ffffff' : '#64748b',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {cat === 'ALL' ? 'All' : cat.toLowerCase()}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Clean Email Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredEmails.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <Inbox size={28} style={{ color: '#94a3b8', marginBottom: '6px' }} />
                <h4 style={{ margin: 0, color: '#334155' }}>No emails found</h4>
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
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderLeft: `4px solid ${importanceColor}`,
                      borderRadius: '10px',
                      padding: '16px 20px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                      {/* Avatar */}
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '8px',
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontSize: '0.95rem'
                        }}
                      >
                        {senderInitial}
                      </div>

                      {/* Content Area */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Title Row with Date side-by-side */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', marginBottom: '3px' }}>
                          <h3 style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: '0.95rem', lineHeight: 1.4 }}>
                            {email.subject}
                          </h3>
                          {dateText && (
                            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>
                              {dateText}
                            </span>
                          )}
                        </div>

                        {/* Sender */}
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '8px', wordBreak: 'break-all' }}>
                          {email.sender}
                        </div>

                        {/* Direct Summary */}
                        {email.summary && (
                          <p style={{ margin: '0 0 10px 0', color: '#334155', fontSize: '0.875rem', lineHeight: '1.5' }}>
                            {email.summary}
                          </p>
                        )}

                        {/* Events Found In This Email */}
                        {email.events && email.events.length > 0 && (
                          <div style={{ marginTop: '10px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                              ✨ Events found in this email:
                            </span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
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
                                    style={{
                                      backgroundColor: '#f8fafc',
                                      border: `1px solid ${typeMeta.border}`,
                                      borderRadius: '6px',
                                      padding: '4px 10px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      cursor: 'pointer',
                                      transition: 'background 0.15s ease'
                                    }}
                                  >
                                    <span style={{ backgroundColor: typeMeta.bg, color: typeMeta.color, padding: '1px 5px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>
                                      {typeMeta.badge}
                                    </span>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>
                                      {ev.title}
                                    </span>
                                    {ev.event_date && (
                                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                        • {ev.event_date}
                                      </span>
                                    )}
                                    <span style={{ fontSize: '0.75rem', color: '#4f46e5', fontWeight: 700, marginLeft: '4px' }}>
                                      + Add
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Footer Badges & Full Body Accordion */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span
                              style={{
                                backgroundColor: categoryBadge.bg,
                                color: categoryBadge.color,
                                padding: '2px 7px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                textTransform: 'uppercase'
                              }}
                            >
                              {email.category || 'General'}
                            </span>
                            
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'capitalize' }}>
                              • {email.importance || 'Normal'} priority
                            </span>
                          </div>

                          {email.body && (
                            <button
                              type="button"
                              onClick={() => toggleExpandEmail(email.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#4f46e5',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '2px'
                              }}
                            >
                              {isExpanded ? 'Hide original message' : 'View original message'}
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          )}
                        </div>

                        {/* Expandable Body */}
                        {isExpanded && email.body && (
                          <div style={{ marginTop: '10px', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.825rem', color: '#475569', lineHeight: '1.5', whiteSpace: 'pre-wrap', maxHeight: '280px', overflowY: 'auto' }}>
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

      {/* ───────────────── TAB 2: EXTRACTED EVENTS ───────────────── */}
      {tab === 'events' && (
        <div>
          {/* Sub-toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search extracted events..."
                value={eventSearch}
                onChange={e => setEventSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.875rem',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
              {['ALL', 'DEADLINE', 'WORKSHOP', 'TALK', 'EVENT'].map(cat => {
                const isActive = eventCategoryFilter === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setEventCategoryFilter(cat)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '20px',
                      border: isActive ? '1px solid #4f46e5' : '1px solid #e2e8f0',
                      backgroundColor: isActive ? '#4f46e5' : '#ffffff',
                      color: isActive ? '#ffffff' : '#64748b',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {cat === 'DEADLINE' && <Flame size={12} />}
                    {cat === 'ALL' ? 'All' : cat.toLowerCase()}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Events List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <Sparkles size={32} style={{ color: '#94a3b8', marginBottom: '8px' }} />
                <h4 style={{ margin: 0, color: '#334155' }}>No matching events found</h4>
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
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '16px',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                      transition: 'all 0.15s ease-in-out',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          width: '50px',
                          height: '52px',
                          backgroundColor: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          overflow: 'hidden'
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            backgroundColor: isDeadlineType ? '#fee2e2' : '#e0e7ff',
                            color: isDeadlineType ? '#b91c1c' : '#4338ca',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            textAlign: 'center',
                            padding: '2px 0'
                          }}
                        >
                          {dateInfo.month}
                        </div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                          {dateInfo.day}
                        </div>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              backgroundColor: typeMeta.bg,
                              color: typeMeta.color,
                              border: `1px solid ${typeMeta.border}`,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '0.675rem',
                              fontWeight: 700,
                              textTransform: 'uppercase'
                            }}
                          >
                            {typeMeta.badge}
                          </span>

                          {dateInfo.relative && (
                            <span
                              style={{
                                fontSize: '0.725rem',
                                fontWeight: 600,
                                color: dateInfo.diffDays !== undefined && dateInfo.diffDays < 0 ? '#ef4444' : '#0284c7',
                              }}
                            >
                              • {dateInfo.relative}
                            </span>
                          )}
                        </div>

                        <h3
                          style={{
                            margin: 0,
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            color: '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '100%'
                          }}
                        >
                          {ev.title}
                        </h3>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', fontSize: '0.8rem', color: '#64748b' }}>
                          {ev.event_time && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} />
                              {ev.event_time}
                            </span>
                          )}
                          {ev.emailSubject && (
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                              ✉️ {ev.emailSubject}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      style={{
                        backgroundColor: '#f8fafc',
                        color: isDeadlineType ? '#b91c1c' : '#4338ca',
                        border: '1px solid #e2e8f0',
                        padding: '7px 12px',
                        borderRadius: '6px',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
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
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            backdropFilter: 'blur(2px)'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              borderRadius: '14px',
              padding: '24px',
              width: '390px',
              maxWidth: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              position: 'relative'
            }}
          >
            <button
              onClick={() => setSelected(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                fontSize: '1.2rem',
                color: '#94a3b8',
                cursor: 'pointer'
              }}
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