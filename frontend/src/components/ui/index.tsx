/**
 * Shared UI primitives.
 *
 * Only components that are genuinely reused across pages live here:
 * PageHeader, LoadingState, EmptyState, ErrorState, Badge, ConfirmDialog,
 * and an accessible Modal shell (Escape close, focus trap, focus restore).
 */
import {
  useEffect, useId, useRef, useState, type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Loader2, SlidersHorizontal, X } from 'lucide-react'
import './ui.css'

// ── PageHeader ───────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="ui-page-header">
      <div className="ui-page-header-text">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="ui-page-header-actions">{actions}</div>}
    </div>
  )
}

// ── LoadingState ─────────────────────────────────────────────────────────────
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="ui-loading" role="status" aria-live="polite">
      <span className="ui-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

// ── EmptyState ───────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, hint, action }: {
  icon?: ReactNode
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="ui-empty">
      {icon && <div className="ui-empty-icon">{icon}</div>}
      <div className="ui-empty-title">{title}</div>
      {hint && <p className="ui-empty-hint">{hint}</p>}
      {action}
    </div>
  )
}

// ── ErrorState ───────────────────────────────────────────────────────────────
export function ErrorState({ message, onRetry }: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="ui-error" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="ui-error-retry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}

// ── Badge ────────────────────────────────────────────────────────────────────
export function Badge({ tone = 'neutral', children }: {
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
  children: ReactNode
}) {
  return <span className={`ui-badge ${tone}`}>{children}</span>
}

// ── Skeleton loaders ─────────────────────────────────────────────────────────
export function Skeleton({ style }: { style?: React.CSSProperties }) {
  return <span className="ui-skeleton" style={style} aria-hidden="true" />
}

/**
 * Shimmering card grid used while list pages fetch data.
 * Replaces the plain "Loading..." text divs across Resources/Journeys/Events/Anonymous.
 */
export function CardGridSkeleton({ count = 6, height = 170 }: {
  count?: number
  height?: number
}) {
  return (
    <div className="ui-skeleton-grid" role="status" aria-live="polite" aria-label="Loading content">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="ui-skeleton-card" style={{ minHeight: height }}>
          <Skeleton style={{ height: 18, width: '68%' }} />
          <Skeleton style={{ width: '92%' }} />
          <Skeleton style={{ width: '80%' }} />
          <div className="ui-skeleton-card-footer">
            <Skeleton style={{ height: 24, width: 64, borderRadius: 12 }} />
            <Skeleton style={{ height: 24, width: 96, borderRadius: 12 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Accessible Modal shell ───────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, labelledBy, variant = 'dialog', className = '' }: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  /** id of an element inside the modal to use as aria-labelledby (defaults to built-in title) */
  labelledBy?: string
  variant?: 'dialog' | 'sheet'
  className?: string
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const generatedTitleId = useId()

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement as HTMLElement

    // Focus the first focusable element inside the modal.
    const focusables = cardRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    ;(focusables && focusables.length > 0 ? focusables[0] : cardRef.current)?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      // Simple focus trap: cycle Tab within the modal card.
      if (e.key === 'Tab' && cardRef.current) {
        const items = Array.from(
          cardRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter(el => el.offsetParent !== null)
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    const appRoot = document.getElementById('root') as (HTMLElement & { inert?: boolean }) | null
    const previousOverflow = document.body.style.overflow
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    if (appRoot) appRoot.inert = true
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (appRoot) appRoot.inert = false
      previouslyFocused.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className={`ui-modal-overlay ${variant === 'sheet' ? 'ui-sheet-overlay' : ''}`}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={cardRef}
        className={`ui-modal-card ${variant === 'sheet' ? 'ui-sheet-card' : ''} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy || (title ? generatedTitleId : undefined)}
        tabIndex={-1}
      >
        <div className="ui-modal-header">
          {variant === 'sheet' && <span className="ui-sheet-handle" aria-hidden="true" />}
          {title && <h3 id={generatedTitleId}>{title}</h3>}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              style={{ background: 'transparent', border: 'none', padding: 6 }}
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="ui-modal-body">{children}</div>
        {footer && <div className="ui-modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
export function FilterSheet({ open, onClose, title = 'Filters', children, footer }: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={footer} variant="sheet" className="ui-filter-sheet">
      {children}
    </Modal>
  )
}

export interface ResponsiveAction {
  label: string
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
}

export function ResponsiveActionMenu({ actions, label = 'More actions' }: {
  actions: ResponsiveAction[]
  label?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="ui-action-menu-trigger" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <SlidersHorizontal size={17} />
        <span>{label}</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={label} variant="sheet" className="ui-action-sheet">
        <div className="ui-action-list">
          {actions.map(action => (
            <button
              key={action.label}
              type="button"
              className={`ui-action-item ${action.danger ? 'danger' : ''}`}
              disabled={action.disabled}
              onClick={() => {
                setOpen(false)
                action.onSelect()
              }}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </Modal>
    </>
  )
}

// ── ConfirmDialog (replaces window.confirm) ──────────────────────────────────
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger = false, busy = false, onConfirm, onCancel }: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const footer = (
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          style={
            danger
              ? { background: 'var(--danger)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }
              : undefined
          }
        >
          {busy && <Loader2 size={13} className="spin" />}
          {confirmLabel}
        </button>
      </div>
    )
    return (
      <Modal open={open} onClose={onCancel} title={title} footer={footer}>
        <p style={{ margin: 0 }}>{message}</p>
      </Modal>
  )
}
