import { useEffect, useState } from 'react'
import './Toast.css'

export type ToastKind = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  kind: ToastKind
}

type Listener = (t: ToastItem) => void

let listeners: Listener[] = []
let counter = 0

/** Imperative toast API usable from anywhere: toast('Saved', 'success') */
export function toast(message: string, kind: ToastKind = 'info', durationMs = 4200) {
  const item: ToastItem = { id: ++counter, message, kind }
  listeners.forEach((l) => l(item))
  setTimeout(() => {
    listeners.forEach((l) => l({ ...item, id: -item.id }))
  }, durationMs)
}

/**
 * Mount once in the app shell (Layout). Renders stacked toasts bottom-right.
 * Dismissal events use negative ids to remove the matching toast.
 */
export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    const listener: Listener = (t) => {
      if (t.id < 0) {
        setItems((prev) => prev.filter((i) => i.id !== -t.id))
      } else {
        setItems((prev) => [...prev.slice(-3), t])
      }
    }
    listeners.push(listener)
    return () => {
      listeners = listeners.filter((l) => l !== listener)
    }
  }, [])

  return (
    <div className="toast-host" aria-live="polite" role="status">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
