'use client'

import { useState, useEffect } from 'react'
import { FeatureFlag } from '@/types'

export default function FeatureFlagsAdminPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newKey, setNewKey] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/feature-flags')
      if (!res.ok) throw new Error('Failed to load flags')
      const data = await res.json()
      setFlags(data)
    } catch {
      setError('Could not load feature flags.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleToggle(flag: FeatureFlag) {
    setToggling(flag.key)
    try {
      const res = await fetch(`/api/admin/feature-flags/${encodeURIComponent(flag.key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !flag.enabled }),
      })
      if (!res.ok) throw new Error('Failed to update flag')
      const updated: FeatureFlag = await res.json()
      setFlags(prev => prev.map(f => f.key === flag.key ? updated : f))
    } catch {
      setError('Could not update flag.')
    } finally {
      setToggling(null)
    }
  }

  async function handleDelete(flag: FeatureFlag) {
    if (!confirm(`Delete flag "${flag.key}"? This cannot be undone.`)) return
    setDeleting(flag.key)
    try {
      const res = await fetch(`/api/admin/feature-flags/${encodeURIComponent(flag.key)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete flag')
      setFlags(prev => prev.filter(f => f.key !== flag.key))
    } catch {
      setError('Could not delete flag.')
    } finally {
      setDeleting(null)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    setCreating(true)
    try {
      const res = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: newKey, label: newLabel }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error || 'Failed to create flag'); return }
      setFlags(prev => [...prev, data])
      setNewKey('')
      setNewLabel('')
    } catch {
      setCreateError('Could not create flag.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 760 }}>
      <style>{`
        .flag-row { display: flex; align-items: center; gap: 16px; padding: 14px 16px; border-radius: 8px; background: #fff; border: 1px solid #e5e7eb; margin-bottom: 8px; }
        .flag-key { font-family: monospace; font-size: 13px; color: #6b1e98; font-weight: 600; flex: 0 0 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .flag-label { flex: 1; font-size: 13px; color: #444; }
        .toggle { position: relative; width: 40px; height: 22px; flex-shrink: 0; cursor: pointer; }
        .toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
        .toggle-track { position: absolute; inset: 0; border-radius: 11px; background: #d1d5db; transition: background 0.2s; }
        .toggle input:checked + .toggle-track { background: #6b1e98; }
        .toggle-thumb { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; background: #fff; border-radius: 50%; transition: left 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
        .toggle input:checked ~ .toggle-thumb { left: 21px; }
        .del-btn { background: none; border: none; cursor: pointer; color: #bbb; padding: 4px; border-radius: 4px; display: flex; align-items: center; }
        .del-btn:hover { color: #dc2626; background: #fef2f2; }
        .badge-on { background: #f0fdf4; color: #15803d; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; border: 1px solid #bbf7d0; }
        .badge-off { background: #f9fafb; color: #9ca3af; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; border: 1px solid #e5e7eb; }
      `}</style>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: 0 }}>Feature Flags</h1>
        <p style={{ fontSize: 13, color: '#888', margin: '6px 0 0' }}>
          Wrap UI elements with <code style={{ background: '#f3f0ff', color: '#6b1e98', padding: '1px 5px', borderRadius: 3, fontSize: 12 }}>&lt;FeatureFlag name=&quot;key&quot;&gt;</code> to hide them when a flag is off.
        </p>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* New flag form */}
      <form onSubmit={handleCreate} style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b1e98', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Key</label>
          <input
            value={newKey}
            onChange={e => setNewKey(e.target.value)}
            placeholder="e.g. new-dashboard-widget"
            required
            pattern="[a-zA-Z0-9-_]+"
            title="Lowercase letters, numbers, hyphens, underscores"
            style={{ width: '100%', padding: '7px 10px', border: '1px solid #d8b4fe', borderRadius: 6, fontSize: 13, fontFamily: 'monospace', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b1e98', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Label</label>
          <input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="Human-readable name"
            required
            style={{ width: '100%', padding: '7px 10px', border: '1px solid #d8b4fe', borderRadius: 6, fontSize: 13, background: '#fff', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          style={{ padding: '8px 18px', background: '#6b1e98', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1, flexShrink: 0 }}
        >
          {creating ? 'Adding…' : 'Add Flag'}
        </button>
      </form>
      {createError && (
        <div style={{ color: '#dc2626', fontSize: 13, marginTop: -16, marginBottom: 16 }}>{createError}</div>
      )}

      {/* Flag list */}
      {loading ? (
        <div style={{ color: '#999', fontSize: 13, padding: '20px 0' }}>Loading…</div>
      ) : flags.length === 0 ? (
        <div style={{ color: '#bbb', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No flags yet. Add one above.</div>
      ) : (
        <div>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '4px 16px', marginBottom: 4 }}>
            <span style={{ flex: '0 0 220px', fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Key</span>
            <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Label</span>
            <span style={{ width: 60, fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'center' }}>Status</span>
            <span style={{ width: 40 }} />
            <span style={{ width: 28 }} />
          </div>

          {flags.map(flag => (
            <div key={flag.key} className="flag-row" style={{ opacity: toggling === flag.key || deleting === flag.key ? 0.6 : 1, transition: 'opacity 0.15s' }}>
              <span className="flag-key">{flag.key}</span>
              <span className="flag-label">{flag.label}</span>
              <span style={{ width: 60, textAlign: 'center', flexShrink: 0 }}>
                <span className={flag.enabled ? 'badge-on' : 'badge-off'}>{flag.enabled ? 'On' : 'Off'}</span>
              </span>
              {/* Toggle */}
              <label className="toggle" title={flag.enabled ? 'Disable flag' : 'Enable flag'}>
                <input
                  type="checkbox"
                  checked={flag.enabled}
                  disabled={toggling === flag.key}
                  onChange={() => handleToggle(flag)}
                />
                <span className="toggle-track" />
                <span className="toggle-thumb" />
              </label>
              {/* Delete */}
              <button
                className="del-btn"
                onClick={() => handleDelete(flag)}
                disabled={deleting === flag.key}
                title="Delete flag"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
