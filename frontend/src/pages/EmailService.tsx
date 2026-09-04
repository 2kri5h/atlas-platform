import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import api, { apiKeysAPI, googleIntegrationsAPI, UserAPIKey, GoogleAccountStatus } from '../utils/api'
import type { EmailRecord } from '../utils/api'
import ApiKeyVaultModal from '../components/ApiKeyVaultModal'
import GoogleConnectModal from '../components/GoogleConnectModal'
import { synthesizeEmailBriefing, SynthesizedBriefingItem } from '../utils/emailSynthesizer'
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
  Inbox,
  Key,
  Building2,
  Globe,
  SlidersHorizontal,
  AlertCircle,
  Calendar,
  ArrowRight,
  X,
  Layers,
} from 'lucide-react'

export default function EmailService() {
  const [searchParams] = useSearchParams()

  // Dual Hub View: 'summary' (Summary Dashboard) vs 'detailed' (Detailed Mailbox)
  const initialView = searchParams.get('tab') === 'events' ? 'detailed' : 'summary'
  const [activeHubView, setActiveHubView] = useState<'summary' | 'detailed'>(initialView)

  // Summary Scope: 'all' | 'iitb' | 'gmail'
  const [summaryScope, setSummaryScope] = useState<'all' | 'iitb' | 'gmail'>('all')
  const [summarySearch, setSummarySearch] = useState('')
  const [summaryCategoryFilter, setSummaryCategoryFilter] = useState('ALL')

  // Detailed Mailbox Source & Tab
  const [inboxSource, setInboxSource] = useState<'iitb' | 'gmail'>('iitb')
  const [tab, setTab] = useState<'all' | 'events'>('all')
  const [emailSearch, setEmailSearch] = useState('')
  const [emailCategoryFilter, setEmailCategoryFilter] = useState('ALL')
  const [eventSearch, setEventSearch] = useState('')
  const [eventCategoryFilter, setEventCategoryFilter] = useState('ALL')

  // Mail Data
  const [emails, setEmails] = useState<EmailRecord[]>([])
  const [gmailEmails, setGmailEmails] = useState<EmailRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [imapEmail, setImapEmail] = useState('')
  const [imapToken, setImapToken] = useState('')

  // Accounts & Integration Modal
  const [isAccountsModalOpen, setIsAccountsModalOpen] = useState(false)
  const [accountsTab, setAccountsTab] = useState<'iitb' | 'gmail' | 'ai'>('iitb')

  // Google & Vault Modals
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false)
  const [googleStatus, setGoogleStatus] = useState<GoogleAccountStatus | null>(null)
  const [isVaultOpen, setIsVaultOpen] = useState(false)
  const [hasKey, setHasKey] = useState(false)
  const [activeKey, setActiveKey] = useState<UserAPIKey | null>(null)

  // Expandable Email IDs
  const [expandedEmailIds, setExpandedEmailIds] = useState<Set<any>>(new Set())

  // Event Edit & Add to Planner Modal
  const [selected, setSelected] = useState<any>(null)
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [comment, setComment] = useState('')
  const [isDeadline, setIsDeadline] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Sync tab with URL query parameter changes
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'events') {
      setActiveHubView('detailed')
      setTab('events')
    } else if (tabParam === 'all') {
      setActiveHubView('detailed')
      setTab('all')
    }
  }, [searchParams])

  useEffect(() => {
    loadExisting()
    checkGoogleStatus()
    checkKeys()
  }, [])

  const checkGoogleStatus = async () => {
    try {
      const data = await googleIntegrationsAPI.getStatus()
      setGoogleStatus(data)
      if (data.is_connected) {
        fetchGmailMessages()
      }
    } catch (err) {
      console.error('Failed to check Google status', err)
    }
  }

  const checkKeys = async () => {
    try {
      const res = await apiKeysAPI.getKeys()
      setHasKey(res.has_active_key)
      const firstActive = res.keys.find((k) => k.is_active) || null
      setActiveKey(firstActive)
    } catch (err) {
      console.error('Failed to check keys', err)
    }
  }

  const fetchGmailMessages = async () => {
    try {
      const res = await googleIntegrationsAPI.getGmailMessages(30)
      const mapped: EmailRecord[] = res.messages.map((m: any) => ({
        id: m.id,
        subject: m.subject,
        sender: m.sender_name ? `${m.sender_name} <${m.sender_email}>` : m.sender_email,
        category: m.category || 'PERSONAL',
        importance: m.urgency || m.event_urgency || 'MEDIUM',
        summary: m.body_snippet || m.subject,
        body: m.body_snippet,
        received_at: m.date,
        date_received: m.date,
        date: m.date,
        events: m.is_event
          ? [
              {
                id: `${m.id}_ev`,
                title: m.event_title || m.subject,
                event_date: m.event_date,
                event_time: m.event_time,
                location: m.event_location,
                event_type: m.event_category,
                urgency: m.event_urgency,
                category: m.event_category,
              },
            ]
          : [],
      }))
      setGmailEmails(mapped)
    } catch (err) {
      console.error('Failed to fetch Gmail messages', err)
    }
  }

  async function loadExisting() {
    try {
      const res = await api.get<EmailRecord[]>('/emails/')
      setEmails(res.data)
      setRegistered(true)
    } catch {
      // not registered yet
    }
  }

  function showToast(msg: string) {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const toggleExpandEmail = (id: any) => {
    setExpandedEmailIds((prev) => {
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
      showToast('IITB Webmail connected successfully!')
      setIsAccountsModalOpen(false)
      loadExisting()
    } catch (err) {
      alert('Registration failed: ' + err)
    } finally {
      setLoading(false)
    }
  }

  async function handleFetch() {
    setLoading(true)
    try {
      const promises: Promise<any>[] = []
      if (registered) {
        promises.push(
          api
            .post('/emails/fetch')
            .then(() => api.get<EmailRecord[]>('/emails/').then((res) => setEmails(res.data)))
        )
      }
      if (googleStatus?.is_connected) {
        promises.push(fetchGmailMessages())
      }

      if (promises.length === 0) {
        showToast('Connect IITB Webmail or Gmail to sync emails.')
        setIsAccountsModalOpen(true)
      } else {
        await Promise.all(promises)
        showToast('All email inboxes synced successfully! 📥')
      }
    } catch (err) {
      console.error('Fetch failed:', err)
      showToast('Sync failed: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function addToPlanner(ev: any, customComment: string, asDeadline?: boolean) {
    const deadlineFlag =
      asDeadline ??
      (ev.event_type?.toLowerCase() === 'deadline' ||
        ev.category?.toLowerCase() === 'deadline' ||
        ev.title?.toLowerCase().includes('deadline') ||
        ev.title?.toLowerCase().includes('assignment'))

    const rawTime = editTime || ev.event_time || '09:00'
    const parts = rawTime.split(':')
    const h = parseInt(parts[0] || '9', 10)
    const m = parseInt(parts[1] || '0', 10)

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
    const description = customComment
      ? `${customComment} (From email)`
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
        user_comment: customComment || '',
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

  // Jump from Summary to Detailed Email
  const handleJumpToDetailedEmail = (email: any) => {
    setActiveHubView('detailed')
    setInboxSource(email.originSource || (emails.some((e) => e.id === email.id) ? 'iitb' : 'gmail'))
    setTab('all')
    setExpandedEmailIds((prev) => new Set(prev).add(email.id))
    setEmailSearch('')
    setEmailCategoryFilter('ALL')
  }

  // ── Combined Summary Emails ──
  const combinedSummaryEmails = useMemo(() => {
    const taggedIITB = emails.map((e) => ({ ...e, originSource: 'iitb' as const }))
    const taggedGmail = gmailEmails.map((e) => ({ ...e, originSource: 'gmail' as const }))

    let list: Array<EmailRecord & { originSource: 'iitb' | 'gmail' }> = []
    if (summaryScope === 'all') {
      list = [...taggedIITB, ...taggedGmail]
    } else if (summaryScope === 'iitb') {
      list = taggedIITB
    } else {
      list = taggedGmail
    }

    return list.sort((a, b) => {
      const timeA = new Date(a.date_received || a.received_at || a.date || 0).getTime()
      const timeB = new Date(b.date_received || b.received_at || b.date || 0).getTime()
      return timeB - timeA
    })
  }, [emails, gmailEmails, summaryScope])

  // Summary Metrics
  const criticalSummaryCount = useMemo(() => {
    return combinedSummaryEmails.filter(
      (e) => e.importance?.toLowerCase() === 'high' || e.importance?.toLowerCase() === 'critical'
    ).length
  }, [combinedSummaryEmails])

  const deadlinesSummaryCount = useMemo(() => {
    return combinedSummaryEmails.filter(
      (e) =>
        (e.events && e.events.length > 0) ||
        e.category?.toLowerCase() === 'deadline' ||
        e.subject?.toLowerCase().includes('deadline') ||
        e.subject?.toLowerCase().includes('assignment')
    ).length
  }, [combinedSummaryEmails])

  const academicPlacementCount = useMemo(() => {
    return combinedSummaryEmails.filter(
      (e) =>
        e.category?.toLowerCase() === 'academic' ||
        e.category?.toLowerCase() === 'class' ||
        e.category?.toLowerCase() === 'placement'
    ).length
  }, [combinedSummaryEmails])

  // Filtered Summary Emails
  const filteredSummaryEmails = useMemo(() => {
    return combinedSummaryEmails.filter((email) => {
      if (summaryCategoryFilter !== 'ALL') {
        const cat = (email.category || '').toUpperCase()
        if (summaryCategoryFilter === 'ACADEMIC' && cat !== 'ACADEMIC' && cat !== 'CLASS') return false
        if (summaryCategoryFilter === 'EVENT' && cat !== 'EVENT') return false
        if (summaryCategoryFilter === 'PLACEMENT' && cat !== 'PLACEMENT') return false
        if (summaryCategoryFilter === 'ADMINISTRATIVE' && cat !== 'ADMINISTRATIVE') return false
        if (summaryCategoryFilter === 'PERSONAL' && cat !== 'PERSONAL') return false
      }
      if (summarySearch.trim()) {
        const q = summarySearch.toLowerCase()
        const matchSubj = email.subject?.toLowerCase().includes(q)
        const matchSender = email.sender?.toLowerCase().includes(q)
        const matchSumm = email.summary?.toLowerCase().includes(q)
        if (!matchSubj && !matchSender && !matchSumm) return false
      }
      return true
    })
  }, [combinedSummaryEmails, summarySearch, summaryCategoryFilter])

  // Executive Briefing Digest List (Synthesized Natural One-Liners)
  const synthesizedBriefingList: SynthesizedBriefingItem[] = useMemo(() => {
    return filteredSummaryEmails.map((email, idx) => synthesizeEmailBriefing(email, idx))
  }, [filteredSummaryEmails])

  // Detailed Mailbox Lists
  const activeDetailedEmailsList = useMemo(() => {
    return inboxSource === 'iitb' ? emails : gmailEmails
  }, [inboxSource, emails, gmailEmails])

  const allDetailedEvents = useMemo(() => {
    return activeDetailedEmailsList.flatMap((email) =>
      (email.events || []).map((ev) => ({ ...ev, emailSubject: email.subject }))
    )
  }, [activeDetailedEmailsList])

  const filteredDetailedEmails = useMemo(() => {
    return activeDetailedEmailsList.filter((email) => {
      const matchesCategory =
        emailCategoryFilter === 'ALL' ||
        (email.category && email.category.toUpperCase() === emailCategoryFilter)
      const matchesSearch =
        !emailSearch.trim() ||
        email.subject?.toLowerCase().includes(emailSearch.toLowerCase()) ||
        email.sender?.toLowerCase().includes(emailSearch.toLowerCase()) ||
        email.summary?.toLowerCase().includes(emailSearch.toLowerCase()) ||
        email.body?.toLowerCase().includes(emailSearch.toLowerCase())

      return matchesCategory && matchesSearch
    })
  }, [activeDetailedEmailsList, emailCategoryFilter, emailSearch])

  const filteredDetailedEvents = useMemo(() => {
    return allDetailedEvents.filter((ev) => {
      const matchesSearch =
        !eventSearch.trim() ||
        ev.title?.toLowerCase().includes(eventSearch.toLowerCase()) ||
        ev.location?.toLowerCase().includes(eventSearch.toLowerCase()) ||
        ev.emailSubject?.toLowerCase().includes(eventSearch.toLowerCase())

      const matchesCategory =
        eventCategoryFilter === 'ALL' ||
        (ev.event_type && ev.event_type.toUpperCase() === eventCategoryFilter)

      return matchesSearch && matchesCategory
    })
  }, [allDetailedEvents, eventCategoryFilter, eventSearch])

  // Formatting Helpers
  const formatEmailDate = (email: EmailRecord) => {
    try {
      const raw = email.date_received || email.received_at || email.date
      if (!raw) return ''
      const d = new Date(raw)
      if (isNaN(d.getTime())) return String(raw)
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

  return (
    <div className="email-service-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="email-toast">
          <span className="email-toast-check">✓</span> {toastMessage}
        </div>
      )}

      {/* ── Consolidated Header Bar ── */}
      <div className="email-header-bar">
        <div className="email-header-left">
          <div className="email-header-branding">
            <h1 className="email-header-title">Email Intelligence</h1>
            <div className="email-header-status-group">
              <span className={`email-status-pill ${registered ? 'active' : 'inactive'}`} title={registered ? 'Webmail Active' : 'Webmail Disconnected'}>
                <span className="status-dot"></span>
                <span className="status-pill-text">{registered ? 'Webmail' : 'Webmail Off'}</span>
              </span>
              <span className={`email-status-pill ${googleStatus?.is_connected ? 'active' : 'inactive'}`} title={googleStatus?.is_connected ? 'Gmail Synced' : 'Gmail Not Connected'}>
                <span className="status-dot"></span>
                <span className="status-pill-text">{googleStatus?.is_connected ? 'Gmail' : 'Gmail Off'}</span>
              </span>
              <span className="email-status-pill ai-pill">
                <Sparkles size={11} className="ai-pill-icon" />
                <span className="status-pill-text">{hasKey ? (activeKey?.provider.toUpperCase() || 'AI') : 'AI Standard'}</span>
              </span>
            </div>
          </div>
          <p className="email-header-subtitle">
            AI-synthesized daily digest, priority briefings, and 1-click planner extraction
          </p>
        </div>

        <div className="email-header-actions">
          <button onClick={handleFetch} disabled={loading} className="email-sync-btn" title="Sync all connected inboxes">
            <RefreshCw size={13} className={loading ? 'spinning' : ''} />
            <span>{loading ? 'Syncing...' : 'Sync Emails'}</span>
          </button>

          <button onClick={() => setIsAccountsModalOpen(true)} className="email-account-btn" title="Accounts & sync preferences">
            <SlidersHorizontal size={13} />
            <span>Accounts</span>
          </button>
        </div>
      </div>

      {/* ── Apple-Inspired Dual Hub Navigation Switcher (Like Resources) ── */}
      <div className="email-hub-nav-container">
        <div className="email-hub-nav">
          <button
            className={`email-hub-pill ${activeHubView === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveHubView('summary')}
          >
            <Sparkles size={15} />
            <span className="hub-label-desktop">Summary Dashboard</span>
            <span className="hub-label-mobile">AI Briefing</span>
            <span className="email-hub-pill-counter">AI</span>
          </button>

          <button
            className={`email-hub-pill ${activeHubView === 'detailed' ? 'active' : ''}`}
            onClick={() => setActiveHubView('detailed')}
          >
            <Mail size={15} />
            <span className="hub-label-desktop">Detailed Mailbox</span>
            <span className="hub-label-mobile">Mailbox</span>
            <span className="email-hub-pill-counter">{emails.length + gmailEmails.length}</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* ── PAGE 1: QUICK SUMMARY DASHBOARD ── */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeHubView === 'summary' && (
        <div className="summary-dashboard-page">
          {/* Scope Controls & Quick Search */}
          <div className="summary-controls-row">
            <div className="summary-scope-switcher">
              <button
                className={`summary-scope-btn ${summaryScope === 'all' ? 'active' : ''}`}
                onClick={() => setSummaryScope('all')}
              >
                <Layers size={13} />
                <span className="scope-btn-label-desktop">All Mails Summary</span>
                <span className="scope-btn-label-mobile">All ({combinedSummaryEmails.length})</span>
              </button>
              <button
                className={`summary-scope-btn ${summaryScope === 'iitb' ? 'active' : ''}`}
                onClick={() => setSummaryScope('iitb')}
              >
                <Building2 size={13} />
                <span className="scope-btn-label-desktop">Webmail Summary</span>
                <span className="scope-btn-label-mobile">Webmail ({emails.length})</span>
              </button>
              <button
                className={`summary-scope-btn ${summaryScope === 'gmail' ? 'active' : ''}`}
                onClick={() => setSummaryScope('gmail')}
              >
                <Globe size={13} />
                <span className="scope-btn-label-desktop">Personal Mail Summary</span>
                <span className="scope-btn-label-mobile">Gmail ({gmailEmails.length})</span>
              </button>
            </div>

            <div className="summary-search-box">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search summaries, professors..."
                value={summarySearch}
                onChange={(e) => setSummarySearch(e.target.value)}
              />
              {summarySearch && (
                <button
                  onClick={() => setSummarySearch('')}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Interactive Bento Stats Overview */}
          <div className="email-summary-stats-grid">
            <div
              className={`stat-bento-card ${summaryCategoryFilter === 'ALL' && !summarySearch ? 'selected-stat' : ''}`}
              onClick={() => {
                setSummaryCategoryFilter('ALL')
                setSummarySearch('')
              }}
              title="View all emails"
            >
              <div className="stat-icon-wrapper blue">
                <Mail size={18} />
              </div>
              <div className="stat-bento-info">
                <span className="stat-bento-val">{combinedSummaryEmails.length}</span>
                <span className="stat-bento-label">Total</span>
                <span className="stat-bento-subtext">
                  {summaryScope === 'all'
                    ? `${emails.length} Webmail • ${gmailEmails.length} Gmail`
                    : summaryScope === 'iitb'
                    ? 'IIT Bombay Webmail'
                    : 'Personal Gmail'}
                </span>
              </div>
            </div>

            <div
              className={`stat-bento-card ${summarySearch === 'urgent' ? 'selected-stat' : ''}`}
              onClick={() => {
                setSummaryCategoryFilter('ALL')
                setSummarySearch(summarySearch === 'urgent' ? '' : 'urgent')
              }}
              title="Filter urgent & critical updates"
            >
              <div className="stat-icon-wrapper red">
                <AlertCircle size={18} />
              </div>
              <div className="stat-bento-info">
                <span className="stat-bento-val">{criticalSummaryCount}</span>
                <span className="stat-bento-label">Urgent</span>
                <span className="stat-bento-subtext">Action required or notice</span>
              </div>
            </div>

            <div
              className={`stat-bento-card ${summaryCategoryFilter === 'EVENT' ? 'selected-stat' : ''}`}
              onClick={() => setSummaryCategoryFilter(summaryCategoryFilter === 'EVENT' ? 'ALL' : 'EVENT')}
              title="Filter actionable deadlines"
            >
              <div className="stat-icon-wrapper purple">
                <Calendar size={18} />
              </div>
              <div className="stat-bento-info">
                <span className="stat-bento-val">{deadlinesSummaryCount}</span>
                <span className="stat-bento-label">Deadlines</span>
                <span className="stat-bento-subtext">1-click sync into planner</span>
              </div>
            </div>

            <div
              className={`stat-bento-card ${summaryCategoryFilter === 'ACADEMIC' ? 'selected-stat' : ''}`}
              onClick={() => setSummaryCategoryFilter(summaryCategoryFilter === 'ACADEMIC' ? 'ALL' : 'ACADEMIC')}
              title="Filter academic notices"
            >
              <div className="stat-icon-wrapper emerald">
                <Sparkles size={18} />
              </div>
              <div className="stat-bento-info">
                <span className="stat-bento-val">{academicPlacementCount}</span>
                <span className="stat-bento-label">Academics</span>
                <span className="stat-bento-subtext">Course materials & grades</span>
              </div>
            </div>
          </div>

          {/* Quick Category Filter Pills */}
          <div className="summary-category-filter-strip">
            <span className="category-filter-label">
              Category:
            </span>
            {['ALL', 'ACADEMIC', 'PLACEMENT', 'EVENT', 'ADMINISTRATIVE', 'PERSONAL'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSummaryCategoryFilter(cat)}
                className={`email-pill-btn ${summaryCategoryFilter === cat ? 'active' : ''}`}
              >
                {cat === 'ALL' ? 'All' : cat.charAt(0) + cat.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Summary Cards Feed */}
          {filteredSummaryEmails.length === 0 ? (
            <div className="email-empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <Inbox size={36} color="#64748b" style={{ marginBottom: '12px' }} />
              <h4 style={{ color: 'var(--text-primary)', margin: '0 0 6px 0', fontSize: '16px' }}>
                No emails found in this summary scope
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 16px 0' }}>
                {summaryScope === 'all'
                  ? 'Sync your Webmail and Personal Gmail to generate your daily AI digest.'
                  : `No emails synced yet for ${summaryScope === 'iitb' ? 'IITB Webmail' : 'Personal Gmail'}.`}
              </p>
              <button
                onClick={handleFetch}
                disabled={loading}
                className="email-sync-btn"
                style={{ margin: '0 auto' }}
              >
                <RefreshCw size={14} className={loading ? 'spinning' : ''} />
                Sync Inboxes Now
              </button>
            </div>
          ) : (
            <div className="briefing-digest-container">
              <div className="briefing-digest-header">
                <div className="briefing-digest-title">
                  <Sparkles size={18} className="briefing-sparkle-icon" />
                  <span>Executive Mail Briefing Digest</span>
                  <span className="briefing-digest-badge">
                    {summaryScope === 'all'
                      ? 'All Mails (Webmail + Personal Gmail)'
                      : summaryScope === 'iitb'
                      ? 'IITB Webmail'
                      : 'Personal Gmail'}
                  </span>
                </div>
                <span className="briefing-digest-count">
                  {synthesizedBriefingList.length} updates synthesized
                </span>
              </div>

              <div className="briefing-list">
                {synthesizedBriefingList.map((item) => {
                  const hasMeta = Boolean(item.date || item.time || item.venue)
                  const rawEmail = item.rawEmail
                  const isCritical =
                    rawEmail.importance?.toLowerCase() === 'critical' ||
                    rawEmail.importance?.toLowerCase() === 'high'

                  return (
                    <div key={item.id} className="briefing-bullet-row">
                      {/* High-end Bullet Dot Indicator */}
                      <div className={`briefing-bullet-dot ${item.actionType}`} />

                      {/* Summary Content with Inline Dates */}
                      <div className="briefing-bullet-body">
                        <div className="briefing-badges-row">
                          <span className={`source-tag ${item.originSource === 'iitb' ? 'iitb' : 'gmail'}`}>
                            {item.originSource === 'iitb' ? <Building2 size={11} /> : <Globe size={11} />}
                            {item.originSource === 'iitb' ? 'Webmail' : 'Personal Gmail'}
                          </span>

                          <span className={`briefing-type-tag ${item.actionType}`}>
                            {item.actionBadge}
                          </span>

                          {isCritical && (
                            <span className="briefing-urgent-pill">
                              URGENT
                            </span>
                          )}
                        </div>

                        <p className="briefing-summary-text">
                          {item.briefingSentence}
                        </p>
                      </div>

                      {/* Right-most Actions: Optional Planner shortcut & Primary Detailed Email View Button */}
                      <div className="briefing-right-actions">
                        {hasMeta && (
                          <button
                            type="button"
                            onClick={() => {
                              const ev =
                                rawEmail.events && rawEmail.events.length > 0
                                  ? rawEmail.events[0]
                                  : {
                                      title: rawEmail.subject,
                                      event_date: item.date,
                                      event_time: item.time,
                                      location: item.venue,
                                    }
                              setSelected({ ...ev, emailSubject: rawEmail.subject })
                              setEditDate(ev.event_date || item.date || '')
                              setEditTime(ev.event_time || item.time || '09:00')
                              setComment('')
                              setIsDeadline(item.actionType === 'deadline' || item.actionType === 'quiz')
                            }}
                            className="briefing-planner-btn"
                            title="Sync into Student Planner"
                          >
                            <BookmarkCheck size={13} />
                            <span>Add to Planner</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleJumpToDetailedEmail(rawEmail)}
                          className="briefing-view-details-btn"
                        >
                          <span>Detailed View</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* ── PAGE 2: DETAILED MAILBOX (AS CURRENTLY SEEN) ── */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeHubView === 'detailed' && (
        <div className="detailed-mailbox-page">
          {/* Detailed Mailbox Source Switcher */}
          <div className="detailed-mailbox-source-bar">
            <div className="detailed-mailbox-source-group">
              <button
                type="button"
                onClick={() => setInboxSource('iitb')}
                className={`detailed-source-toggle ${inboxSource === 'iitb' ? 'active' : ''}`}
              >
                <Building2 size={15} />
                <span>IIT Bombay Webmail ({emails.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setInboxSource('gmail')}
                className={`detailed-source-toggle ${inboxSource === 'gmail' ? 'active' : ''}`}
              >
                <Globe size={15} />
                <span>Personal Gmail ({gmailEmails.length})</span>
              </button>
            </div>

            <div className="detailed-mailbox-actions-group">
              <button
                type="button"
                onClick={() => setIsAccountsModalOpen(true)}
                className="detailed-source-settings-btn"
              >
                <SlidersHorizontal size={13} />
                <span>Manage {inboxSource === 'iitb' ? 'Webmail' : 'Gmail'} Settings</span>
              </button>
            </div>
          </div>

          {/* Sub-tabs: All Emails vs Extracted Events */}
          <div className="email-nav-tabs">
            <button
              onClick={() => setTab('all')}
              className={`email-nav-tab ${tab === 'all' ? 'active' : ''}`}
            >
              <Mail size={16} />
              <span>All Emails</span>
              <span className="email-nav-tab-count">{activeDetailedEmailsList.length}</span>
            </button>

            <button
              onClick={() => setTab('events')}
              className={`email-nav-tab ${tab === 'events' ? 'active' : ''}`}
            >
              <Sparkles size={16} />
              <span>Extracted Events</span>
              <span className="email-nav-tab-count">{allDetailedEvents.length}</span>
            </button>
          </div>

          {/* ── SUB-TAB 1: ALL EMAILS ── */}
          {tab === 'all' && (
            <div>
              <div className="email-toolbar">
                <div className="email-search-wrapper">
                  <Search size={16} className="email-search-icon" />
                  <input
                    type="text"
                    placeholder={`Search ${inboxSource === 'iitb' ? 'Webmail' : 'Personal Gmail'}...`}
                    value={emailSearch}
                    onChange={(e) => setEmailSearch(e.target.value)}
                    className="email-search-input"
                  />
                </div>

                <div className="email-filter-pills">
                  {['ALL', 'ACADEMIC', 'EVENT', 'PLACEMENT', 'ADMINISTRATIVE', 'PERSONAL'].map(
                    (cat) => {
                      const isActive = emailCategoryFilter === cat
                      return (
                        <button
                          key={cat}
                          onClick={() => setEmailCategoryFilter(cat)}
                          className={`email-pill-btn ${isActive ? 'active' : ''}`}
                        >
                          {cat === 'ALL' ? 'All' : cat.charAt(0) + cat.slice(1).toLowerCase()}
                        </button>
                      )
                    }
                  )}
                </div>
              </div>

              {/* Clean Email Cards List */}
              <div className="email-feed-list">
                {filteredDetailedEmails.length === 0 ? (
                  <div className="email-empty-state">
                    <Inbox size={28} />
                    <h4>No emails found in this mailbox</h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {inboxSource === 'iitb' && !registered
                        ? 'Connect your IIT Bombay Webmail to start viewing campus emails.'
                        : inboxSource === 'gmail' && !googleStatus?.is_connected
                        ? 'Connect your Google account to sync personal Gmail.'
                        : 'Try adjusting your search terms or filters.'}
                    </p>
                    {((inboxSource === 'iitb' && !registered) ||
                      (inboxSource === 'gmail' && !googleStatus?.is_connected)) && (
                      <button
                        onClick={() => setIsAccountsModalOpen(true)}
                        className="email-sync-btn"
                        style={{ marginTop: '12px' }}
                      >
                        Connect Account Now
                      </button>
                    )}
                  </div>
                ) : (
                  filteredDetailedEmails.map((email) => {
                    const senderInitial = (email.sender || 'M')
                      .replace(/["']/g, '')
                      .trim()
                      .charAt(0)
                      .toUpperCase()
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
                          <div className="email-card-avatar">{senderInitial}</div>

                          {/* Content Area */}
                          <div className="email-card-content">
                            <div className="email-card-header">
                              <h3 className="email-card-title">{email.subject}</h3>
                              {dateText && <span className="email-card-date">{dateText}</span>}
                            </div>

                            <div className="email-card-sender">From: {email.sender}</div>

                            <p className="email-card-summary">{email.summary}</p>

                            <div className="email-card-footer">
                              <div className="email-card-badges">
                                <span
                                  className="email-card-category"
                                  style={{
                                    backgroundColor: categoryBadge.bg,
                                    color: categoryBadge.color,
                                  }}
                                >
                                  {email.category || 'General'}
                                </span>

                                <span className="email-card-importance">
                                  <span
                                    className="importance-dot"
                                    style={{ backgroundColor: importanceColor }}
                                  />
                                  {email.importance || 'Normal'}
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
                              <div className="email-body-expanded">{email.body}</div>
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

          {/* ── SUB-TAB 2: EXTRACTED EVENTS ── */}
          {tab === 'events' && (
            <div>
              <div className="email-toolbar">
                <div className="email-search-wrapper">
                  <Search size={16} className="email-search-icon" />
                  <input
                    type="text"
                    placeholder="Search extracted events..."
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    className="email-search-input"
                  />
                </div>

                <div className="email-filter-pills">
                  {['ALL', 'DEADLINE', 'WORKSHOP', 'TALK', 'EVENT'].map((cat) => {
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
                {filteredDetailedEvents.length === 0 ? (
                  <div className="email-empty-state">
                    <Sparkles size={32} />
                    <h4>No matching events found in this mailbox</h4>
                  </div>
                ) : (
                  filteredDetailedEvents.map((ev, index) => {
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
                            <div className="email-event-day">{dateInfo.day}</div>
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
                                    color:
                                      dateInfo.diffDays !== undefined && dateInfo.diffDays < 0
                                        ? '#ef4444'
                                        : '#0284c7',
                                  }}
                                >
                                  • {dateInfo.relative}
                                </span>
                              )}
                            </div>

                            <h3 className="email-event-title">{ev.title}</h3>

                            <div className="email-event-meta">
                              {ev.event_time && (
                                <span>
                                  <Clock size={12} />
                                  {ev.event_time}
                                </span>
                              )}
                              {ev.emailSubject && (
                                <span className="email-event-origin">✉️ {ev.emailSubject}</span>
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
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* ── CONSOLIDATED ACCOUNTS & INTEGRATIONS MODAL ── */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isAccountsModalOpen && createPortal(
        <div className="email-modal-overlay" onClick={() => setIsAccountsModalOpen(false)} role="dialog" aria-modal="true">
          <div
            className="accounts-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="email-modal-close-btn" onClick={() => setIsAccountsModalOpen(false)}>
              ✕
            </button>

            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Accounts & Sync Settings
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Configure your campus webmail, personal Google account, and AI extraction engine
            </p>

            <div className="accounts-modal-tabs">
              <button
                className={`accounts-tab-btn ${accountsTab === 'iitb' ? 'active' : ''}`}
                onClick={() => setAccountsTab('iitb')}
              >
                <Building2 size={14} />
                <span>IITB Webmail</span>
              </button>
              <button
                className={`accounts-tab-btn ${accountsTab === 'gmail' ? 'active' : ''}`}
                onClick={() => setAccountsTab('gmail')}
              >
                <Globe size={14} />
                <span>Personal Gmail</span>
              </button>
              <button
                className={`accounts-tab-btn ${accountsTab === 'ai' ? 'active' : ''}`}
                onClick={() => setAccountsTab('ai')}
              >
                <Key size={14} />
                <span>AI Extraction</span>
              </button>
            </div>

            {/* TAB 1: IITB Webmail */}
            {accountsTab === 'iitb' && (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Status</span>
                    <span className={`email-status-pill ${registered ? 'active' : 'inactive'}`}>
                      <span className="status-dot"></span>
                      {registered ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                  {registered && (
                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
                      Your IIT Bombay Webmail IMAP sync is currently active.
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      IMAP Email
                    </label>
                    <input
                      placeholder="e.g. 21001001@iitb.ac.in"
                      value={imapEmail}
                      onChange={(e) => setImapEmail(e.target.value)}
                      className="email-setup-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      IMAP App Password / Token
                    </label>
                    <input
                      placeholder="App Password or Webmail Token"
                      type="password"
                      value={imapToken}
                      onChange={(e) => setImapToken(e.target.value)}
                      className="email-setup-input"
                    />
                  </div>

                  <button
                    onClick={handleRegister}
                    disabled={loading || !imapEmail || !imapToken}
                    className="email-setup-submit"
                    style={{ marginTop: '8px' }}
                  >
                    {loading ? 'Connecting...' : registered ? 'Update Webmail Credentials' : 'Connect Webmail'}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: Personal Gmail */}
            {accountsTab === 'gmail' && (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Status</span>
                    <span className={`email-status-pill ${googleStatus?.is_connected ? 'active' : 'inactive'}`}>
                      <span className="status-dot"></span>
                      {googleStatus?.is_connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>

                  {googleStatus?.is_connected ? (
                    <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', marginTop: '10px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                        {googleStatus.name || 'Google User'} ({googleStatus.email})
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                        Gmail, Google Drive & Google Calendar 2-Way Sync Active
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '4px 0 16px 0' }}>
                      Connect your Google Account via OAuth to automatically read and summarize emails from your personal Gmail.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsAccountsModalOpen(false)
                    setIsGoogleModalOpen(true)
                  }}
                  className="email-sync-btn"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <Globe size={15} />
                  {googleStatus?.is_connected ? 'Manage Google Account' : 'Connect Google Account'}
                </button>
              </div>
            )}

            {/* TAB 3: AI Intelligence Engine */}
            {accountsTab === 'ai' && (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Engine</span>
                    <span className="email-status-pill active">
                      <Sparkles size={11} color="#a78bfa" />
                      {hasKey ? `Active (${activeKey?.provider.toUpperCase()})` : 'Standard Gemini Active'}
                    </span>
                  </div>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '6px 0 16px 0' }}>
                    Google Gemini extracts key dates, exam notifications, homework deadlines, and creates 1-line crisp summaries for every email.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsAccountsModalOpen(false)
                    setIsVaultOpen(true)
                  }}
                  className="email-account-btn"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <Key size={14} />
                  Manage BYOK API Keys in Vault
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ── Event Modal: Add to Planner ── */}
      {selected && createPortal(
        <div onClick={() => setSelected(null)} className="email-modal-overlay" role="dialog" aria-modal="true">
          <div onClick={(e) => e.stopPropagation()} className="email-modal-content">
            <button onClick={() => setSelected(null)} className="email-modal-close-btn">
              ✕
            </button>

            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', color: '#0f172a', fontWeight: 700 }}>
              Add to Planner
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 0, marginBottom: '16px', lineHeight: 1.4 }}>
              {selected.title}
            </p>

            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Date
            </label>
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', marginBottom: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', outline: 'none' }}
            />

            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Time
            </label>
            <input
              type="time"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', marginBottom: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', outline: 'none' }}
            />

            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Note
            </label>
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
                  if (!editDate) {
                    alert('Please pick a date')
                    return
                  }
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
        </div>,
        document.body
      )}

      {/* ── Key Vault Modal ── */}
      <ApiKeyVaultModal
        isOpen={isVaultOpen}
        onClose={() => {
          setIsVaultOpen(false)
          checkKeys()
        }}
        onKeyUpdated={checkKeys}
      />

      {/* ── Google Workspace Connect Modal ── */}
      <GoogleConnectModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        onStatusChange={(status) => {
          setGoogleStatus(status)
          if (status.is_connected) {
            fetchGmailMessages()
          }
        }}
      />
    </div>
  )
}
