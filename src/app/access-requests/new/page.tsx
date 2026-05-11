'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface Role {
  id: string
  name: string
  label: string
  description: string | null
  color: string
}

export default function AccessRequestNewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefilledRole = searchParams.get('role') ?? ''
  const resource = searchParams.get('resource') ?? ''
  const label = searchParams.get('label') ?? ''

  const [roles, setRoles] = useState<Role[]>([])
  const [roleId, setRoleId] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/admin/roles')
      .then(r => r.json())
      .then((data: Role[]) => {
        setRoles(data)
        if (prefilledRole) {
          const match = data.find(r => r.name === prefilledRole)
          if (match) setRoleId(match.id)
        }
      })
  }, [prefilledRole])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!roleId) { setError('Please select a role.'); return }
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/access-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: roleId, resource_key: resource || null, message }),
    })

    if (res.ok) {
      setSuccess(true)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong. Please try again.')
    }
    setSubmitting(false)
  }

  if (success) {
    return (
      <>
        <style>{`
          .ar-wrap { min-height: 60vh; display: flex; align-items: center; justify-content: center; padding: 48px 24px; }
          .ar-card { max-width: 480px; width: 100%; text-align: center; }
          .ar-check { width: 56px; height: 56px; background: #dcfce7; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: #16a34a; }
          .ar-title { font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 8px; }
          .ar-body { font-size: 14px; color: #6b7280; margin: 0 0 24px; line-height: 1.6; }
          .ar-btn { display: inline-block; padding: 9px 20px; background: #7c3aed; color: #fff; border-radius: 6px; font-size: 14px; font-weight: 500; text-decoration: none; cursor: pointer; border: none; }
        `}</style>
        <div className="ar-wrap">
          <div className="ar-card">
            <div className="ar-check">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h1 className="ar-title">Request Submitted</h1>
            <p className="ar-body">Your access request has been sent to an administrator. You&apos;ll receive a notification once it&apos;s been reviewed.</p>
            <button className="ar-btn" onClick={() => router.push('/dashboard')}>Back to Dashboard</button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <style>{`
        .ar-wrap { min-height: 60vh; display: flex; align-items: center; justify-content: center; padding: 48px 24px; }
        .ar-card { max-width: 480px; width: 100%; }
        .ar-title { font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 4px; }
        .ar-sub { font-size: 14px; color: #6b7280; margin: 0 0 28px; }
        .ar-label { display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px; }
        .ar-select, .ar-textarea {
          width: 100%; border: 1px solid #d1d5db; border-radius: 6px; padding: 9px 12px;
          font-size: 14px; color: #111827; background: #fff; box-sizing: border-box;
        }
        .ar-select { height: 38px; }
        .ar-textarea { min-height: 100px; resize: vertical; font-family: inherit; }
        .ar-field { margin-bottom: 20px; }
        .ar-error { font-size: 13px; color: #dc2626; margin-bottom: 12px; }
        .ar-actions { display: flex; gap: 12px; margin-top: 8px; }
        .ar-btn-primary { padding: 9px 20px; background: #7c3aed; color: #fff; border-radius: 6px; font-size: 14px; font-weight: 500; border: none; cursor: pointer; }
        .ar-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .ar-btn-secondary { padding: 9px 20px; background: #f3f4f6; color: #374151; border-radius: 6px; font-size: 14px; font-weight: 500; border: none; cursor: pointer; }
      `}</style>
      <div className="ar-wrap">
        <div className="ar-card">
          <h1 className="ar-title">Request Access</h1>
          <p className="ar-sub">
            {label ? `To access ${label}, you` : 'You'} need an additional role. Select the role below and optionally explain why you need it.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="ar-field">
              <label className="ar-label">Role</label>
              <select
                className="ar-select"
                value={roleId}
                onChange={e => setRoleId(e.target.value)}
                required
              >
                <option value="">Select a role…</option>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.label}{r.description ? ` — ${r.description}` : ''}</option>
                ))}
              </select>
            </div>
            <div className="ar-field">
              <label className="ar-label">Why do you need this access? <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
              <textarea
                className="ar-textarea"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Briefly explain your reason…"
                maxLength={500}
              />
            </div>
            {error && <p className="ar-error">{error}</p>}
            <div className="ar-actions">
              <button type="submit" className="ar-btn-primary" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
              <button type="button" className="ar-btn-secondary" onClick={() => router.back()}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
