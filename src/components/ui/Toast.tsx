'use client'

import { useEffect, useState } from 'react'

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

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    function handle(item: ToastItem) {
      setItems((prev) => [...prev, item])
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== item.id)), 5000)
    }
    listeners.push(handle)
    return () => { const i = listeners.indexOf(handle); if (i >= 0) listeners.splice(i, 1) }
  }, [])

  if (items.length === 0) return null

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 380 }}>
      {items.map((item) => {
        const c = COLORS[item.type]
        return (
          <div
            key={item.id}
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
            <span style={{ color: c.text, fontWeight: 700, fontSize: 14, lineHeight: 1.4, flexShrink: 0 }}>{c.icon}</span>
            <span style={{ color: c.text, fontSize: 13, lineHeight: 1.5 }}>{item.message}</span>
            <button
              onClick={() => setItems((prev) => prev.filter((t) => t.id !== item.id))}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: c.text, opacity: 0.6, fontSize: 16, lineHeight: 1, flexShrink: 0, padding: 0 }}
            >
              ×
            </button>
          </div>
        )
      })}
      <style>{`@keyframes slideIn { from { transform: translateX(20px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
    </div>
  )
}
