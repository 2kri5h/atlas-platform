import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Loader2, AlertTriangle, CheckCircle2, Plus, ExternalLink } from 'lucide-react'
import { useDeadlineData } from '../hooks/useDeadlineData'
import { DeadlineCard } from './DeadlineCard'
import { CreateDeadlineModal } from './CreateDeadlineModal'
import '../styles/DeadlineSummary.css'

interface DeadlineSummaryProps {
  className?: string
}

export const DeadlineSummary: React.FC<DeadlineSummaryProps> = ({ className = '' }) => {
  const navigate = useNavigate()
  const {
    deadlines,
    loading,
    error,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    createCustomDeadline,
  } = useDeadlineData()

  const [isModalOpen, setIsModalOpen] = useState(false)

  const totalDeadlines = deadlines.length
  let pendingSubtasksCount = 0
  let totalSubtasksCount = 0

  deadlines.forEach(d => {
    const subtasks = d.subtasks || []
    totalSubtasksCount += subtasks.length
    pendingSubtasksCount += subtasks.filter(s => !s.is_completed).length
  })

  return (
    <aside className={`dt-summary-sidebar ${className}`}>
      {/* Header */}
      <div className="dt-summary-header">
        <div className="dt-summary-header-title">
          <Bell size={18} className="dt-header-icon" />
          <h2>Deadline Tracker</h2>
        </div>

        <div className="dt-header-actions">
          <button
            type="button"
            className="dt-add-deadline-btn"
            onClick={() => setIsModalOpen(true)}
            title="Add Custom Deadline"
          >
            <Plus size={14} />
            <span>Add</span>
          </button>

          <button
            type="button"
            className="dt-refresh-btn"
            onClick={() => navigate('/deadlines')}
            title="Open Full Deadlines Planner"
          >
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      {/* Summary Metrics Bar */}
      <div className="dt-metrics-bar">
        <div className="dt-metric-chip">
          <span className="dt-metric-value">{totalDeadlines}</span>
          <span className="dt-metric-label">Deadlines</span>
        </div>
        <div className="dt-metric-divider" />
        <div className="dt-metric-chip">
          <span className="dt-metric-value">{pendingSubtasksCount}</span>
          <span className="dt-metric-label">Pending Tasks</span>
        </div>
      </div>

      {/* Error state alert */}
      {error && (
        <div className="dt-error-banner">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Body List */}
      <div className="dt-summary-list">
        {loading && deadlines.length === 0 ? (
          <div className="dt-state-container">
            <Loader2 size={24} className="dt-loading-spinner spinning" />
            <span>Loading deadlines...</span>
          </div>
        ) : deadlines.length === 0 ? (
          <div className="dt-state-container empty">
            <CheckCircle2 size={28} className="dt-empty-icon" />
            <p className="dt-empty-title">All caught up!</p>
            <p className="dt-empty-subtitle">
              No upcoming deadlines. Create a custom deadline or set a deadline on any planner event.
            </p>
            <button
              type="button"
              className="dt-create-cta-btn"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus size={14} />
              <span>Add Custom Deadline</span>
            </button>
          </div>
        ) : (
          deadlines.map(deadline => (
            <DeadlineCard
              key={deadline.id}
              deadline={deadline}
              onAddSubtask={addSubtask}
              onToggleSubtask={toggleSubtask}
              onDeleteSubtask={deleteSubtask}
            />
          ))
        )}
      </div>

      {/* Create Custom Deadline Modal */}
      <CreateDeadlineModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={createCustomDeadline}
      />
    </aside>
  )
}
