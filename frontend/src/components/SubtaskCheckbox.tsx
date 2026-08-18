import React from 'react'
import { Check, Trash2 } from 'lucide-react'
import { DeadlineSubtask } from '../utils/api'

interface SubtaskCheckboxProps {
  subtask: DeadlineSubtask
  onToggle: (id: number) => void
  onDelete: (id: number) => void
}

export const SubtaskCheckbox: React.FC<SubtaskCheckboxProps> = ({
  subtask,
  onToggle,
  onDelete,
}) => {
  return (
    <div className={`dt-subtask-item ${subtask.is_completed ? 'completed' : ''}`}>
      <button
        type="button"
        className={`dt-subtask-checkbox ${subtask.is_completed ? 'checked' : ''}`}
        onClick={() => onToggle(subtask.id)}
        aria-label={subtask.is_completed ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {subtask.is_completed && <Check size={12} className="dt-check-icon" />}
      </button>

      <span
        className="dt-subtask-title"
        onClick={() => onToggle(subtask.id)}
      >
        {subtask.title}
      </span>

      <button
        type="button"
        className="dt-subtask-delete-btn"
        onClick={() => onDelete(subtask.id)}
        title="Delete subtask"
        aria-label="Delete subtask"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}
