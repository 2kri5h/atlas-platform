import { useState, useEffect, useRef } from 'react'
import {
  Plus, ChevronLeft, ChevronRight, AlertTriangle, Link as LinkIcon,
  Upload, Trash2, Edit, RotateCcw, Check,
  X, Loader2, Scan, Copy, RefreshCw, MapPin, Clock,
  CheckSquare, FileText, Calendar as CalendarIcon, Bell
} from 'lucide-react'
import api from '../utils/api'
import { PlannerEvent, TimetableEntry } from '../utils/api'
import { usePlannerData } from '../hooks/usePlannerData'
import { getDeterministicColor, getEventShortLabel } from '../utils/colorPalette'
import './Planner.css'

// ─── Comment & Checkpoint Types ───────────────────────────────────────────────
export interface CheckpointItem {
  id: string
  text: string
  done: boolean
}

export interface CommentData {
  notes: string
  checkpoints: CheckpointItem[]
}

export function parseCommentData(userComment?: string): CommentData {
  if (!userComment) return { notes: '', checkpoints: [] }
  try {
    const parsed = JSON.parse(userComment)
    if (parsed && typeof parsed === 'object') {
      return {
        notes: typeof parsed.notes === 'string' ? parsed.notes : '',
        checkpoints: Array.isArray(parsed.checkpoints)
          ? parsed.checkpoints.map((c: any, i: number) => ({
            id: c.id || `cp-${i}-${Date.now()}`,
            text: c.text || '',
            done: !!c.done,
          }))
          : [],
      }
    }
  } catch (e) {
    return { notes: userComment, checkpoints: [] }
  }
  return { notes: userComment, checkpoints: [] }
}

export function parseTitleAndSlot(fullTitle: string) {
  if (fullTitle.includes('|')) {
    const parts = fullTitle.split('|')
    return { code: parts[0].trim(), slot: parts[1].trim() }
  }
  return { code: fullTitle.trim(), slot: '' }
}

// ─── Event Inspector Drawer Component ─────────────────────────────────────────
function EventInspectorDrawer({
  ev,
  onClose,
  onEdit,
  onSaveComment,
}: {
  ev: PlannerEvent
  onClose: () => void
  onEdit: (ev: PlannerEvent) => void
  onSaveComment: (ev: PlannerEvent, data: CommentData) => void
}) {
  const [data, setData] = useState<CommentData>(() => parseCommentData(ev.user_comment))
  const colorProfile = getDeterministicColor(ev.title)

  useEffect(() => {
    setData(parseCommentData(ev.user_comment))
  }, [ev.user_comment])

  const total = data.checkpoints.length
  const completed = data.checkpoints.filter(c => c.done).length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  const toggleCheckpoint = (id: string) => {
    const updated = {
      ...data,
      checkpoints: data.checkpoints.map(c => (c.id === id ? { ...c, done: !c.done } : c)),
    }
    setData(updated)
    onSaveComment(ev, updated)
  }

  const addCheckpoint = () => {
    const newCp: CheckpointItem = {
      id: `cp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      text: '',
      done: false,
    }
    const updated = {
      ...data,
      checkpoints: [...data.checkpoints, newCp],
    }
    setData(updated)
    onSaveComment(ev, updated)
  }

  const updateCheckpointText = (id: string, text: string) => {
    const updated = {
      ...data,
      checkpoints: data.checkpoints.map(c => (c.id === id ? { ...c, text } : c)),
    }
    setData(updated)
  }

  const handleTextBlur = () => {
    onSaveComment(ev, data)
  }

  const deleteCheckpoint = (id: string) => {
    const updated = {
      ...data,
      checkpoints: data.checkpoints.filter(c => c.id !== id),
    }
    setData(updated)
    onSaveComment(ev, updated)
  }

  const updateNotes = (notes: string) => {
    setData(prev => ({ ...prev, notes }))
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="drawer-header" style={{ borderLeft: `5px solid ${colorProfile.border}` }}>
          <div className="drawer-header-info">
            <div className="drawer-badge-row">
              <span className="eb-badge" style={{ backgroundColor: colorProfile.badgeBg, color: colorProfile.text }}>
                {ev.category === 'CLASS' ? 'Lecture' : ev.category.charAt(0) + ev.category.slice(1).toLowerCase()}
              </span>
              {ev.tag === 'CRITICAL' && (
                <span className="eb-priority-pill critical">
                  <span className="eb-priority-dot" /> CRITICAL
                </span>
              )}
              {ev.tag === 'IMPORTANT' && (
                <span className="eb-priority-pill important">
                  <span className="eb-priority-dot" /> IMPORTANT
                </span>
              )}
            </div>
            <h2 className="drawer-title">{ev.title}</h2>
            <div className="drawer-meta">
              <span><Clock size={12} /> {ev.start_time} – {ev.end_time}</span>
              {(ev as any).location && <span><MapPin size={12} /> {(ev as any).location}</span>}
            </div>
          </div>

          <div className="drawer-actions">
            <button className="icon-btn-sm" onClick={() => onEdit(ev)} title="Edit Event">
              <Edit size={14} />
            </button>
            <button className="icon-btn-sm" onClick={onClose} title="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="drawer-body">
          {/* Deadline Section — shown only when deadline_date is set */}
          {ev.deadline_date && (() => {
            const dl = new Date(ev.deadline_date + 'T00:00:00')
            const today = new Date(); today.setHours(0, 0, 0, 0)
            const diffMs = dl.getTime() - today.getTime()
            const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
            const isOverdue = diffDays < 0
            const isDueSoon = diffDays >= 0 && diffDays <= 3
            const badgeClass = isOverdue ? 'deadline-badge overdue' : isDueSoon ? 'deadline-badge soon' : 'deadline-badge upcoming'
            const badgeText = isOverdue
              ? `${Math.abs(diffDays)}d overdue`
              : diffDays === 0 ? 'Due today'
              : diffDays === 1 ? 'Due tomorrow'
              : `${diffDays}d left`
            return (
              <div className="workspace-section deadline-section">
                <div className="workspace-section-header">
                  <div className="workspace-title">
                    <Bell size={14} className="ws-icon" />
                    <span>Deadline</span>
                  </div>
                  <span className={badgeClass}>{badgeText}</span>
                </div>
                <div className="deadline-detail-row">
                  <span className="deadline-date-text">
                    <CalendarIcon size={12} />
                    {dl.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {ev.deadline_label && (
                    <span className="deadline-label-text">{ev.deadline_label}</span>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Checkpoints Section */}
          <div className="workspace-section">
            <div className="workspace-section-header">
              <div className="workspace-title">
                <CheckSquare size={14} className="ws-icon" />
                <span>Checkpoints</span>
                {total > 0 && <span className="ws-count">{completed}/{total}</span>}
              </div>
              <button className="add-cp-btn" onClick={addCheckpoint} type="button">
                <Plus size={12} /> Add Checkpoint
              </button>
            </div>

            {total > 0 && (
              <div className="cp-progress-bar">
                <div className="cp-progress-fill" style={{ width: `${pct}%` }} />
              </div>
            )}

            <div className="cp-list">
              {data.checkpoints.length === 0 ? (
                <div className="cp-empty-hint">No checkpoints added yet. Click "+ Add Checkpoint" to break this event into tasks.</div>
              ) : (
                data.checkpoints.map(cp => (
                  <div key={cp.id} className={`cp-item ${cp.done ? 'done' : ''}`}>
                    <button
                      type="button"
                      className={`cp-checkbox ${cp.done ? 'checked' : ''}`}
                      onClick={() => toggleCheckpoint(cp.id)}
                    >
                      <Check size={11} />
                    </button>
                    <input
                      className="cp-input"
                      placeholder="Write checkpoint..."
                      value={cp.text}
                      onChange={e => updateCheckpointText(cp.id, e.target.value)}
                      onBlur={handleTextBlur}
                      onKeyDown={e => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      }}
                    />
                    <button
                      type="button"
                      className="cp-del-btn"
                      onClick={() => deleteCheckpoint(cp.id)}
                      title="Delete checkpoint"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Notes Section */}
          <div className="workspace-section notes-section">
            <div className="workspace-section-header">
              <div className="workspace-title">
                <FileText size={14} className="ws-icon" />
                <span>Notes & Takeaways</span>
              </div>
            </div>
            <textarea
              className="ws-notes-textarea"
              placeholder="Type lecture notes, key formulas, or takeaways..."
              rows={5}
              value={data.notes}
              onChange={e => updateNotes(e.target.value)}
              onBlur={handleTextBlur}
            />
          </div>
        </div>
      </div>
    </div>
  )
}


// ─── Constants ────────────────────────────────────────────────────────────────
const HOURS = Array.from({ length: 24 }, (_, i) => i)  // 00:00 – 23:00
const ACTIVE_ROW_HEIGHT = 96   // px — hour rows that overlap events
const EMPTY_ROW_HEIGHT = 32   // px — consecutive empty hour rows
const TODAY_STR = formatYYYYMMDD(new Date())

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const FULL_DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']




// ─── Date / Grid Helpers ──────────────────────────────────────────────────────
function formatYYYYMMDD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseTimeToFloat(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h + m / 60
}

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1))
  return date
}

function compressImageToBlob(file: File, maxDim = 1200, quality = 0.72): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Canvas blob null')),
        'image/jpeg',
        quality
      )
    }
    img.onerror = reject
    img.src = url
  })
}

function getDaysInMonth(d: Date): { date: Date; isCurrentMonth: boolean }[] {
  const year = d.getFullYear()
  const month = d.getMonth()
  const firstDayIndex = new Date(year, month, 1).getDay()
  const numDays = new Date(year, month + 1, 0).getDate()
  const prevMonthNumDays = new Date(year, month, 0).getDate()

  const prev = Array.from({ length: firstDayIndex }, (_, i) => ({
    date: new Date(year, month - 1, prevMonthNumDays - firstDayIndex + i + 1),
    isCurrentMonth: false,
  }))
  const curr = Array.from({ length: numDays }, (_, i) => ({
    date: new Date(year, month, i + 1),
    isCurrentMonth: true,
  }))
  const total = prev.length + curr.length
  const remaining = total % 7 === 0 ? 0 : 7 - (total % 7)
  const next = Array.from({ length: remaining }, (_, i) => ({
    date: new Date(year, month + 1, i + 1),
    isCurrentMonth: false,
  }))
  return [...prev, ...curr, ...next]
}

// ─── Row-height engine ────────────────────────────────────────────────────────
function computeRowHeights(activeHours: Set<number>): number[] {
  return HOURS.map(h => activeHours.has(h) ? ACTIVE_ROW_HEIGHT : EMPTY_ROW_HEIGHT)
}

function offsetForHour(h: number, rowHeights: number[]): number {
  let offset = 0
  for (let i = 0; i < h; i++) offset += rowHeights[i]
  return offset
}

function heightForEvent(startFloat: number, endFloat: number, rowHeights: number[]): number {
  let px = 0
  const startHour = Math.floor(startFloat)
  const endHour = Math.ceil(endFloat)
  for (let hr = startHour; hr < endHour; hr++) {
    if (hr < 0 || hr > 23) continue
    const idx = hr
    const fracStart = hr === startHour ? 1 - (startFloat - startHour) : 1
    const fracEnd = hr === endHour - 1 ? (endFloat - Math.floor(endFloat)) || 1 : 1
    const frac = Math.min(fracStart, fracEnd)
    px += rowHeights[idx] * frac
  }
  return Math.max(px, 20)
}

type EvPos = PlannerEvent & { col: number; totalCols: number }

function positionDayEvents(dayEvents: PlannerEvent[]): EvPos[] {
  if (!dayEvents.length) return []

  const sorted = [...dayEvents].sort((a, b) => {
    const sa = parseTimeToFloat(a.start_time)
    const sb = parseTimeToFloat(b.start_time)
    if (sa !== sb) return sa - sb
    const durA = parseTimeToFloat(a.end_time) - sa
    const durB = parseTimeToFloat(b.end_time) - sb
    return durB - durA
  })

  const clusters: PlannerEvent[][] = []
  let currentCluster: PlannerEvent[] = []
  let clusterMaxEnd = -1

  sorted.forEach(ev => {
    const s = parseTimeToFloat(ev.start_time)
    const en = parseTimeToFloat(ev.end_time)
    if (currentCluster.length === 0) {
      currentCluster.push(ev)
      clusterMaxEnd = en
    } else if (s < clusterMaxEnd) {
      currentCluster.push(ev)
      if (en > clusterMaxEnd) clusterMaxEnd = en
    } else {
      clusters.push(currentCluster)
      currentCluster = [ev]
      clusterMaxEnd = en
    }
  })
  if (currentCluster.length > 0) {
    clusters.push(currentCluster)
  }

  const result: EvPos[] = []

  clusters.forEach(cluster => {
    const clusterPositioned: EvPos[] = []
    cluster.forEach(ev => {
      const s = parseTimeToFloat(ev.start_time)
      const en = parseTimeToFloat(ev.end_time)

      const overlapping = clusterPositioned.filter(p => {
        const ps = parseTimeToFloat(p.start_time)
        const pen = parseTimeToFloat(p.end_time)
        return ps < en && pen > s
      })

      const usedCols = new Set(overlapping.map(p => p.col))
      let col = 0
      while (usedCols.has(col)) col++
      clusterPositioned.push({ ...ev, col, totalCols: 1 })
    })

    const maxCols = Math.max(1, ...clusterPositioned.map(p => p.col + 1))
    clusterPositioned.forEach(p => {
      p.totalCols = maxCols
      result.push(p)
    })
  })

  return result
}

// ─── Default form ─────────────────────────────────────────────────────────────
const defaultForm = () => ({
  title: '',
  description: '',
  location: '',
  date: formatYYYYMMDD(new Date()),
  start_time: '09:00',
  end_time: '10:00',
  tag: 'OPTIONAL' as 'CRITICAL' | 'IMPORTANT' | 'OPTIONAL',
  category: 'PERSONAL' as 'CLASS' | 'EXAM' | 'PERSONAL' | 'SLEEP' | 'RECREATION' | 'OTHER',
  is_working_hour: false,
  link: '',
  is_recurring: false,
  recurrence_days: [] as number[],
  deadline_date: '',    // YYYY-MM-DD, empty = no deadline
  deadline_label: '',   // e.g. "Assignment 2"
})

type EditScope = 'all' | 'instance'

// ─── Component ────────────────────────────────────────────────────────────────
function Planner() {
  // Auto-detect mobile and default to day view
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>(isMobile ? 'day' : 'week')
  const [currentDate, setCurrentDate] = useState(new Date())

  const [now, setNow] = useState(new Date())

  // Keep now indicator updated every 60 seconds
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Auto-switch to Day view on mobile screen load/orientation change
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setViewMode('day')
    }
  }, [])

  // ── Shared data layer ──────────────────────────────────────────────────────
  const { events, loading, fetchEvents, fetchCapacity, invalidate } = usePlannerData()

  useEffect(() => {
    fetchEvents(viewMode, currentDate)
  }, [viewMode, currentDate, fetchEvents])

  useEffect(() => {
    if (viewMode === 'month') fetchCapacity(currentDate)
  }, [viewMode, currentDate, fetchCapacity])

  // ── Modal ──────────────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<PlannerEvent | null>(null)
  const [form, setForm] = useState(defaultForm())
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [editScope, setEditScope] = useState<EditScope>('all')

  // ── Popover & Inspector Drawer ──────────────────────────────────────────────
  const [popoverEvent, setPopoverEvent] = useState<PlannerEvent | null>(null)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const [inspectorEvent, setInspectorEvent] = useState<PlannerEvent | null>(null)

  // ── Undo ───────────────────────────────────────────────────────────────────
  const [lastDeletedId, setLastDeletedId] = useState<number | null>(null)
  const [showUndo, setShowUndo] = useState(false)
  const undoTimer = useRef<ReturnType<typeof setTimeout>>()

  // ── OCR ────────────────────────────────────────────────────────────────────
  const [showOcr, setShowOcr] = useState(false)
  const [timetableImage, setTimetableImage] = useState<string | null>(null)
  const [rawFile, setRawFile] = useState<File | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleDeduplicateEntries = () => {
    const seen = new Set<string>()
    const unique = timetableEntries.filter(entry => {
      const key = `${entry.day}-${entry.startTime}-${entry.endTime}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    setTimetableEntries(unique)
  }

  const handleFilterBatch = (batchLetter: string) => {
    const filtered = timetableEntries.filter(entry => {
      const subj = entry.subject.toUpperCase()
      return subj.includes(batchLetter) || subj.endsWith(batchLetter)
    })
    if (filtered.length > 0) {
      setTimetableEntries(filtered)
    }
  }

  // ── Deadlines ──────────────────────────────────────────────────────────────
  const [deadlines, setDeadlines] = useState<PlannerEvent[]>([])
  const [showDeadlines, setShowDeadlines] = useState(true)

  const fetchDeadlines = async () => {
    try {
      const res = await api.get<PlannerEvent[]>('/events/deadlines?days=21')
      setDeadlines(res.data)
    } catch (err) {
      console.error('Failed to fetch deadlines', err)
    }
  }

  useEffect(() => {
    fetchDeadlines()
  }, [])

  // ── Navigation ─────────────────────────────────────────────────────────────
  const navigate = (dir: -1 | 1) => {
    setCurrentDate(prev => {
      const d = new Date(prev)
      if (viewMode === 'day') d.setDate(d.getDate() + dir)
      else if (viewMode === 'week') d.setDate(d.getDate() + dir * 7)
      else d.setMonth(d.getMonth() + dir)
      return d
    })
  }

  const headerTitle = (): string => {
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    }
    if (viewMode === 'week') {
      const mon = getMonday(currentDate)
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      if (mon.getMonth() === sun.getMonth())
        return `${mon.getDate()} – ${sun.getDate()} ${mon.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
      return `${mon.getDate()} ${mon.toLocaleDateString('en-US', { month: 'short' })} – ${sun.getDate()} ${sun.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
    }
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const openCreate = (prefillDate?: string, prefillHour?: number) => {
    setSelectedEvent(null)
    setFormErrors([])
    setEditScope('all')
    const f = defaultForm()
    if (prefillDate) f.date = prefillDate
    if (prefillHour !== undefined) {
      f.start_time = `${String(prefillHour).padStart(2, '0')}:00`
      f.end_time = `${String(prefillHour + 1).padStart(2, '0')}:00`
    }
    setForm(f)
    setShowModal(true)
  }

  const openEdit = (ev: PlannerEvent) => {
    setPopoverEvent(null); setPopoverPos(null)
    setSelectedEvent(ev)
    setFormErrors([])
    setEditScope('all')
    setForm({
      title: ev.title,
      description: ev.description || '',
      location: (ev as any).location || '',
      date: ev.date || formatYYYYMMDD(currentDate),
      start_time: ev.start_time,
      end_time: ev.end_time,
      tag: ev.tag,
      category: ev.category,
      is_working_hour: ev.is_working_hour,
      link: ev.link || '',
      is_recurring: ev.is_recurring,
      recurrence_days: ev.recurrence_day !== undefined ? [ev.recurrence_day] : [],
      deadline_date: ev.deadline_date || '',
      deadline_label: ev.deadline_label || '',
    })
    setShowModal(true)
  }

  const handleEventClick = (e: React.MouseEvent, ev: PlannerEvent) => {
    e.stopPropagation()
    setInspectorEvent(ev)
  }

  // ── Form submit ────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: string[] = []
    if (!form.title.trim()) errors.push('Title is required.')
    const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/
    if (!timeRe.test(form.start_time)) errors.push('Start time must be HH:MM.')
    if (!timeRe.test(form.end_time)) errors.push('End time must be HH:MM.')
    if (!errors.length && parseTimeToFloat(form.start_time) >= parseTimeToFloat(form.end_time))
      errors.push('Start time must be before end time.')
    if (form.is_recurring && !form.recurrence_days.length)
      errors.push('Select at least one recurrence day.')
    if (!form.is_recurring && !form.date)
      errors.push('Date is required.')
    if (errors.length) { setFormErrors(errors); return }

    setSaving(true)
    try {
      if (selectedEvent && selectedEvent.id) {
        if (selectedEvent.is_recurring && editScope === 'instance') {
          // ── "This Instance Only" — call PATCH with instance detaching info ──
          await api.patch(`/events/${selectedEvent.id}`, {
            title: form.title,
            description: form.description,
            location: form.location,
            date: null,
            start_time: form.start_time,
            end_time: form.end_time,
            tag: form.tag,
            category: form.category,
            is_working_hour: form.is_working_hour,
            link: form.link || null,
            is_recurring: form.is_recurring,
            recurrence_day: form.is_recurring ? (form.recurrence_days[0] ?? null) : null,
            edit_scope: 'instance',
            instance_date: selectedEvent.date || form.date,
            deadline_date: form.deadline_date || null,
            deadline_label: form.deadline_label || null,
          })
        } else {
          // ── "All Occurrences" or non-recurring edit — standard PATCH ────────
          await api.patch(`/events/${selectedEvent.id}`, {
            title: form.title,
            description: form.description,
            location: form.location,
            date: form.is_recurring ? null : form.date,
            start_time: form.start_time,
            end_time: form.end_time,
            tag: form.tag,
            category: form.category,
            is_working_hour: form.is_working_hour,
            link: form.link || null,
            is_recurring: form.is_recurring,
            recurrence_day: form.is_recurring ? (form.recurrence_days[0] ?? null) : null,
            deadline_date: form.deadline_date || null,
            deadline_label: form.deadline_label || null,
          })
        }
      } else {
        // ── Brand-new event creation — POST ──────────────────────────────────
        if (form.is_recurring && form.recurrence_days.length > 1) {
          // Multi-day recurring: parallel creation, one DB row per day
          await Promise.all(
            form.recurrence_days.map(day =>
              api.post('/events/', {
                title: form.title,
                description: form.description,
                location: form.location,
                date: null,
                start_time: form.start_time,
                end_time: form.end_time,
                tag: form.tag,
                category: form.category,
                is_working_hour: form.is_working_hour,
                link: form.link || null,
                is_recurring: true,
                recurrence_day: day,
                deadline_date: form.deadline_date || null,
                deadline_label: form.deadline_label || null,
              })
            )
          )
        } else {
          await api.post('/events/', {
            title: form.title,
            description: form.description,
            location: form.location,
            date: form.is_recurring ? null : form.date,
            start_time: form.start_time,
            end_time: form.end_time,
            tag: form.tag,
            category: form.category,
            is_working_hour: form.is_working_hour,
            link: form.link || null,
            is_recurring: form.is_recurring,
            recurrence_day: form.is_recurring ? (form.recurrence_days[0] ?? null) : null,
            deadline_date: form.deadline_date || null,
            deadline_label: form.deadline_label || null,
          })
        }
      }

      setShowModal(false)
      invalidate()   // ← single cache-bust; refreshes events + capacity
      fetchDeadlines()  // ← refresh deadline strip after any mutation
    } catch (err: any) {
      const d = err.response?.data?.detail
      setFormErrors(Array.isArray(d) ? d.map((e: any) => e.msg) : [d || 'Request failed.'])
    } finally {
      setSaving(false)
    }
  }

  // ── Soft-delete / restore ──────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!selectedEvent) return
    try {
      await api.delete(`/events/${selectedEvent.id}`)
      setLastDeletedId(selectedEvent.id)
      setShowUndo(true)
      setShowModal(false)
      invalidate()
      clearTimeout(undoTimer.current)
      undoTimer.current = setTimeout(() => setShowUndo(false), 10_000)
    } catch (err) { console.error('Delete failed', err) }
  }

  const handleUndo = async () => {
    if (!lastDeletedId) return
    try {
      await api.post(`/events/${lastDeletedId}/undelete`)
      setLastDeletedId(null)
      setShowUndo(false)
      invalidate()
    } catch (err) { console.error('Restore failed', err) }
  }

  // ── Comment & Checkpoints saving ──────────────────────────────────────────
  const handleSaveCommentData = async (ev: PlannerEvent, newData: CommentData) => {
    const jsonStr = JSON.stringify(newData)
    if (jsonStr === (ev.user_comment ?? '')) return
    try {
      await api.patch(`/events/${ev.id}`, { user_comment: jsonStr })
      invalidate()
    } catch (err) { console.error('Comment save failed', err) }
  }

  // ── Canvas compression → OCR ───────────────────────────────────────────────
  const processFile = (file: File) => {
    setRawFile(file)
    const reader = new FileReader()
    reader.onload = () => setTimetableImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('image/')) processFile(file)
  }

  const triggerScan = async () => {
    if (!rawFile) return
    setIsScanning(true); setScanProgress(10)
    try {
      const compressed = await compressImageToBlob(rawFile)
      setScanProgress(30)
      const fd = new FormData()
      fd.append('file', compressed, 'timetable.jpg')
      setScanProgress(50)
      const res = await api.post('/events/scan-timetable', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: p => {
          if (p.total) setScanProgress(50 + Math.round((p.loaded / p.total) * 35))
        },
      })
      setScanProgress(90)
      const parsed = res.data
      if (!parsed.timetable || !Array.isArray(parsed.timetable))
        throw new Error('Invalid AI response format.')
      setTimetableEntries(parsed.timetable)
      setScanProgress(100)
    } catch (err: any) {
      alert(`Scan failed: ${err.response?.data?.detail || err.message}`)
    } finally { setIsScanning(false) }
  }

  const handleImport = async () => {
    if (!timetableEntries.length) return
    try {
      await api.post('/events/import-timetable', { timetable: timetableEntries })
      setTimetableEntries([]); setTimetableImage(null); setRawFile(null); setShowOcr(false)
      invalidate()
    } catch (err: any) { alert(err.response?.data?.detail || 'Import failed.') }
  }

  const handleClearTimetable = async () => {
    if (!window.confirm("Are you sure you want to clear all imported timetable classes?")) return
    try {
      await api.delete('/events/clear-timetable')
      invalidate()
      alert("Imported timetable classes cleared successfully.")
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to clear timetable.')
    }
  }

  // ── Grid geometry ──────────────────────────────────────────────────────────
  const mon = getMonday(currentDate)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i); return d
  })
  const activeDays = viewMode === 'day' ? [currentDate] : weekDays

  const activeHourSet = new Set<number>()
  activeDays.forEach(day => {
    const dayStr = formatYYYYMMDD(day)
    events.filter(e => e.date === dayStr).forEach(ev => {
      const s = Math.max(Math.floor(parseTimeToFloat(ev.start_time)), 0)
      const en = Math.min(Math.ceil(parseTimeToFloat(ev.end_time)), 24)
      for (let h = s; h < en; h++) activeHourSet.add(h)
    })
  })

  const rowHeights = computeRowHeights(activeHourSet)
  const totalGridHeight = rowHeights.reduce((a, b) => a + b, 0)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="planner-page">

      {/* ── Undo banner ── */}
      {showUndo && (
        <div className="undo-banner">
          <div className="undo-banner-left">
            <AlertTriangle size={14} />
            <span>Event deleted.</span>
          </div>
          <button className="undo-btn" onClick={handleUndo}>
            <RotateCcw size={12} /> Undo
          </button>
        </div>
      )}

      {/* ── Shell header ── */}
      <div className="planner-shell">
        <div className="planner-title-block">
          <h1 className="planner-title">{headerTitle()}</h1>
          <span className="planner-subtitle">
            {viewMode === 'day' ? 'Day View' : viewMode === 'week' ? 'Week View' : 'Month View'}
          </span>
        </div>

        <div className="planner-controls">
          <div className="view-toggles">
            {(['day', 'week', 'month'] as const).map(v => (
              <button
                key={v}
                className={`view-btn${viewMode === v ? ' active' : ''}`}
                onClick={() => setViewMode(v)}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          <div className="nav-cluster">
            <button className="nav-btn" onClick={() => navigate(-1)}><ChevronLeft size={16} /></button>
            <button className="nav-btn" onClick={() => navigate(1)}><ChevronRight size={16} /></button>
            <button className="today-btn" onClick={() => setCurrentDate(new Date())}>Today</button>
          </div>

          <div className="action-cluster">
            <button className="primary-btn" onClick={() => openCreate()}>
              <Plus size={15} /> Add Event
            </button>
            <button
              className={`ocr-btn${showOcr ? ' active' : ''}`}
              onClick={() => setShowOcr(!showOcr)}
            >
              <Scan size={15} /> Timetable AI
            </button>
            <button
              className="danger-btn clear-tt-btn"
              onClick={handleClearTimetable}
              title="Clear all imported timetable classes"
            >
              <Trash2 size={15} /> Clear Timetable
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Day Selector Strip (Visible on mobile/tablet) ── */}
      {viewMode !== 'month' && (
        <div className="mobile-day-strip">
          {weekDays.map((d, i) => {
            const dStr = formatYYYYMMDD(d)
            const isSelected = viewMode === 'day' && formatYYYYMMDD(currentDate) === dStr
            const isToday = dStr === TODAY_STR
            const dayEvtsCount = events.filter(e => e.date === dStr).length
            return (
              <button
                key={i}
                type="button"
                className={`mobile-day-pill${isSelected ? ' active' : ''}${isToday ? ' today' : ''}`}
                onClick={() => {
                  setCurrentDate(d)
                  setViewMode('day')
                }}
              >
                <span className="mdp-name">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <span className="mdp-num">{d.getDate()}</span>
                {dayEvtsCount > 0 && (
                  <span className={`mdp-count-chip${isSelected ? ' on-active' : ''}`}>{dayEvtsCount}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Upcoming Deadlines Strip ── */}
      {(deadlines.length > 0 || showDeadlines) && (
        <div className="deadlines-panel">
          <div className="deadlines-panel-header">
            <div className="deadlines-panel-title">
              <Bell size={15} />
              <span>Upcoming Deadlines</span>
              {deadlines.length > 0 && <span className="deadlines-count">{deadlines.length}</span>}
            </div>
            <button
              className="deadlines-toggle-btn"
              onClick={() => setShowDeadlines(v => !v)}
              title={showDeadlines ? 'Collapse' : 'Expand'}
            >
              {showDeadlines ? <ChevronLeft size={14} style={{ transform: 'rotate(-90deg)' }} /> : <ChevronLeft size={14} style={{ transform: 'rotate(90deg)' }} />}
            </button>
          </div>

          {showDeadlines && (
            <div className="deadlines-list">
              {deadlines.length === 0 ? (
                <div className="deadlines-empty">
                  <CalendarIcon size={16} />
                  <span>No deadlines in the next 21 days. Add one via Edit Event.</span>
                </div>
              ) : (
                deadlines.map(dl => {
                  const dlDate = new Date(dl.deadline_date! + 'T00:00:00')
                  const today = new Date(); today.setHours(0, 0, 0, 0)
                  const diffDays = Math.round((dlDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                  const isOverdue = diffDays < 0
                  const isDueSoon = diffDays >= 0 && diffDays <= 3
                  const countdownClass = isOverdue ? 'dl-countdown overdue' : isDueSoon ? 'dl-countdown soon' : 'dl-countdown upcoming'
                  const countdownText = isOverdue
                    ? `${Math.abs(diffDays)}d overdue`
                    : diffDays === 0 ? 'Today'
                    : diffDays === 1 ? 'Tomorrow'
                    : `${diffDays}d`
                  return (
                    <div
                      key={`${dl.id}-${dl.deadline_date}`}
                      className={`deadline-card${isOverdue ? ' overdue' : isDueSoon ? ' soon' : ''}`}
                      onClick={() => openEdit(dl)}
                      title={`Click to edit ${dl.title}`}
                    >
                      <div className="dl-card-main">
                        <span className="dl-event-title">{dl.title}</span>
                        {dl.deadline_label && (
                          <span className="dl-label">{dl.deadline_label}</span>
                        )}
                      </div>
                      <div className="dl-card-meta">
                        <span className="dl-date">
                          {dlDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                        <span className={countdownClass}>{countdownText}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* ── OCR section ── */}
      {showOcr && (
        <div className="ocr-section">
          <div className="ocr-section-header">
            <div>
              <div className="ocr-title">AI Timetable Scanner</div>
              <div className="ocr-subtitle">
                Upload a machine-printed timetable. Images are canvas-compressed client-side before upload.
              </div>
            </div>
            <button
              className="icon-btn"
              onClick={() => { setShowOcr(false); setTimetableImage(null); setTimetableEntries([]) }}
            >
              <X size={18} />
            </button>
          </div>

          {!timetableImage ? (
            <div
              className={`upload-zone${isDragging ? ' dragging' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <Upload size={30} className="upload-icon" />
              <p className="upload-label">Drag & drop or click to upload timetable image</p>
              <p className="upload-hint">PNG · JPG · WEBP — auto-compressed to JPEG before upload</p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </div>
          ) : (
            <div className="preview-area">
              <img src={timetableImage} className="preview-img" alt="Timetable preview" />
              <div className="preview-controls">
                {isScanning ? (
                  <div className="scan-progress-block">
                    <div className="scan-progress-label">
                      <Loader2 size={13} className="spin" />
                      <span>Compressing & parsing with Gemini Vision…</span>
                      <strong>{scanProgress}%</strong>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${scanProgress}%` }} />
                    </div>
                  </div>
                ) : (
                  <div className="scan-btn-row">
                    <button className="primary-btn" onClick={triggerScan}>
                      <Scan size={13} /> Run AI Scan
                    </button>
                    <button className="ghost-btn" onClick={() => {
                      setTimetableImage(null); setRawFile(null); setTimetableEntries([])
                    }}>
                      <X size={13} /> Clear
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {timetableImage && !isScanning && (
            <div className="tt-table-wrap">
              {!timetableEntries.length ? (
                <div className="tt-empty">
                  No entries detected. Run the AI scan or add rows manually.
                </div>
              ) : (
                <>
                  <div className="tt-tools-bar">
                    <div className="tt-batch-filter-group">
                      <span className="tt-filter-label">Quick Division Filter:</span>
                      <button type="button" className="tt-batch-btn" onClick={() => handleFilterBatch('A')}>Div A (1A/4A/5A)</button>
                      <button type="button" className="tt-batch-btn" onClick={() => handleFilterBatch('B')}>Div B (1B/4B/5B)</button>
                      <button type="button" className="tt-batch-btn" onClick={() => handleFilterBatch('C')}>Div C (1C/4C/5C)</button>
                    </div>
                    <button type="button" className="ghost-btn-sm" onClick={handleDeduplicateEntries} title="Keep only 1 class per time slot">
                      Clean Overlapping Duplicates
                    </button>
                  </div>
                  <table className="tt-table">
                  <thead>
                    <tr><th>Day</th><th>Start</th><th>End</th><th>Subject</th><th /></tr>
                  </thead>
                  <tbody>
                    {timetableEntries.map((entry, idx) => (
                      <tr key={idx} className={entry.needsReview ? 'tt-row-review' : ''}>
                        <td>
                          <select
                            className="tt-select"
                            value={entry.day}
                            onChange={e => {
                            const u = [...timetableEntries]
                              u[idx] = { ...u[idx], day: parseInt(e.target.value) }
                              setTimetableEntries(u)
                            }}
                          >
                            {FULL_DAY_LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
                          </select>
                        </td>
                        <td>
                          <input className="tt-input" type="text" value={entry.startTime}
                            onChange={e => {
                              const u = [...timetableEntries]
                              u[idx] = { ...u[idx], startTime: e.target.value }
                              setTimetableEntries(u)
                            }} />
                        </td>
                        <td>
                          <input className="tt-input" type="text" value={entry.endTime}
                            onChange={e => {
                              const u = [...timetableEntries]
                              u[idx] = { ...u[idx], endTime: e.target.value }
                              setTimetableEntries(u)
                            }} />
                        </td>
                        <td>
                          <input className="tt-input tt-subject" type="text" value={entry.subject}
                            onChange={e => {
                              const u = [...timetableEntries]
                              u[idx] = { ...u[idx], subject: e.target.value }
                              setTimetableEntries(u)
                            }} />
                        </td>
                        <td>
                          <button
                            className="icon-btn danger-icon"
                            onClick={() => setTimetableEntries(timetableEntries.filter((_, i) => i !== idx))}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
              )}
              <div className="tt-actions">
                <button
                  className="ghost-btn"
                  onClick={() => setTimetableEntries([...timetableEntries, {
                    day: 1, startTime: '09:00', endTime: '10:00', subject: 'New Class', needsReview: false,
                  }])}
                >
                  <Plus size={13} /> Add Row
                </button>
                <button
                  className="primary-btn"
                  disabled={!timetableEntries.length}
                  onClick={handleImport}
                >
                  <Check size={13} /> Import ({timetableEntries.length})
                </button>
              </div>
            </div>
          )}
        </div>
      )}


      {/* ── Main Layout: Calendar Grid + Deadline Tracker Sidebar ── */}
      <div className="planner-main-content-layout">
        <div className="planner-grid-container">
          {loading ? (
            <div className="grid-loading">
              <Loader2 size={26} className="spin" />
              <span>Loading events…</span>
            </div>
          ) : viewMode === 'month' ? (
            /* ── Month grid ── */
            <div className="month-grid">
              {DAY_LABELS.map(d => (
                <div key={d} className="month-header-cell">{d}</div>
              ))}
              {getDaysInMonth(currentDate).map((cell, idx) => {
                const cellStr = formatYYYYMMDD(cell.date)
                const isToday = cellStr === TODAY_STR
                const cellEvts = events.filter(e => e.date === cellStr)

                const lectures = cellEvts
                  .filter(e => e.category === 'CLASS')
                  .sort((a, b) => parseTimeToFloat(a.start_time) - parseTimeToFloat(b.start_time))

                const otherEvts = cellEvts
                  .filter(e => e.category !== 'CLASS')
                  .sort((a, b) => parseTimeToFloat(a.start_time) - parseTimeToFloat(b.start_time))

                return (
                  <div
                    key={idx}
                    className={`month-day${cell.isCurrentMonth ? '' : ' inactive'}${isToday ? ' today' : ''}`}
                    onClick={() => {
                      if (cell.isCurrentMonth) { setCurrentDate(cell.date); setViewMode('day') }
                    }}
                  >
                    <div className="month-day-header">
                      <span className="month-day-num">{cell.date.getDate()}</span>
                    </div>
                    <div className="month-pills">
                      {lectures.length > 0 && (
                        <div className="month-lectures-row" onClick={e => e.stopPropagation()}>
                          {lectures.map((lev) => {
                            const { code } = parseTitleAndSlot(lev.title)
                            const colorProfile = getDeterministicColor(lev.title)
                            return (
                              <span
                                key={lev.id}
                                className="month-course-chip"
                                style={{
                                  backgroundColor: colorProfile.badgeBg,
                                  color: colorProfile.text,
                                  borderColor: colorProfile.border + '50',
                                }}
                                onClick={() => openEdit(lev)}
                                title={`${lev.title} (${lev.start_time}–${lev.end_time})`}
                              >
                                {code}
                              </span>
                            )
                          })}
                        </div>
                      )}

                      {otherEvts.slice(0, 2).map(ev => {
                        const colorProfile = getDeterministicColor(ev.title)
                        const shortLabel = getEventShortLabel(ev.title, ev.category)
                        return (
                          <div
                            key={ev.id}
                            className={`month-pill tag-${ev.tag.toLowerCase()}`}
                            style={{
                              backgroundColor: colorProfile.bg,
                              color: colorProfile.text,
                              borderLeft: `3px solid ${colorProfile.border}`,
                            }}
                            onClick={e => { e.stopPropagation(); openEdit(ev) }}
                            title={`${ev.title} (${ev.tag})`}
                          >
                            <span className="month-pill-title">{shortLabel}</span>
                          </div>
                        )
                      })}
                      {otherEvts.length > 2 && (
                        <span className="month-overflow">+{otherEvts.length - 2} more</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* ── Day / Week grid ── */
            <div className={`timeline-container ${viewMode === 'day' ? 'is-day-view' : 'is-week-view'}`}>
              {/* Column headers */}
              <div className={`timeline-header ${viewMode === 'day' ? 'is-day-view' : 'is-week-view'}`}>
                <div className="time-gutter-header" />
                {activeDays.map((day, i) => {
                  const dayStr = formatYYYYMMDD(day)
                  const isToday = dayStr === TODAY_STR
                  return (
                    <div key={i} className={`col-header${isToday ? ' today' : ''}`}>
                      <span className={`col-day-num${isToday ? ' today-num' : ''}`}>
                        {day.getDate()}
                      </span>
                      <span className="col-day-name">
                        {day.toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className={`timeline-body ${viewMode === 'day' ? 'is-day-view' : 'is-week-view'}`} style={{ height: totalGridHeight }}>
                {/* Time gutter */}
                <div className="time-gutter">
                  {HOURS.map((h, i) => (
                    <div
                      key={h}
                      className="time-label"
                      style={{ height: rowHeights[i], top: offsetForHour(h, rowHeights) }}
                    >
                      {String(h).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                {/* Static Lunch Break block (13:00 - 14:00) */}
                {(() => {
                  const s = 13
                  const en = 14
                  const topOffset = offsetForHour(s, rowHeights)
                  const blockH = heightForEvent(s, en, rowHeights)
                  return (
                    <div
                      className="timeline-lunch-block"
                      style={{
                        top: topOffset,
                        height: blockH,
                        left: 52,
                        width: 'calc(100% - 52px)',
                      }}
                    >
                      <div className="lunch-label">LUNCH</div>
                    </div>
                  )
                })()}

                {/* Day columns */}
                {activeDays.map((day, dayIdx) => {
                  const dayStr = formatYYYYMMDD(day)
                  const dayEvents = events.filter(e => e.date === dayStr)
                  const positioned = positionDayEvents(dayEvents)

                  return (
                    <div key={dayIdx} className="day-col">
                      {HOURS.map((h, hIdx) => (
                        <div
                          key={h}
                          className={`hour-cell${activeHourSet.has(h) ? ' active-hour' : ' empty-hour'}`}
                          style={{ height: rowHeights[hIdx] }}
                          onClick={() => openCreate(dayStr, h)}
                          title={`${String(h).padStart(2, '0')}:00 — ${dayStr}`}
                        />
                      ))}

                      {positioned.map(ev => {
                        const s = Math.max(parseTimeToFloat(ev.start_time), 0)
                        const en = Math.min(parseTimeToFloat(ev.end_time), 24)
                        if (s >= en) return null

                        const topOffset = offsetForHour(Math.floor(s), rowHeights)
                          + (s - Math.floor(s)) * rowHeights[Math.floor(s)]
                        const blockH = heightForEvent(s, en, rowHeights)
                        const colW = 100 / ev.totalCols
                        const colL = ev.col * colW
                        const colorProfile = getDeterministicColor(ev.title)
                        const isCompact = blockH < 55
                        const isNarrow = ev.totalCols > 1

                        const commentData = parseCommentData(ev.user_comment)
                        const cpTotal = commentData.checkpoints.length
                        const cpDone = commentData.checkpoints.filter(c => c.done).length
                        const hasNotes = !!commentData.notes.trim()

                        return (
                          <div
                            key={ev.id}
                            className={`event-block${ev.is_completed ? ' completed' : ''}${isCompact ? ' eb-compact' : ''}${isNarrow ? ' eb-narrow' : ''}`}
                            style={{
                              top: topOffset,
                              height: blockH,
                              left: `calc(${colL}% + 2px)`,
                              width: `calc(${colW}% - 4px)`,
                              zIndex: 5 + ev.col,
                              '--eb-accent': colorProfile.accentStrip,
                              '--eb-text': colorProfile.text,
                            } as React.CSSProperties}
                            onClick={e => handleEventClick(e, ev)}
                          >
                            {isCompact ? (
                              <div className="eb-compact-row">
                                <span className="eb-title" title={ev.title}>{ev.title}</span>
                                <span className="eb-time">{ev.start_time}</span>
                              </div>
                            ) : (
                              <div className="eb-card-inner">
                                <div className="eb-header">
                                  <span className="eb-badge" style={{ backgroundColor: colorProfile.badgeBg, color: colorProfile.text }}>
                                    {ev.category === 'CLASS' ? 'Lecture' : ev.category.charAt(0) + ev.category.slice(1).toLowerCase()}
                                  </span>

                                  {ev.tag === 'CRITICAL' && (
                                    <span className="eb-priority-pill critical">
                                      <span className="eb-priority-dot" /> CRITICAL
                                    </span>
                                  )}
                                  {ev.tag === 'IMPORTANT' && (
                                    <span className="eb-priority-pill important">
                                      <span className="eb-priority-dot" /> IMPORTANT
                                    </span>
                                  )}
                                </div>
                                
                                <div className="eb-body">
                                  {(() => {
                                    const { code, slot } = parseTitleAndSlot(ev.title)
                                    return (
                                      <div className="eb-title-container">
                                        <h4 className="eb-title-code">{code}</h4>
                                        {slot && <span className="eb-slot-tag">{slot}</span>}
                                      </div>
                                    )
                                  })()}
                                </div>
                                
                                <div className="eb-footer">
                                  <div className="eb-meta-chips">
                                    <span className="eb-meta-chip">
                                      <Clock size={11} />
                                      <span>{ev.start_time}–{ev.end_time}</span>
                                    </span>
                                    {(ev as any).location && (
                                      <span className="eb-meta-chip location" title={(ev as any).location}>
                                        <MapPin size={11} />
                                        <span>{(ev as any).location}</span>
                                      </span>
                                    )}
                                  </div>

                                  {viewMode === 'day' && blockH >= 75 && (
                                    <div className="eb-actions-footer" onClick={e => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        className={`eb-action-pill ${cpTotal > 0 ? 'active' : ''}`}
                                        onClick={() => setInspectorEvent(ev)}
                                        title="Checkpoints & Tasks"
                                      >
                                        <CheckSquare size={11} />
                                        <span>{cpTotal > 0 ? `${cpDone}/${cpTotal}` : '+ Task'}</span>
                                      </button>

                                      <button
                                        type="button"
                                        className={`eb-action-pill ${hasNotes ? 'active' : ''}`}
                                        onClick={() => setInspectorEvent(ev)}
                                        title="Notes & Takeaways"
                                      >
                                        <FileText size={11} />
                                        <span>{hasNotes ? 'Notes •' : 'Notes'}</span>
                                      </button>

                                      {ev.link && (
                                        <button
                                          type="button"
                                          className="eb-action-pill link"
                                          onClick={() => window.open(ev.link, '_blank', 'noopener,noreferrer')}
                                          title="Open Link"
                                        >
                                          <LinkIcon size={11} />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {/* ── Live Current Time Indicator (Red line on Today) ── */}
                      {dayStr === TODAY_STR && (() => {
                        const nowFloat = now.getHours() + now.getMinutes() / 60
                        if (nowFloat < 0 || nowFloat > 24) return null
                        const nowTop = offsetForHour(Math.floor(nowFloat), rowHeights)
                          + (nowFloat - Math.floor(nowFloat)) * rowHeights[Math.min(Math.floor(nowFloat), 23)]
                        return (
                          <div className="timeline-now-line" style={{ top: nowTop }}>
                            <div className="now-time-tag">
                              {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
                            </div>
                            <div className="now-circle" />
                            <div className="now-horizontal-bar" />
                          </div>
                        )
                      })()}

                      {/* ── Empty Day Prompt (Day View) ── */}
                      {viewMode === 'day' && positioned.length === 0 && (
                        <div className="day-empty-banner" onClick={() => openCreate(dayStr, 9)}>
                          <CalendarIcon size={20} className="deb-icon" />
                          <div className="deb-text">
                            <strong>No events scheduled for this day</strong>
                            <span>Click any hour cell or click here to schedule a class or task</span>
                          </div>
                          <span className="deb-action-btn"><Plus size={13} /> Add Event</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Event Inspector Drawer ── */}
      {inspectorEvent && (
        <EventInspectorDrawer
          ev={inspectorEvent}
          onClose={() => setInspectorEvent(null)}
          onEdit={openEdit}
          onSaveComment={handleSaveCommentData}
        />
      )}

      {/* ── Link Popover ── */}
      {popoverEvent && popoverPos && (
        <>
          <div
            className="popover-backdrop"
            onClick={() => { setPopoverEvent(null); setPopoverPos(null) }}
          />
          <div className="popover-menu" style={{ top: popoverPos.top, left: popoverPos.left }}>
            <button
              className="popover-item"
              onClick={() => {
                if (popoverEvent.link) window.open(popoverEvent.link, '_blank', 'noopener,noreferrer')
                setPopoverEvent(null)
              }}
            >
              <LinkIcon size={13} /> Open Link
            </button>
            <button className="popover-item" onClick={() => openEdit(popoverEvent)}>
              <Edit size={13} /> Edit Event
            </button>
          </div>
        </>
      )}

      {/* ── Event Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedEvent ? 'Edit Event' : 'New Event'}</h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              {formErrors.length > 0 && (
                <div className="form-errors">
                  {formErrors.map((err, i) => <p key={i}>• {err}</p>)}
                </div>
              )}

              {/* ── Recurrence Mutation Scope (Phase 4) ── */}
              {selectedEvent?.is_recurring && (
                <div className="scope-selector">
                  <div className="scope-label">Apply changes to:</div>
                  <div className="scope-options">
                    <label className={`scope-option${editScope === 'all' ? ' active' : ''}`}>
                      <input
                        type="radio"
                        name="editScope"
                        value="all"
                        checked={editScope === 'all'}
                        onChange={() => setEditScope('all')}
                      />
                      <RefreshCw size={13} />
                      <span>All Occurrences</span>
                      <small>Modifies the recurring template</small>
                    </label>
                    <label className={`scope-option${editScope === 'instance' ? ' active' : ''}`}>
                      <input
                        type="radio"
                        name="editScope"
                        value="instance"
                        checked={editScope === 'instance'}
                        onChange={() => setEditScope('instance')}
                      />
                      <Copy size={13} />
                      <span>This Instance Only</span>
                      <small>Creates a one-off override for {selectedEvent.date || 'this date'}</small>
                    </label>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. CS101 — Computer Programming and Utilization"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="Optional notes…"
                />
              </div>

              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. LC 101, IIT Bombay"
                />
              </div>

              {/* Recurrence toggle */}
              <div className="toggle-row">
                <div>
                  <div className="toggle-label">Recurring Event</div>
                  <div className="toggle-desc">Repeats weekly on selected day(s)</div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={form.is_recurring}
                    onChange={e => setForm({ ...form, is_recurring: e.target.checked, recurrence_days: [] })}
                  />
                  <span className="slider" />
                </label>
              </div>

              {form.is_recurring ? (
                <div className="form-group">
                  <label>
                    Recurrence Day(s)
                    {!selectedEvent && <span className="label-hint"> — select multiple to batch-create</span>}
                  </label>
                  <div className="day-checklist">
                    {DAY_LABELS.map((dl, di) => (
                      <button
                        key={di}
                        type="button"
                        className={`day-chip${form.recurrence_days.includes(di) ? ' active' : ''}`}
                        onClick={() => {
                          if (selectedEvent) {
                            setForm({ ...form, recurrence_days: [di] })
                          } else {
                            setForm(prev => ({
                              ...prev,
                              recurrence_days: prev.recurrence_days.includes(di)
                                ? prev.recurrence_days.filter(d => d !== di)
                                : [...prev.recurrence_days, di],
                            }))
                          }
                        }}
                      >
                        {dl}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label>Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                  />
                </div>
              )}

              <div className="form-row-2">
                <div className="form-group">
                  <label>Start Time *</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={e => setForm({ ...form, start_time: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>End Time *</label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={e => setForm({ ...form, end_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Tag</label>
                  <select
                    value={form.tag}
                    onChange={(e: any) => setForm({ ...form, tag: e.target.value })}
                  >
                    <option value="CRITICAL">🔴 Critical</option>
                    <option value="IMPORTANT">🟡 Important</option>
                    <option value="OPTIONAL">🔵 Optional</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={form.category}
                    onChange={(e: any) => setForm({ ...form, category: e.target.value })}
                  >
                    <option value="CLASS">📚 Class</option>
                    <option value="EXAM">📝 Exam</option>
                    <option value="PERSONAL">🧍 Personal</option>
                    <option value="SLEEP">🌙 Sleep</option>
                    <option value="RECREATION">🎯 Recreation</option>
                    <option value="OTHER">⚡ Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>External Link <span className="label-hint">(Optional)</span></label>
                <input
                  type="url"
                  value={form.link}
                  onChange={e => setForm({ ...form, link: e.target.value })}
                  placeholder="https://meet.google.com/..."
                />
              </div>

              {/* ── Deadline Section ── */}
              <div className="deadline-form-section">
                <div className="deadline-form-header">
                  <Bell size={14} className="deadline-form-icon" />
                  <span className="deadline-form-title">Deadline <span className="label-hint">(Optional)</span></span>
                </div>
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Due Date</label>
                    <div className="deadline-date-input-wrap">
                      <input
                        type="date"
                        value={form.deadline_date}
                        onChange={e => setForm({ ...form, deadline_date: e.target.value })}
                      />
                      {form.deadline_date && (
                        <button
                          type="button"
                          className="deadline-clear-btn"
                          onClick={() => setForm({ ...form, deadline_date: '', deadline_label: '' })}
                          title="Clear deadline"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>What's due? <span className="label-hint">(Label)</span></label>
                    <input
                      type="text"
                      value={form.deadline_label}
                      onChange={e => setForm({ ...form, deadline_label: e.target.value })}
                      placeholder="e.g. Assignment 2, Lab Report"
                      disabled={!form.deadline_date}
                    />
                  </div>
                </div>
                {form.deadline_date && (() => {
                  const dl = new Date(form.deadline_date + 'T00:00:00')
                  const today = new Date(); today.setHours(0, 0, 0, 0)
                  const diffDays = Math.round((dl.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                  if (diffDays < 0) return <p className="deadline-form-hint overdue">⚠ This deadline is {Math.abs(diffDays)} day{Math.abs(diffDays) !== 1 ? 's' : ''} overdue.</p>
                  if (diffDays === 0) return <p className="deadline-form-hint soon">📅 Due today!</p>
                  if (diffDays <= 3) return <p className="deadline-form-hint soon">⏳ Due in {diffDays} day{diffDays !== 1 ? 's' : ''}.</p>
                  return <p className="deadline-form-hint ok">✅ {diffDays} days remaining.</p>
                })()}
              </div>

              <div className="toggle-row">
                <div>
                  <div className="toggle-label">Is Working Hour</div>
                  <div className="toggle-desc">Counts toward daily capacity load</div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={form.is_working_hour}
                    onChange={e => setForm({ ...form, is_working_hour: e.target.checked })}
                  />
                  <span className="slider" />
                </label>
              </div>

              <div className="modal-footer">
                <div>
                  {selectedEvent && (
                    <button type="button" className="danger-btn" onClick={handleDelete}>
                      <Trash2 size={13} /> Delete
                    </button>
                  )}
                </div>
                <div className="footer-right">
                  <button type="button" className="ghost-btn" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-btn" disabled={saving}>
                    {saving
                      ? <><Loader2 size={13} className="spin" /> Saving…</>
                      : <><Check size={13} /> Save</>
                    }
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Mobile Floating Action Button (FAB) ── */}
      <button
        type="button"
        className="mobile-planner-fab"
        onClick={() => openCreate()}
        title="Add New Event"
        aria-label="Add Event"
      >
        <Plus size={24} />
      </button>
    </div>
  )
}

export default Planner