import { useState, useEffect, useCallback } from 'react'
import api, { DeadlineWithSubtasks, DeadlineSubtask, deadlineAPI } from '../utils/api'

export function useDeadlineData() {
  const [deadlines, setDeadlines] = useState<DeadlineWithSubtasks[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDeadlines = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await deadlineAPI.getDeadlines()
      setDeadlines(data)
    } catch (err: any) {
      console.error('Error fetching deadlines:', err)
      setError(err?.response?.data?.detail || 'Failed to load deadlines')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDeadlines()
  }, [fetchDeadlines])

  const addSubtask = async (deadlineId: number, title: string) => {
    if (!title.trim()) return

    const tempId = -Date.now()
    const tempSubtask: DeadlineSubtask = {
      id: tempId,
      deadline_id: deadlineId,
      title: title.trim(),
      is_completed: false,
      order: 999,
      created_at: new Date().toISOString(),
    }

    // Optimistic update
    setDeadlines(prev =>
      prev.map(d => {
        if (d.id === deadlineId) {
          return {
            ...d,
            subtasks: [...(d.subtasks || []), tempSubtask],
          }
        }
        return d
      })
    )

    try {
      const created = await deadlineAPI.createSubtask(deadlineId, title)
      // Replace temp item with real subtask from backend
      setDeadlines(prev =>
        prev.map(d => {
          if (d.id === deadlineId) {
            return {
              ...d,
              subtasks: d.subtasks.map(s => (s.id === tempId ? created : s)),
            }
          }
          return d
        })
      )
    } catch (err: any) {
      console.error('Failed to create subtask:', err)
      setError(err?.response?.data?.detail || 'Failed to add subtask')
      // Rollback
      setDeadlines(prev =>
        prev.map(d => {
          if (d.id === deadlineId) {
            return {
              ...d,
              subtasks: d.subtasks.filter(s => s.id !== tempId),
            }
          }
          return d
        })
      )
    }
  }

  const toggleSubtask = async (deadlineId: number, subtaskId: number) => {
    let originalSubtask: DeadlineSubtask | undefined

    // Find current state for rollback
    const deadline = deadlines.find(d => d.id === deadlineId)
    if (deadline) {
      originalSubtask = deadline.subtasks.find(s => s.id === subtaskId)
    }

    if (!originalSubtask) return

    const newCompleted = !originalSubtask.is_completed

    // Optimistic update
    setDeadlines(prev =>
      prev.map(d => {
        if (d.id === deadlineId) {
          return {
            ...d,
            subtasks: d.subtasks.map(s =>
              s.id === subtaskId ? { ...s, is_completed: newCompleted } : s
            ),
          }
        }
        return d
      })
    )

    try {
      const updated = await deadlineAPI.updateSubtask(subtaskId, { is_completed: newCompleted })
      setDeadlines(prev =>
        prev.map(d => {
          if (d.id === deadlineId) {
            return {
              ...d,
              subtasks: d.subtasks.map(s => (s.id === subtaskId ? updated : s)),
            }
          }
          return d
        })
      )
    } catch (err: any) {
      console.error('Failed to update subtask:', err)
      setError(err?.response?.data?.detail || 'Failed to update subtask')
      // Rollback
      setDeadlines(prev =>
        prev.map(d => {
          if (d.id === deadlineId) {
            return {
              ...d,
              subtasks: d.subtasks.map(s =>
                s.id === subtaskId ? (originalSubtask as DeadlineSubtask) : s
              ),
            }
          }
          return d
        })
      )
    }
  }

  const deleteSubtask = async (deadlineId: number, subtaskId: number) => {
    let originalSubtask: DeadlineSubtask | undefined
    const deadline = deadlines.find(d => d.id === deadlineId)
    if (deadline) {
      originalSubtask = deadline.subtasks.find(s => s.id === subtaskId)
    }

    if (!originalSubtask) return

    // Optimistic update
    setDeadlines(prev =>
      prev.map(d => {
        if (d.id === deadlineId) {
          return {
            ...d,
            subtasks: d.subtasks.filter(s => s.id !== subtaskId),
          }
        }
        return d
      })
    )

    try {
      await deadlineAPI.deleteSubtask(subtaskId)
    } catch (err: any) {
      console.error('Failed to delete subtask:', err)
      setError(err?.response?.data?.detail || 'Failed to delete subtask')
      // Rollback
      setDeadlines(prev =>
        prev.map(d => {
          if (d.id === deadlineId) {
            return {
              ...d,
              subtasks: [...d.subtasks, originalSubtask as DeadlineSubtask],
            }
          }
          return d
        })
      )
    }
  }

  const createCustomDeadline = async (payload: {
    title: string
    deadline_date: string
    deadline_label?: string
    category?: 'CLASS' | 'EXAM' | 'PERSONAL' | 'SLEEP' | 'RECREATION' | 'OTHER'
    tag?: 'CRITICAL' | 'IMPORTANT' | 'OPTIONAL'
    subtasks?: string[]
  }) => {
    try {
      const created = await deadlineAPI.createCustomDeadline(payload)
      setDeadlines(prev =>
        [...prev, created].sort((a, b) =>
          (a.deadline_date || '').localeCompare(b.deadline_date || '')
        )
      )
      return created
    } catch (err: any) {
      console.error('Failed to create custom deadline:', err)
      setError(err?.response?.data?.detail || 'Failed to create custom deadline')
      throw err
    }
  }

  const toggleDeadlineComplete = async (deadlineId: string | number, currentStatus = false) => {
    const newStatus = !currentStatus

    // Optimistic UI update
    setDeadlines(prev =>
      prev.map(d =>
        d.id === Number(deadlineId)
          ? { ...d, is_completed: newStatus, status: newStatus ? 'COMPLETED' : 'PENDING' }
          : d
      )
    )

    try {
      await api.patch(`/events/${deadlineId}`, {
        is_completed: newStatus,
        status: newStatus ? 'COMPLETED' : 'PENDING',
      })
    } catch (err: any) {
      console.error('Failed to update deadline status:', err)
      alert('Failed to update status: ' + (err.response?.data?.detail || err.message))
      // Rollback
      setDeadlines(prev =>
        prev.map(d =>
          d.id === Number(deadlineId)
            ? { ...d, is_completed: currentStatus, status: currentStatus ? 'COMPLETED' : 'PENDING' }
            : d
        )
      )
    }
  }

  return {
    deadlines,
    loading,
    error,
    fetchDeadlines,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    createCustomDeadline,
    toggleDeadlineComplete,
  }
}