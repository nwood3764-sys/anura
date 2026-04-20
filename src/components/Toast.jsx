import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Toast — stacked, auto-dismissing notifications shown top-right.
//
// Usage:
//   const toast = useToast()
//   toast.success('Record saved')
//   toast.error('Save failed: …', { duration: 8000 })
//   toast.warning('Missing required fields')
//   toast.info('Heads up…')
//
// A single ToastProvider is mounted at the App root. Any descendant can call
// useToast() to push a message. Click a toast to dismiss it early.
// ---------------------------------------------------------------------------

const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

const VARIANTS = {
  success: {
    bg:       '#f0fdf4',
    border:   '#bbf7d0',
    color:    '#166534',
    iconPath: 'M5 13l4 4L19 7',
  },
  error: {
    bg:       '#fef2f2',
    border:   '#fca5a5',
    color:    '#b03a2e',
    iconPath: 'M12 9v2m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4.33c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z',
  },
  warning: {
    bg:       '#fef3c7',
    border:   '#fcd34d',
    color:    '#92400e',
    iconPath: 'M12 9v2m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4.33c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z',
  },
  info: {
    bg:       '#eff6ff',
    border:   '#bfdbfe',
    color:    '#1e40af',
    iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  // Track timers so we can clear them on manual dismiss and on unmount.
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const tmr = timers.current.get(id)
    if (tmr) { clearTimeout(tmr); timers.current.delete(id) }
  }, [])

  const push = useCallback((message, variant = 'info', opts = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const duration = opts.duration ?? (variant === 'error' ? 6000 : 4000)
    setToasts((prev) => [...prev, { id, message, variant }])
    if (duration > 0) {
      const tmr = setTimeout(() => dismiss(id), duration)
      timers.current.set(id, tmr)
    }
    return id
  }, [dismiss])

  // Clean up any outstanding timers on unmount
  useEffect(() => () => {
    for (const t of timers.current.values()) clearTimeout(t)
    timers.current.clear()
  }, [])

  const api = useMemo(() => ({
    success: (m, o) => push(m, 'success', o),
    error:   (m, o) => push(m, 'error',   o),
    warning: (m, o) => push(m, 'warning', o),
    info:    (m, o) => push(m, 'info',    o),
    dismiss,
  }), [push, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          pointerEvents: 'none',
          maxWidth: 'calc(100vw - 32px)',
        }}
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({ toast, onDismiss }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    // Trigger the mount transition on the next frame
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const cfg = VARIANTS[toast.variant] || VARIANTS.info

  return (
    <div
      role="status"
      onClick={onDismiss}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        minWidth: 280,
        maxWidth: 420,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 13,
        fontWeight: 500,
        lineHeight: 1.45,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        cursor: 'pointer',
        pointerEvents: 'auto',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(-8px)',
        transition: 'opacity 200ms ease, transform 200ms ease',
      }}
    >
      <svg
        width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke={cfg.color} strokeWidth={2.2}
        strokeLinecap="round" strokeLinejoin="round"
        style={{ flexShrink: 0, marginTop: 1 }}
      >
        <path d={cfg.iconPath} />
      </svg>
      <span style={{ flex: 1, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
        {toast.message}
      </span>
    </div>
  )
}
