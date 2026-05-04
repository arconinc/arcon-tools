'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface NotificationRow {
  id: string
  type: string
  title: string
  body: string
  link_url: string | null
  metadata: Record<string, unknown>
  read_at: string | null
  archived_at: string | null
  email_status: 'pending' | 'sent' | 'skipped' | 'failed' | 'disabled'
  email_sent_at: string | null
  created_at: string
}

interface ListResponse {
  notifications: NotificationRow[]
  unreadCount: number
  hasMore: boolean
}

const POLL_MS = 60_000

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  if (d < 7) return `${d}d ago`
  const w = Math.floor(d / 7)
  if (w < 5) return `${w}w ago`
  return new Date(iso).toLocaleDateString()
}

export function NotificationBell() {
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?filter=all&limit=15', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as ListResponse
      setItems(data.notifications)
      setUnread(data.unreadCount)
    } catch {
      // Silent — keep last good state
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  // Outside-click close
  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  const toggleOpen = () => {
    const next = !open
    setOpen(next)
    if (next) load()
  }

  const handleItemClick = async (n: NotificationRow, e: React.MouseEvent) => {
    e.preventDefault()
    setOpen(false)
    if (!n.read_at) {
      setItems(prev => prev.map(it => (it.id === n.id ? { ...it, read_at: new Date().toISOString() } : it)))
      setUnread(c => Math.max(0, c - 1))
      fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: n.id }),
      }).catch(() => {})
    }
    if (n.link_url) router.push(n.link_url)
  }

  const handleMarkAllRead = async () => {
    if (unread === 0) return
    setLoading(true)
    const now = new Date().toISOString()
    setItems(prev => prev.map(it => (it.read_at ? it : { ...it, read_at: now })))
    setUnread(0)
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
    } catch {
      // Silent
    } finally {
      setLoading(false)
    }
  }

  const handleArchive = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setItems(prev => prev.filter(it => it.id !== id))
    setUnread(c => {
      const removed = items.find(it => it.id === id)
      return removed && !removed.read_at ? Math.max(0, c - 1) : c
    })
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    } catch {
      // Silent — list will resync on next poll
    }
  }

  const badge = unread > 9 ? '9+' : unread > 0 ? String(unread) : ''

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={toggleOpen}
        title="Notifications"
        aria-label="Notifications"
        style={{
          width: 34,
          height: 34,
          borderRadius: 6,
          background: '#f5f5f5',
          border: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#777',
          position: 'relative',
          flexShrink: 0,
          padding: 0,
        }}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <div
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              background: '#6b1e98',
              borderRadius: 8,
              border: '1.5px solid #fff',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              lineHeight: '13px',
              textAlign: 'center',
              boxSizing: 'border-box',
            }}
          >
            {badge}
          </div>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            right: 0,
            zIndex: 100,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
            minWidth: 380,
            maxWidth: 420,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Notifications</div>
            <button
              onClick={handleMarkAllRead}
              disabled={unread === 0 || loading}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontSize: 12,
                fontWeight: 600,
                color: unread === 0 ? '#cbd5e1' : '#6b1e98',
                cursor: unread === 0 ? 'default' : 'pointer',
              }}
            >
              Mark all read
            </button>
          </div>

          <div style={{ maxHeight: 460, overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>
                No notifications
              </div>
            ) : (
              items.map(n => {
                const isRead = !!n.read_at
                return (
                  <a
                    key={n.id}
                    href={n.link_url ?? '#'}
                    onClick={e => handleItemClick(n, e)}
                    style={{
                      display: 'block',
                      padding: '12px 16px',
                      borderTop: '1px solid #f1f5f9',
                      textDecoration: 'none',
                      color: 'inherit',
                      background: isRead ? '#fff' : '#faf5ff',
                      position: 'relative',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = isRead ? '#f8fafc' : '#f3e8ff' }}
                    onMouseLeave={e => { e.currentTarget.style.background = isRead ? '#fff' : '#faf5ff' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flexShrink: 0, marginTop: 5, width: 8, height: 8, borderRadius: '50%', background: isRead ? 'transparent' : '#6b1e98' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: isRead ? 500 : 700, color: '#111', lineHeight: 1.4, marginBottom: 2, wordBreak: 'break-word' }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4, marginBottom: 4 }}>
                          {n.body}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                          {formatRelative(n.created_at)}
                        </div>
                      </div>
                      <button
                        onClick={e => handleArchive(n.id, e)}
                        title="Dismiss"
                        aria-label="Dismiss"
                        style={{
                          flexShrink: 0,
                          background: 'none',
                          border: 'none',
                          padding: 4,
                          marginRight: -4,
                          color: '#cbd5e1',
                          cursor: 'pointer',
                          opacity: 0.6,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.opacity = '1' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.opacity = '0.6' }}
                      >
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </a>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
