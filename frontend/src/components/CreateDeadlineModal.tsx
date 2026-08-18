import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Calendar, AlertCircle, Plus, Trash2, Loader2, CheckSquare } from 'lucide-react'

interface CreateDeadlineModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (payload: {
    title: string
    deadline_date: string
    deadline_label?: string
    category?: 'CLASS' | 'EXAM' | 'PERSONAL' | 'SLEEP' | 'RECREATION' | 'OTHER'
    tag?: 'CRITICAL' | 'IMPORTANT' | 'OPTIONAL'
    subtasks?: string[]
  }) => Promise<any>
}

export const CreateDeadlineModal: React.FC<CreateDeadlineModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const getTomorrowStr = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }

  const [title, setTitle] = useState('')
  const [deadlineDate, setDeadlineDate] = useState(getTomorrowStr())
  const [deadlineLabel, setDeadlineLabel] = useState('')
  const [category, setCategory] = useState<'CLASS' | 'EXAM' | 'PERSONAL' | 'SLEEP' | 'RECREATION' | 'OTHER'>('CLASS')
  const [tag, setTag] = useState<'CRITICAL' | 'IMPORTANT' | 'OPTIONAL'>('IMPORTANT')

  const [subtasks, setSubtasks] = useState<string[]>([])
  const [newSubtaskText, setNewSubtaskText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  if (!isOpen) return null

  const handleAddSubtask = () => {
    if (!newSubtaskText.trim()) return
    setSubtasks([...subtasks, newSubtaskText.trim()])
    setNewSubtaskText('')
  }

  const handleRemoveSubtask = (idx: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setErrorMsg('Activity/Deadline Title is required')
      return
    }
    if (!deadlineDate) {
      setErrorMsg('Deadline Date is required')
      return
    }

    setErrorMsg('')
    setIsSubmitting(true)
    try {
      await onCreate({
        title: title.trim(),
        deadline_date: deadlineDate,
        deadline_label: deadlineLabel.trim() || undefined,
        category,
        tag,
        subtasks,
      })
      // Reset form
      setTitle('')
      setDeadlineDate(getTomorrowStr())
      setDeadlineLabel('')
      setCategory('CLASS')
      setTag('IMPORTANT')
      setSubtasks([])
      onClose()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create deadline')
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div className="cd-modal-backdrop" onClick={onClose}>
      <div className="cd-modal-container" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="cd-modal-header">
          <div className="cd-modal-title-row">
            <Calendar size={18} className="cd-modal-header-icon" />
            <h3>Add Custom Deadline</h3>
          </div>
          <button type="button" className="cd-modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {errorMsg && (
          <div className="cd-modal-error">
            <AlertCircle size={14} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="cd-modal-form">
          {/* Activity / Title */}
          <div className="cd-form-field">
            <label className="cd-form-label">Activity Title *</label>
            <input
              type="text"
              className="cd-form-input"
              placeholder="e.g. CS305 Project Submission, Assignment 2..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Date & Label Row */}
          <div className="cd-form-row">
            <div className="cd-form-field flex-1">
              <label className="cd-form-label">Due Date *</label>
              <input
                type="date"
                className="cd-form-input"
                value={deadlineDate}
                onChange={e => setDeadlineDate(e.target.value)}
              />
            </div>
            <div className="cd-form-field flex-1">
              <label className="cd-form-label">Label / Tag</label>
              <input
                type="text"
                className="cd-form-input"
                placeholder="e.g. Assignment 2, Viva"
                value={deadlineLabel}
                onChange={e => setDeadlineLabel(e.target.value)}
              />
            </div>
          </div>

          {/* Category & Tag Row */}
          <div className="cd-form-row">
            <div className="cd-form-field flex-1">
              <label className="cd-form-label">Category</label>
              <select
                className="cd-form-select"
                value={category}
                onChange={e => setCategory(e.target.value as any)}
              >
                <option value="CLASS">Class / Course</option>
                <option value="EXAM">Exam / Quiz</option>
                <option value="PERSONAL">Personal Activity</option>
                <option value="RECREATION">Recreation / Club</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="cd-form-field flex-1">
              <label className="cd-form-label">Priority</label>
              <select
                className="cd-form-select"
                value={tag}
                onChange={e => setTag(e.target.value as any)}
              >
                <option value="IMPORTANT">Important</option>
                <option value="CRITICAL">Critical</option>
                <option value="OPTIONAL">Optional</option>
              </select>
            </div>
          </div>

          {/* Initial Subtasks Builder */}
          <div className="cd-subtask-builder">
            <div className="cd-subtask-header">
              <CheckSquare size={14} />
              <span>Initial Subtasks (Optional)</span>
            </div>

            {subtasks.length > 0 && (
              <div className="cd-subtask-list">
                {subtasks.map((st, idx) => (
                  <div key={idx} className="cd-subtask-item">
                    <span className="cd-subtask-text">• {st}</span>
                    <button
                      type="button"
                      className="cd-subtask-del-btn"
                      onClick={() => handleRemoveSubtask(idx)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="cd-subtask-add-row">
              <input
                type="text"
                className="cd-form-input cd-subtask-input"
                placeholder="Add subtask / action step..."
                value={newSubtaskText}
                onChange={e => setNewSubtaskText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddSubtask()
                  }
                }}
              />
              <button
                type="button"
                className="cd-add-subtask-btn"
                onClick={handleAddSubtask}
              >
                <Plus size={13} /> Add
              </button>
            </div>
          </div>

          {/* Form Actions */}
          <div className="cd-modal-actions">
            <button
              type="button"
              className="cd-btn-ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cd-btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="spin" />
                  Creating...
                </>
              ) : (
                'Create Deadline'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
