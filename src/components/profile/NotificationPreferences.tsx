'use client'

import { useEffect, useState } from 'react'

interface PreferenceRow {
  type: string
  label: string
  description: string
  email: boolean
}

export function NotificationPreferences() {
  const [prefs, setPrefs] = useState<PreferenceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingType, setSavingType] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/notifications/preferences', { cache: 'no-store' })
      .then(r => r.json())
      .then((data: { preferences: PreferenceRow[] }) => {
        setPrefs(data.preferences ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function toggle(type: string, nextEmail: boolean) {
    setPrefs(prev => prev.map(p => (p.type === type ? { ...p, email: nextEmail } : p)))
    setSavingType(type)
    try {
      await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, email: nextEmail }),
      })
    } catch {
      // Optimistic update kept; user can retry by toggling again.
    } finally {
      setSavingType(null)
    }
  }

  return (
    <div className="my-prof-section">
      <div className="my-prof-section-title">Notification Preferences</div>
      {loading ? (
        <p className="my-prof-hint">Loading…</p>
      ) : prefs.length === 0 ? (
        <p className="my-prof-hint">No notification types available.</p>
      ) : (
        <div>
          {prefs.map(p => (
            <label
              key={p.type}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 0',
                borderTop: '1px solid #f1f5f9',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={p.email}
                disabled={savingType === p.type}
                onChange={e => toggle(p.type, e.target.checked)}
                style={{ marginTop: 4, width: 16, height: 16, accentColor: '#6b1e98', cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{p.label}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{p.description}</div>
              </div>
            </label>
          ))}
          <p className="my-prof-hint" style={{ marginTop: '0.75rem' }}>
            In-app notifications are always on. Email is opt-in per type.
          </p>
        </div>
      )}
    </div>
  )
}
