'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAVY = '#1a2f5e'
const NAVY_DARK = '#0f1e40'
const NAVY_LIGHT = '#e8edf7'
const NAVY_BORDER = '#c5cfdf'
const GREEN = '#16a34a'
const GREEN_LIGHT = '#f0fdf4'
const GREEN_BORDER = '#86efac'
const PURPLE = '#7c3aed'
const PURPLE_LIGHT = '#f5f3ff'

const ATTENDED_TAG = 'AttendedProductShowcase2026'
const REGISTERED_TAG = 'ProductShowcase2026'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Tag {
  id: string
  name: string
  color: string
}

interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  company: string | null
  tags: Tag[]
}

interface Toast {
  id: number
  message: string
  type: 'success' | 'error'
}

// ---------------------------------------------------------------------------
// Toast component
// ---------------------------------------------------------------------------

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', pointerEvents: 'none' }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            pointerEvents: 'auto',
            background: t.type === 'success' ? GREEN : '#dc2626',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            boxShadow: '0 4px 16px rgba(0,0,0,.18)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 240,
            maxWidth: 360,
            cursor: 'pointer',
          }}
          onClick={() => onDismiss(t.id)}
        >
          {t.type === 'success'
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          }
          {t.message}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Walk-In Form
// ---------------------------------------------------------------------------

interface WalkInFormProps {
  onSuccess: (name: string) => void
  onCancel: () => void
}

function WalkInForm({ onSuccess, onCancel }: WalkInFormProps) {
  const [fields, setFields] = useState({ first_name: '', last_name: '', email: '', company: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof fields, v: string) => setFields((f) => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/public/product-showcase-checkin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Something went wrong'); return }
      onSuccess(`${fields.first_name} ${fields.last_name}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '12px 14px',
    border: `1px solid ${NAVY_BORDER}`, borderRadius: 8, fontSize: 16,
    color: '#1f2937', background: '#fff', outline: 'none',
  }

  return (
    <div style={{ background: NAVY_LIGHT, border: `1px solid ${NAVY_BORDER}`, borderRadius: 12, padding: '20px 20px 16px', marginTop: 12 }}>
      <p style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Add Walk-In
      </p>
      {error && (
        <div style={{ marginBottom: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 14, color: '#dc2626' }}>
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>First Name *</label>
            <input style={inputStyle} value={fields.first_name} onChange={(e) => set('first_name', e.target.value)} required autoComplete="given-name" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Last Name *</label>
            <input style={inputStyle} value={fields.last_name} onChange={(e) => set('last_name', e.target.value)} required autoComplete="family-name" />
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Email *</label>
          <input style={inputStyle} type="email" value={fields.email} onChange={(e) => set('email', e.target.value)} required autoComplete="email" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Company *</label>
          <input style={inputStyle} value={fields.company} onChange={(e) => set('company', e.target.value)} required autoComplete="organization" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              flex: 1, padding: '13px 16px', background: submitting ? '#9ca3af' : GREEN,
              color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Checking in…' : 'Check In Walk-In'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '13px 16px', background: '#fff', color: '#374151',
              border: `1px solid ${NAVY_BORDER}`, borderRadius: 8, fontSize: 15,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Contact Card
// ---------------------------------------------------------------------------

interface ContactCardProps {
  contact: Contact
  onCheckedIn: (contactId: string) => void
  onError: (msg: string) => void
}

function ContactCard({ contact, onCheckedIn, onError }: ContactCardProps) {
  const [checking, setChecking] = useState(false)
  const isCheckedIn = contact.tags.some((t) => t.name === ATTENDED_TAG)
  const isRegistered = contact.tags.some((t) => t.name === REGISTERED_TAG)

  async function handleCheckIn() {
    if (isCheckedIn) return
    setChecking(true)
    try {
      const res = await fetch('/api/public/product-showcase-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contact.id }),
      })
      const json = await res.json()
      if (!res.ok) { onError(json.error ?? 'Check-in failed'); return }
      onCheckedIn(contact.id)
    } catch {
      onError('Network error. Please try again.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div style={{
      background: isCheckedIn ? GREEN_LIGHT : '#fff',
      border: `1px solid ${isCheckedIn ? GREEN_BORDER : NAVY_BORDER}`,
      borderRadius: 12,
      padding: '16px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
    }}>
      {/* Avatar initial */}
      <div style={{
        width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
        background: isCheckedIn ? GREEN : NAVY,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 700, color: '#fff',
      }}>
        {isCheckedIn
          ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          : contact.first_name.charAt(0).toUpperCase()
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
            {contact.first_name} {contact.last_name}
          </span>
          {isCheckedIn && (
            <span style={{ fontSize: 11, fontWeight: 700, color: GREEN, background: GREEN_LIGHT, border: `1px solid ${GREEN_BORDER}`, borderRadius: 4, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Checked In
            </span>
          )}
          {isRegistered && !isCheckedIn && (
            <span style={{ fontSize: 11, fontWeight: 700, color: PURPLE, background: PURPLE_LIGHT, border: '1px solid #ddd6fe', borderRadius: 4, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Registered
            </span>
          )}
        </div>
        {contact.company && (
          <p style={{ margin: '1px 0 0', fontSize: 13, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {contact.company}
          </p>
        )}
        <p style={{ margin: '1px 0 0', fontSize: 12, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {contact.email}
        </p>
      </div>

      {/* Check-in button */}
      <button
        onClick={handleCheckIn}
        disabled={isCheckedIn || checking}
        style={{
          flexShrink: 0,
          padding: '10px 16px',
          background: isCheckedIn ? GREEN_LIGHT : NAVY,
          color: isCheckedIn ? GREEN : '#fff',
          border: isCheckedIn ? `1px solid ${GREEN_BORDER}` : 'none',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 700,
          cursor: isCheckedIn ? 'default' : checking ? 'wait' : 'pointer',
          minWidth: 90,
          transition: 'background 0.15s',
        }}
      >
        {checking ? '…' : isCheckedIn ? '✓ Done' : 'Check In'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CheckInPage() {
  const [search, setSearch] = useState('')
  const [allContacts, setAllContacts] = useState<Contact[]>([])  // full registered list
  const [searchResults, setSearchResults] = useState<Contact[]>([]) // server search results
  const [initialLoading, setInitialLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [showWalkIn, setShowWalkIn] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set())
  const [checkedInCount, setCheckedInCount] = useState<number | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastCounter = useRef(0)

  // Load all registered contacts on mount
  useEffect(() => {
    fetch('/api/public/product-showcase-checkin')
      .then((r) => r.json())
      .then((d) => { if (d.contacts) setAllContacts(d.contacts) })
      .catch(() => null)
      .finally(() => setInitialLoading(false))
  }, [])

  // Fetch checked-in count on mount
  useEffect(() => {
    fetch('/api/public/product-showcase-checkin-count')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.count != null) setCheckedInCount(d.count) })
      .catch(() => null)
  }, [])

  function mergeCheckedIn(list: Contact[]): Contact[] {
    return list.map((c) =>
      checkedInIds.has(c.id) && !c.tags.some((t) => t.name === ATTENDED_TAG)
        ? { ...c, tags: [...c.tags, { id: 'local', name: ATTENDED_TAG, color: GREEN }] }
        : c
    )
  }

  function addToast(message: string, type: Toast['type'] = 'success') {
    const id = ++toastCounter.current
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }

  function dismissToast(id: number) {
    setToasts((t) => t.filter((x) => x.id !== id))
  }

  const doServerSearch = useCallback(async (q: string) => {
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/public/product-showcase-checkin?search=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (res.ok) setSearchResults(json.contacts ?? [])
    } catch {
      // silently fail — stale results stay
    } finally {
      setSearchLoading(false)
    }
  }, [])

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setSearch(val)
    setShowWalkIn(false)
    if (val.length < 2) {
      setSearchResults([])
      if (debounceRef.current) clearTimeout(debounceRef.current)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doServerSearch(val), 300)
  }

  function applyCheckedIn(list: Contact[], contactId: string): Contact[] {
    return list.map((c) =>
      c.id === contactId && !c.tags.some((t) => t.name === ATTENDED_TAG)
        ? { ...c, tags: [...c.tags, { id: 'local', name: ATTENDED_TAG, color: GREEN }] }
        : c
    )
  }

  function handleCheckedIn(contactId: string) {
    setCheckedInIds((s) => new Set([...s, contactId]))
    setAllContacts((prev) => applyCheckedIn(prev, contactId))
    setSearchResults((prev) => applyCheckedIn(prev, contactId))
    const contact =
      allContacts.find((c) => c.id === contactId) ??
      searchResults.find((c) => c.id === contactId)
    if (contact) addToast(`✓ ${contact.first_name} ${contact.last_name} checked in!`)
    setCheckedInCount((n) => (n != null ? n + 1 : null))
  }

  function handleWalkInSuccess(name: string) {
    setShowWalkIn(false)
    setSearch('')
    setSearchResults([])
    addToast(`✓ ${name} checked in!`)
    setCheckedInCount((n) => (n != null ? n + 1 : null))
  }

  // What to display: search results when typing, full list otherwise
  const isSearching = search.length >= 2
  const displayContacts = isSearching ? mergeCheckedIn(searchResults) : mergeCheckedIn(allContacts)
  const loading = isSearching ? searchLoading : initialLoading
  const noResults = isSearching && !searchLoading && searchResults.length === 0

  return (
    <>
      <style>{`
        *{box-sizing:border-box}
        body{margin:0;background:#f0f2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        input:focus{border-color:${NAVY}!important;box-shadow:0 0 0 3px rgba(26,47,94,.12);outline:none}
        @media(max-width:480px){.checkin-header-inner{flex-direction:column;align-items:flex-start!important;gap:8px!important}}
      `}</style>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${NAVY_DARK} 0%, ${NAVY} 100%)`, padding: '20px 20px 18px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.06, backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="checkin-header-inner" style={{ maxWidth: 600, margin: '0 auto', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Arcon Solutions
            </p>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '0.02em' }}>
              Product Showcase 2026
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'rgba(255,255,255,.7)' }}>
              September 18 · Check-In
            </p>
          </div>
          {checkedInCount != null && (
            <div style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 10, padding: '8px 14px', textAlign: 'center', flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{checkedInCount}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Checked In</p>
            </div>
          )}
        </div>
      </div>

      {/* Search + results */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px 40px' }}>

        {/* Search bar */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <svg
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}
            width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            placeholder="Search by name, email, or company…"
            value={search}
            onChange={handleSearchChange}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            style={{
              width: '100%', padding: '15px 14px 15px 44px',
              border: `1px solid ${NAVY_BORDER}`, borderRadius: 12,
              fontSize: 16, color: '#1f2937', background: '#fff',
              boxShadow: '0 1px 4px rgba(0,0,0,.06)',
            }}
          />
          {loading && (
            <svg
              style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: NAVY, animation: 'spin 0.8s linear infinite' }}
              width="18" height="18" viewBox="0 0 24 24" fill="none"
            >
              <circle cx="12" cy="12" r="10" stroke="rgba(26,47,94,.2)" strokeWidth="4"/>
              <path fill={NAVY} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          )}
        </div>

        {/* Loading skeleton */}
        {loading && displayContacts.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: `1px solid ${NAVY_BORDER}`, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#e5e7eb', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: '40%', height: 14, background: '#e5e7eb', borderRadius: 4, marginBottom: 6 }} />
                  <div style={{ width: '60%', height: 11, background: '#f3f4f6', borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results list */}
        {displayContacts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
            {displayContacts.map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                onCheckedIn={handleCheckedIn}
                onError={(msg) => addToast(msg, 'error')}
              />
            ))}
          </div>
        )}

        {/* No search results */}
        {noResults && !showWalkIn && (
          <div style={{ textAlign: 'center', padding: '32px 20px', background: '#fff', borderRadius: 12, border: `1px solid ${NAVY_BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: '#374151' }}>No one found for &ldquo;{search}&rdquo;</p>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280' }}>They may not be in the CRM yet.</p>
            <button
              onClick={() => setShowWalkIn(true)}
              style={{
                padding: '12px 24px', background: NAVY, color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Walk-In
            </button>
          </div>
        )}

        {/* Walk-in button (always available below the list) */}
        {displayContacts.length > 0 && !showWalkIn && (
          <button
            onClick={() => setShowWalkIn(true)}
            style={{
              width: '100%', padding: '12px', background: '#fff',
              color: NAVY, border: `1px dashed ${NAVY_BORDER}`, borderRadius: 10,
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Not listed? Add Walk-In
          </button>
        )}

        {showWalkIn && (
          <WalkInForm
            onSuccess={handleWalkInSuccess}
            onCancel={() => setShowWalkIn(false)}
          />
        )}
      </div>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <style>{`
        @keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }
      `}</style>
    </>
  )
}
