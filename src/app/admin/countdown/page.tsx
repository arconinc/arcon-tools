'use client'

import { useState, useEffect } from 'react'
import { CountdownConfig } from '@/types'

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: 44,
        height: 24,
        borderRadius: 12,
        background: on ? '#6b1e98' : '#cbd5e1',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
      role="switch"
      aria-checked={on}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 22 : 2,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 0.2s',
        }}
      />
    </button>
  )
}

export default function AdminCountdownPage() {
  const [enabled, setEnabled] = useState(false)
  const [label, setLabel] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/countdown')
      .then(r => r.json())
      .then((data: CountdownConfig) => {
        if (data) {
          setEnabled(data.enabled)
          setLabel(data.label ?? '')
          // Convert ISO timestamp to datetime-local format
          if (data.target_date) {
            const d = new Date(data.target_date)
            // Format as YYYY-MM-DDTHH:MM for datetime-local input
            const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
              .toISOString()
              .slice(0, 16)
            setTargetDate(local)
          }
        }
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
        setError('Failed to load countdown config')
      })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)

    // Convert datetime-local back to ISO
    const isoDate = new Date(targetDate).toISOString()

    const res = await fetch('/api/admin/countdown', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, label, target_date: isoDate }),
    })

    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to save')
    }
  }

  // Live preview countdown
  const [preview, setPreview] = useState('')
  useEffect(() => {
    if (!targetDate) return
    function tick() {
      const diff = new Date(targetDate).getTime() - Date.now()
      if (diff <= 0) { setPreview('Event has passed'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setPreview(`${d}d ${h}h ${m}m ${s}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetDate])

  if (loading) {
    return (
      <div style={{ padding: 32, color: '#999', fontSize: 14 }}>Loading…</div>
    )
  }

  return (
    <div style={{ padding: 32, maxWidth: 560 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 4 }}>
        Event Countdown
      </h1>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 28 }}>
        Display a countdown timer in the top navigation bar.
      </p>

      <form onSubmit={handleSave}>
        {/* Enable toggle */}
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          padding: '20px 24px',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Show Countdown</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                Display countdown timer in the header bar for all users
              </div>
            </div>
            <Toggle on={enabled} onChange={setEnabled} />
          </div>
        </div>

        {/* Config fields */}
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          padding: '20px 24px',
          marginBottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6 }}>
              Event Name
            </label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Annual Summit, Product Launch…"
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: 7,
                fontSize: 14,
                color: '#111',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6 }}>
              Target Date &amp; Time
            </label>
            <input
              type="datetime-local"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: 7,
                fontSize: 14,
                color: '#111',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Preview */}
        {targetDate && label && (
          <div style={{
            background: '#faf5ff',
            border: '1px solid #e9d5ff',
            borderRadius: 10,
            padding: '16px 24px',
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Preview
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#6b1e98',
              color: '#fff',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 13,
              fontWeight: 600,
            }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.8 }}>
                <circle cx="12" cy="12" r="10" strokeWidth={2} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
              </svg>
              <span style={{ opacity: 0.8, fontSize: 11, fontWeight: 500 }}>{label}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{preview}</span>
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 16px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          style={{
            background: saving ? '#9333ea80' : '#6b1e98',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 24px',
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </form>

      <div style={{ marginTop: 32, padding: '16px 20px', background: '#f8f8f8', borderRadius: 8, fontSize: 12, color: '#888' }}>
        <strong style={{ color: '#555' }}>Required DB setup</strong>
        <pre style={{ marginTop: 8, background: '#111', color: '#ccc', padding: '12px 14px', borderRadius: 6, overflow: 'auto', lineHeight: 1.6, fontSize: 11 }}>{`CREATE TABLE countdown_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN NOT NULL DEFAULT false,
  label TEXT NOT NULL DEFAULT 'Event',
  target_date TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days',
  updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO countdown_config DEFAULT VALUES;`}</pre>
      </div>
    </div>
  )
}
