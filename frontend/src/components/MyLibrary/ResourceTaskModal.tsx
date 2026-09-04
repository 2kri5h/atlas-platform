import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, Clock, AlertCircle, Tag, X } from 'lucide-react'
import { myLibraryAPI, TaskFromResourcePayload } from '../../utils/api'

interface ResourceTaskModalProps {
  isOpen: boolean
  onClose: () => void
  initialData: {
    title: string
    url?: string
    course_code?: string
    file_id?: string
    resource_id?: number
    description?: string
  }
  onSuccess?: (message: string) => void
}

const QUICK_TAG_SUGGESTIONS = [
  'Weightage: 20%',
  'Weightage: 30%',
  'Endsem Exam Prep',
  'Midsem Exam Prep',
  'Lab Quiz',
  'Must Read',
  'Assignment Reference',
]

export const ResourceTaskModal: React.FC<ResourceTaskModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSuccess,
}) => {
  const [title, setTitle] = useState(initialData.title || '')
  const [courseCode, setCourseCode] = useState(initialData.course_code || '')
  const [dueDate, setDueDate] = useState('')
  const [endTime, setEndTime] = useState('23:59')
  const [priority, setPriority] = useState<number>(2) // 1=Urgent, 2=High, 3=Medium, 4=Low
  const [tag, setTag] = useState<string>('IMPORTANT')
  const [customTag, setCustomTag] = useState<string>('')
  const [notes, setNotes] = useState(initialData.description || '')
  const [createDeadline, setCreateDeadline] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setTitle(initialData.title || '')
      setCourseCode(initialData.course_code || '')
      setNotes(initialData.description || '')
      // Default due date: 7 days from today
      const d = new Date()
      d.setDate(d.getDate() + 7)
      setDueDate(d.toISOString().split('T')[0])
      setError(null)
    }
  }, [isOpen, initialData])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Please provide a title for the task/deadline.')
      return
    }

    try {
      setLoading(true)
      setError(null)

      let isoDueDate: string | undefined = undefined
      if (dueDate) {
        isoDueDate = `${dueDate}T${endTime || '23:59'}:00`
      }

      const payload: TaskFromResourcePayload = {
        title: title.trim(),
        url: initialData.url,
        course_code: courseCode.trim() || undefined,
        due_date: isoDueDate,
        end_time: endTime,
        priority,
        tag,
        custom_tag: customTag.trim() || undefined,
        notes: notes.trim() || undefined,
        create_planner_deadline: createDeadline && !!dueDate,
        resource_id: initialData.resource_id,
        file_id: initialData.file_id,
      }

      const res = await myLibraryAPI.createTaskFromResource(payload)
      if (onSuccess) {
        onSuccess(res.message || 'Successfully scheduled task and deadline!')
      }
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add to deadlines/tasks')
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card task-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <Calendar size={22} className="text-accent" />
            </div>
            <div>
              <h3>Add to Deadlines & Tasks</h3>
              <p className="modal-subtitle">Connect this academic resource into your Planner</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="modal-error-alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="task-modal-form">
          <div className="form-group">
            <label>Task / Deadline Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Complete CS316 Lab 2 & Review Slides"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Course / Subject Code</label>
              <input
                type="text"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
                placeholder="e.g. CS316, CS101"
              />
            </div>
            <div className="form-group">
              <label>Priority Level</label>
              <select
                value={priority}
                onChange={(e) => {
                  const p = Number(e.target.value)
                  setPriority(p)
                  if (p === 1) setTag('CRITICAL')
                  else if (p === 2) setTag('IMPORTANT')
                  else setTag('OPTIONAL')
                }}
              >
                <option value={1}>🔥 Urgent (P1 / Critical)</option>
                <option value={2}>⚡ High (P2 / Important)</option>
                <option value={3}>📌 Medium (P3)</option>
                <option value={4}>☕ Low (P4 / Optional)</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Due Date</label>
              <div className="input-with-icon">
                <Calendar size={16} className="input-icon" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="form-group">
              <label>End Time</label>
              <div className="input-with-icon">
                <Clock size={16} className="input-icon" />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>
              Custom Handwritten / Exam Tag <span className="label-sub">(weightage, exam label, memo)</span>
            </label>
            <div className="input-with-icon">
              <Tag size={16} className="input-icon" />
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                placeholder="e.g. Weightage: 20%, Endsem Prep, Lab Quiz"
              />
            </div>
            <div className="tag-suggestions-row">
              {QUICK_TAG_SUGGESTIONS.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  className={`tag-pill-btn ${customTag === suggestion ? 'active' : ''}`}
                  onClick={() => setCustomTag(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Notes & Preparation Checklist</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Read Sections 4.1 to 4.5; Solve practice problems 10-15..."
            />
          </div>

          {dueDate && (
            <label className="checkbox-label deadline-toggle">
              <input
                type="checkbox"
                checked={createDeadline}
                onChange={(e) => setCreateDeadline(e.target.checked)}
              />
              <span>Also add as an active deadline in ATLAS Planner Calendar</span>
            </label>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Adding...' : 'Save to Deadlines & Tasks'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

export default ResourceTaskModal
