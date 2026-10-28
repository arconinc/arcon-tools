'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type ToastType = 'error' | 'success' | 'info'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

type Listener = (item: ToastItem) => void
const listeners: Listener[] = []
let counter = 0

export function toast(message: string, type: ToastType = 'error') {
  const item: ToastItem = { id: ++counter, message, type }
  listeners.forEach((fn) => fn(item))
}

const COLORS: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  error:   { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', icon: '✕' },
  success: { bg: '#f0fdf4', border: '#86efac', text: '#166534', icon: '✓' },
  info:    { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af', icon: 'ℹ' },
}

const DISMISS_MS = 5000

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  const hovered = useRef(false)

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const schedule = useCallback((id: number) => {
    timers.current.set(id, setTimeout(() => dismiss(id), DISMISS_MS))
  }, [dismiss])

  useEffect(() => {
    function handle(item: ToastItem) {
      setItems((prev) => [...prev, item])
      if (!hovered.current) schedule(item.id)
    }
    listeners.push(handle)
    return () => { const i = listeners.indexOf(handle); if (i >= 0) listeners.splice(i, 1) }
  }, [schedule])

  // ponytail: hovering pauses every toast and leaving restarts a full 5s, not the remaining time
  function pause() {
    hovered.current = true
    timers.current.forEach(clearTimeout)
    timers.current.clear()
  }

  function resume() {
    hovered.current = false
    items.forEach((t) => schedule(t.id))
  }

  // Region stays mounted so screen readers pick up toasts added to it
  return (
    <div
      role="region"
      aria-label="Notifications"
      onMouseEnter={pause}
      onMouseLeave={resume}
      style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 380 }}
    >
      {items.map((item) => {
        const c = COLORS[item.type]
        return (
          <div
            key={item.id}
            role={item.type === 'error' ? 'alert' : 'status'}
            style={{
              background: c.bg,
              border: `1px solid ${c.border}`,
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              animation: 'slideIn 0.15s ease',
            }}
          >
            <span aria-hidden="true" style={{ color: c.text, fontWeight: 700, fontSize: 14, lineHeight: 1.4, flexShrink: 0 }}>{c.icon}</span>
            <span style={{ color: c.text, fontSize: 13, lineHeight: 1.5 }}>{item.message}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => dismiss(item.id)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: c.text, opacity: 0.6, fontSize: 16, lineHeight: 1, flexShrink: 0, padding: 0 }}
            >
              ×
            </button>
          </div>
        )
      })}
      <style>{`@keyframes slideIn { from { transform: translateX(20px); opacity: 0 } to { transform: none; opacity: 1 } }
@media (prefers-reduced-motion: reduce) { @keyframes slideIn { from { opacity: 0 } to { opacity: 1 } } }`}</style>
    </div>
  )
}
