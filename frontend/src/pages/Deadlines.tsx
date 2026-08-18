import { useState, useMemo } from 'react'
import {
  Bell,
  Search,
  Plus,
  LayoutGrid,
  List as ListIcon,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Filter,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { useDeadlineData } from '../hooks/useDeadlineData'
import { DeadlineCard } from '../components/DeadlineCard'
import { CreateDeadlineModal } from '../components/CreateDeadlineModal'
import './Deadlines.css'

// Helper function to safely parse dates without timezone drift
function parseDeadlineDaysDiff(deadline: any, todayMidnight: number): number | null {
  const rawDate = deadline.deadline_date || deadline.due_date || deadline.date
  if (!rawDate) return null

  // Extract YYYY-MM-DD cleanly
  const dateStr = typeof rawDate === 'string' ? rawDate.split('T')[0] : ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return null

  const targetDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
  const targetMidnight = targetDate.getTime()

  return Math.round((targetMidnight - todayMidnight) / (1000 * 60 * 60 * 24))
}

export default function Deadlines() {
  const {
    deadlines,
    loading,
    fetchDeadlines,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    createCustomDeadline,
    toggleDeadlineComplete,
  } = useDeadlineData()

  const [viewMode, setViewMode] = useState<'board' | 'list'>('board')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL')
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Calculate metrics
  const metrics = useMemo(() => {
    const today = new Date()
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

    let overdue = 0
    let dueSoon = 0
    let upcoming = 0
    let totalSubtasks = 0
    let completedSubtasks = 0

    deadlines.forEach(d => {
      const subtasks = d.subtasks || []
      const isDone = d.is_completed || d.status === 'COMPLETED' || (subtasks.length > 0 && subtasks.every(s => s.is_completed))

      if (!isDone) {
        const diffDays = parseDeadlineDaysDiff(d, todayMidnight)
        if (diffDays === null) {
          upcoming++
        } else if (diffDays < 0) {
          overdue++
        } else if (diffDays <= 3) {
          dueSoon++
        } else {
          upcoming++
        }
      }

      totalSubtasks += subtasks.length
      completedSubtasks += subtasks.filter(s => s.is_completed).length
    })

    const completionRate = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 100

    return {
      total: deadlines.length,
      overdue,
      dueSoon,
      upcoming,
      totalSubtasks,
      completedSubtasks,
      completionRate,
    }
  }, [deadlines])

  // Filtered deadlines
  const filteredDeadlines = useMemo(() => {
    return deadlines.filter(d => {
      // Search
      const matchesSearch =
        !searchQuery.trim() ||
        (d.title && d.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.deadline_label && d.deadline_label.toLowerCase().includes(searchQuery.toLowerCase()))

      // Category
      const matchesCategory = categoryFilter === 'ALL' || d.category === categoryFilter

      // Priority / Tag
      const matchesPriority = priorityFilter === 'ALL' || d.tag === priorityFilter

      return matchesSearch && matchesCategory && matchesPriority
    })
  }, [deadlines, searchQuery, categoryFilter, priorityFilter])

  // Categorized for Kanban Board
  const kanbanColumns = useMemo(() => {
    const today = new Date()
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

    const overdue: typeof deadlines = []
    const dueSoon: typeof deadlines = []
    const upcoming: typeof deadlines = []
    const completed: typeof deadlines = []

    filteredDeadlines.forEach(d => {
      const subtasks = d.subtasks || []
      const allSubtasksDone = subtasks.length > 0 && subtasks.every(s => s.is_completed)
      
      if (allSubtasksDone || d.is_completed || d.status === 'COMPLETED') {
        completed.push(d)
        return
      }

      const diffDays = parseDeadlineDaysDiff(d, todayMidnight)
      if (diffDays === null) {
        upcoming.push(d)
      } else if (diffDays < 0) {
        overdue.push(d)
      } else if (diffDays >= 0 && diffDays <= 3) {
        dueSoon.push(d)
      } else {
        upcoming.push(d)
      }
    })

    return [
      { id: 'overdue', title: 'Overdue', items: overdue, badgeClass: 'badge-overdue', accentColor: '#ef4444' },
      { id: 'dueSoon', title: 'Due Soon (1–3 Days)', items: dueSoon, badgeClass: 'badge-soon', accentColor: '#f97316' },
      { id: 'upcoming', title: 'Upcoming', items: upcoming, badgeClass: 'badge-upcoming', accentColor: '#3b82f6' },
      { id: 'completed', title: 'Completed', items: completed, badgeClass: 'badge-completed', accentColor: '#22c55e' },
    ]
  }, [filteredDeadlines])

  return (
    <div className="deadlines-page">
      {/* ── Page Header ── */}
      <div className="deadlines-header">
        <div className="deadlines-header-title-block">
          <div className="deadlines-icon-badge">
            <Bell size={22} />
          </div>
          <div>
            <h1 className="deadlines-title">Deadlines Planner</h1>
            <p className="deadlines-subtitle">
              Organize academic assignments, lab reports, exams, and custom milestones.
            </p>
          </div>
        </div>

        <div className="deadlines-header-actions">
          <button
            type="button"
            className="deadlines-create-btn"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={16} />
            <span>Add Custom Deadline</span>
          </button>

          <button
            type="button"
            className="deadlines-refresh-btn"
            onClick={() => fetchDeadlines()}
            disabled={loading}
            title="Refresh Deadlines"
          >
            <RefreshCw size={15} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {/* ── Metrics Summary Bar ── */}
      <div className="deadlines-metrics-grid">
        <div className="metrics-card">
          <div className="metrics-icon-wrap blue">
            <Bell size={18} />
          </div>
          <div className="metrics-info">
            <span className="metrics-label">Total Deadlines</span>
            <span className="metrics-value">{metrics.total}</span>
          </div>
        </div>

        <div className="metrics-card">
          <div className="metrics-icon-wrap red">
            <AlertTriangle size={18} />
          </div>
          <div className="metrics-info">
            <span className="metrics-label">Overdue</span>
            <span className="metrics-value red-text">{metrics.overdue}</span>
          </div>
        </div>

        <div className="metrics-card">
          <div className="metrics-icon-wrap orange">
            <Clock size={18} />
          </div>
          <div className="metrics-info">
            <span className="metrics-label">Due in 3 Days</span>
            <span className="metrics-value orange-text">{metrics.dueSoon}</span>
          </div>
        </div>

        <div className="metrics-card">
          <div className="metrics-icon-wrap green">
            <CheckCircle2 size={18} />
          </div>
          <div className="metrics-info">
            <span className="metrics-label">Subtask Progress</span>
            <span className="metrics-value green-text">{metrics.completionRate}%</span>
          </div>
        </div>
      </div>

      {/* ── Toolbar: Search, Filters & View Toggles ── */}
      <div className="deadlines-toolbar">
        <div className="search-input-wrap">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="deadlines-search-input"
            placeholder="Search deadlines or labels..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="toolbar-filter-group">
          {/* Category Filter */}
          <div className="select-wrap">
            <Filter size={13} className="select-icon" />
            <select
              className="deadlines-select"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              <option value="CLASS">Class / Course</option>
              <option value="EXAM">Exam / Quiz</option>
              <option value="PERSONAL">Personal</option>
              <option value="RECREATION">Recreation</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="select-wrap">
            <select
              className="deadlines-select"
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="IMPORTANT">Important</option>
              <option value="OPTIONAL">Optional</option>
            </select>
          </div>

          {/* View Mode Switcher */}
          <div className="view-mode-toggle">
            <button
              type="button"
              className={`toggle-btn ${viewMode === 'board' ? 'active' : ''}`}
              onClick={() => setViewMode('board')}
              title="Kanban Board View"
            >
              <LayoutGrid size={15} />
              <span>Board</span>
            </button>
            <button
              type="button"
              className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="Detailed List View"
            >
              <ListIcon size={15} />
              <span>List</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      {loading && deadlines.length === 0 ? (
        <div className="deadlines-state-container">
          <Loader2 size={32} className="spin" />
          <span>Loading deadlines planner...</span>
        </div>
      ) : filteredDeadlines.length === 0 ? (
        <div className="deadlines-state-container empty">
          <CheckCircle2 size={36} className="empty-icon" />
          <h3>No deadlines found</h3>
          <p>Create a custom deadline or adjust your search filters.</p>
          <button
            type="button"
            className="deadlines-create-btn"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={15} />
            <span>Add Custom Deadline</span>
          </button>
        </div>
      ) : viewMode === 'board' ? (
        /* ── Kanban Board View ── */
        <div className="kanban-board-grid">
          {kanbanColumns.map(col => (
            <div key={col.id} className="kanban-column">
              <div className="kanban-column-header" style={{ borderTopColor: col.accentColor }}>
                <div className="kanban-column-title">
                  <span>{col.title}</span>
                  <span className={`kanban-count-chip ${col.badgeClass}`}>{col.items.length}</span>
                </div>
              </div>

              <div className="kanban-column-body">
                {col.items.length === 0 ? (
                  <div className="kanban-empty-drop">No {col.title.toLowerCase()} deadlines</div>
                ) : (
                  col.items.map(deadline => (
                    <DeadlineCard
                      key={deadline.id}
                      deadline={deadline}
                      onAddSubtask={addSubtask}
                      onToggleSubtask={toggleSubtask}
                      onDeleteSubtask={deleteSubtask}
                      onToggleComplete={toggleDeadlineComplete}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Detailed List View ── */
        <div className="deadlines-list-container">
          {filteredDeadlines.map(deadline => (
            <DeadlineCard
              key={deadline.id}
              deadline={deadline}
              onAddSubtask={addSubtask}
              onToggleSubtask={toggleSubtask}
              onDeleteSubtask={deleteSubtask}
            />
          ))}
        </div>
      )}

      {/* ── Create Custom Deadline Modal ── */}
      <CreateDeadlineModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={createCustomDeadline}
      />
    </div>
  )
}