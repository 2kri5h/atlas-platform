import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react'
import { DeadlineWithSubtasks } from '../utils/api'
import { getDepartmentColor } from '../utils/colorPalette'
import { SubtaskCheckbox } from './SubtaskCheckbox'
import '../styles/DeadlineSummary.css'

interface DeadlineCardProps {
  deadline: DeadlineWithSubtasks
  onAddSubtask: (deadlineId: number, title: string) => Promise<void>
  onToggleSubtask: (deadlineId: number, subtaskId: number) => Promise<void>
  onDeleteSubtask: (deadlineId: number, subtaskId: number) => Promise<void>
  onToggleComplete?: (deadlineId: number, isCompleted: boolean) => Promise<void>
}

export const DeadlineCard: React.FC<DeadlineCardProps> = ({
  deadline,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onToggleComplete,
}) => {
  const [expanded, setExpanded] = useState<boolean>(true)
  const [newTitle, setNewTitle] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const subtasks = deadline.subtasks || []
  const totalSubtasks = subtasks.length
  const completedSubtasks = subtasks.filter(s => s.is_completed).length
  const allSubtasksDone = totalSubtasks > 0 && completedSubtasks === totalSubtasks
  const isCompleted = deadline.is_completed || deadline.status === 'COMPLETED' || allSubtasksDone

  const progressPct = isCompleted 
    ? 100 
    : totalSubtasks > 0 
      ? Math.round((completedSubtasks / totalSubtasks) * 100) 
      : 0

  // Calculate relative days left for deadline
  let deadlineBadgeText = ''
  let deadlineStatusClass = 'upcoming'

  if (isCompleted) {
    deadlineBadgeText = 'Completed'
    deadlineStatusClass = 'completed'
  } else if (deadline.deadline_date) {
    const dlDate = new Date(deadline.deadline_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    dlDate.setHours(0, 0, 0, 0)

    const diffMs = dlDate.getTime() - today.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      deadlineBadgeText = `${Math.abs(diffDays)}d overdue`
      deadlineStatusClass = 'overdue'
    } else if (diffDays === 0) {
      deadlineBadgeText = 'Due today'
      deadlineStatusClass = 'today'
    } else if (diffDays === 1) {
      deadlineBadgeText = 'Due tomorrow'
      deadlineStatusClass = 'soon'
    } else if (diffDays <= 3) {
      deadlineBadgeText = `${diffDays} days left`
      deadlineStatusClass = 'soon'
    } else {
      deadlineBadgeText = `${diffDays} days left`
      deadlineStatusClass = 'upcoming'
    }
  }

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onAddSubtask(deadline.id, newTitle.trim())
      setNewTitle('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onToggleComplete) {
      await onToggleComplete(deadline.id, isCompleted)
    }
  }

  const deptStyle = getDepartmentColor(deadline.title)

  return (
    <div
      className={`dt-card ${expanded ? 'expanded' : ''} ${isCompleted ? 'dt-card-done' : ''}`}
      style={deptStyle as React.CSSProperties}
    >
      <div className="dt-card-accent-strip" />

      {/* Header */}
      <div className="dt-card-header" onClick={() => setExpanded(prev => !prev)}>
        <div className="dt-card-header-main">
          <div className="dt-card-title-row">
            <h3 className={`dt-card-title ${isCompleted ? 'completed-text' : ''}`}>{deadline.title}</h3>
            {deadlineBadgeText && (
              <span className={`dt-deadline-badge ${deadlineStatusClass}`}>
                {deadlineStatusClass === 'overdue' && <AlertCircle size={11} />}
                {deadlineStatusClass === 'completed' && <CheckCircle2 size={11} />}
                {deadlineBadgeText}
              </span>
            )}
          </div>

          <div className="dt-card-meta-row">
            {deadline.deadline_label && (
              <span className="dt-label-tag">{deadline.deadline_label}</span>
            )}
            {deadline.deadline_date && (
              <span className="dt-meta-date">
                <Calendar size={12} />
                <span>
                  {new Date(deadline.deadline_date).toLocaleDateString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </span>
            )}
            <span className="dt-subtask-count">
              {completedSubtasks}/{totalSubtasks} tasks
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {onToggleComplete && (
            <button
              type="button"
              onClick={handleToggleComplete}
              title={isCompleted ? 'Mark as incomplete' : 'Mark as completed'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                color: isCompleted ? '#16a34a' : '#94a3b8',
                transition: 'color 0.2s',
              }}
            >
              <CheckCircle2 size={18} />
            </button>
          )}

          <button
            type="button"
            className="dt-expand-toggle-btn"
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="dt-progress-container">
        <div className="dt-progress-track">
          <div
            className="dt-progress-fill"
            style={{ width: `${progressPct}%`, backgroundColor: isCompleted ? '#22c55e' : undefined }}
          />
        </div>
        <span className="dt-progress-text">{progressPct}%</span>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="dt-card-body">
          {/* Subtasks List */}
          <div className="dt-subtasks-list">
            {subtasks.length === 0 ? (
              <div className="dt-subtasks-empty">
                No subtasks added. Add subtasks to track progress.
              </div>
            ) : (
              subtasks.map(st => (
                <SubtaskCheckbox
                  key={st.id}
                  subtask={st}
                  onToggle={subtaskId => onToggleSubtask(deadline.id, subtaskId)}
                  onDelete={subtaskId => onDeleteSubtask(deadline.id, subtaskId)}
                />
              ))
            )}
          </div>

          {/* Add Subtask Form */}
          <form className="dt-add-subtask-form" onSubmit={handleAddSubtask}>
            <input
              type="text"
              className="dt-add-input"
              placeholder="Add subtask..."
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
            />
            <button
              type="submit"
              className="dt-add-btn"
              disabled={!newTitle.trim() || isSubmitting}
              aria-label="Add subtask"
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
          </form>
        </div>
      )}
    </div>
  )
}