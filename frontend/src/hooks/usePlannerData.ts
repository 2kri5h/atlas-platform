import { useState, useCallback, useRef } from 'react'
import api from '../utils/api'
import { PlannerEvent, CapacityDay } from '../utils/api'

// ─── Types ────────────────────────────────────────────────────────────────────
export type ViewMode = 'day' | 'week' | 'month'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatYYYYMMDD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1))
  return date
}

function getDaysInMonthRange(d: Date): { from: string; to: string } {
  const year = d.getFullYear()
  const month = d.getMonth()
  const firstDayIndex = new Date(year, month, 1).getDay()
  const numDays = new Date(year, month + 1, 0).getDate()
  const prevMonthNumDays = new Date(year, month, 0).getDate()

  const firstCell = new Date(year, month - 1, prevMonthNumDays - firstDayIndex + 1)
  const total = firstDayIndex + numDays
  const remaining = total % 7 === 0 ? 0 : 7 - (total % 7)
  const lastCell = new Date(year, month + 1, remaining)

  return {
    from: formatYYYYMMDD(firstCell),
    to: formatYYYYMMDD(lastCell),
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function usePlannerData() {
  const [events, setEvents] = useState<PlannerEvent[]>([])
  const [loadData, setLoadData] = useState<CapacityDay[]>([])
  const [loading, setLoading] = useState(true)

  // Track the current fetch context so invalidate() can re-run with the same params
  const lastContextRef = useRef<{ viewMode: ViewMode; currentDate: Date } | null>(null)

  const fetchEvents = useCallback(async (viewMode: ViewMode, currentDate: Date) => {
    lastContextRef.current = { viewMode, currentDate }
    setLoading(true)

    try {
      let from: string
      let to: string
      if (viewMode === 'day' || viewMode === 'week') {
        const mon = getMonday(new Date(currentDate))
        const sun = new Date(mon)
        sun.setDate(mon.getDate() + 6)
        from = formatYYYYMMDD(mon)
        to = formatYYYYMMDD(sun)
      } else {
        const range = getDaysInMonthRange(currentDate)
        from = range.from
        to = range.to
      }
      const res = await api.get<PlannerEvent[]>(`/events/?from=${from}&to=${to}`)
      setEvents(res.data)
    } catch (err) {
      console.error('[usePlannerData] fetchEvents failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCapacity = useCallback(async (currentDate: Date) => {
    try {
      const y = currentDate.getFullYear()
      const m = String(currentDate.getMonth() + 1).padStart(2, '0')
      const res = await api.get<CapacityDay[]>(`/events/load?month=${y}-${m}`)
      setLoadData(res.data)
    } catch (err) {
      console.error('[usePlannerData] fetchCapacity failed:', err)
    }
  }, [])

  /**
   * invalidate() — fires after any mutation (create / patch / delete / import).
   * Re-fetches both events and capacity using the last known view context.
   * This is the single "cache invalidation trigger" referenced in the spec.
   */
  const invalidate = useCallback(() => {
    if (!lastContextRef.current) return
    const { viewMode, currentDate } = lastContextRef.current
    fetchEvents(viewMode, currentDate)
    fetchCapacity(currentDate)
  }, [fetchEvents, fetchCapacity])

  return {
    events,
    loadData,
    loading,
    fetchEvents,
    fetchCapacity,
    invalidate,
  }
}
