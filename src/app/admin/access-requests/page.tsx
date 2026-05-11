'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface AccessRequest {
  id: string
  status: string
  resource_type: string | null
  resource_key: string | null
  message: string | null
  review_note: string | null
  created_at: string
  reviewed_at: string | null
  roles: { id: string; name: string; label: string; color: string } | null
  requester: { id: string; display_name: string; email: string; avatar_url: string | null; profile_image_url: string | null } | null
  reviewer: { id: string; display_name: string } | null
}

export default function AdminAccessRequestsPage() {
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [tab, setTab] = useState<'pending' | 'approved' | 'denied'>('pending')
  const [loading, setLoading] = useState(true)
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({})
  const [acting, setActing] = useState<string | null>(null)

  async function load(status: string) {
    setLoading(true)
    const res = await fetch(`/api/admin/access-requests?status=${status}`)
    const data = await res.json()
    setRequests(data)
    setLoading(false)
  }

  useEffect(() => { load(tab) }, [tab])

  async function handleAction(requestId: string, action: 'approved' | 'denied') {
    setActing(requestId)
    await fetch('/api/admin/access-requests', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: requestId, action, review_note: reviewNote[requestId] ?? '' }),
    })
    setActing(null)
    load(tab)
  }

  return (
    <>
      <style>{`
        .ar-page { padding: 32px 24px; max-width: 860px; }
        .ar-header { margin-bottom: 24px; }
        .ar-title { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px; }
        .ar-sub { font-size: 14px; color: #6b7280; margin: 0; }
        .ar-tabs { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 1px solid #e5e7eb; }
        .ar-tab { padding: 8px 14px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; background: none; color: #6b7280; border-bottom: 2px solid transparent; margin-bottom: -1px; }
        .ar-tab.active { color: #7c3aed; border-bottom-color: #7c3aed; }
        .ar-empty { padding: 40px; text-align: center; color: #9ca3af; font-size: 14px; }
        .ar-row { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; background: #fff; }
        .ar-user { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .ar-avatar { width: 32px; height: 32px; border-radius: 50%; background: #e5e7eb; overflow: hidden; flex-shrink: 0; }
        .ar-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .ar-avatar-initials { width: 32px; height: 32px; border-radius: 50%; background: #7c3aed; color: #fff; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center; }
        .ar-name { font-size: 14px; font-weight: 600; color: #111827; }
        .ar-email { font-size: 12px; color: #6b7280; }
        .ar-role-badge { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 12px; font-weight: 500; }
        .ar-message { font-size: 13px; color: #374151; background: #f9fafb; border-radius: 6px; padding: 10px 12px; margin-bottom: 12px; font-style: italic; }
        .ar-meta { font-size: 12px; color: #9ca3af; margin-bottom: 12px; }
        .ar-review-input { width: 100%; border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 10px; font-size: 13px; color: #111827; font-family: inherit; resize: none; box-sizing: border-box; min-height: 64px; margin-bottom: 10px; }
        .ar-actions { display: flex; gap: 8px; }
        .ar-btn-approve { padding: 7px 16px; background: #16a34a; color: #fff; border-radius: 6px; font-size: 13px; font-weight: 500; border: none; cursor: pointer; }
        .ar-btn-deny { padding: 7px 16px; background: #f3f4f6; color: #dc2626; border-radius: 6px; font-size: 13px; font-weight: 500; border: none; cursor: pointer; }
        .ar-btn-approve:disabled, .ar-btn-deny:disabled { opacity: 0.5; cursor: not-allowed; }
        .ar-review-note { font-size: 12px; color: #6b7280; margin-top: 8px; }
      `}</style>
      <div className="ar-page">
        <div className="ar-header">
          <h1 className="ar-title">Access Requests</h1>
          <p className="ar-sub">Review and approve or deny employee access requests.</p>
        </div>
        <div className="ar-tabs">
          {(['pending', 'approved', 'denied'] as const).map(t => (
            <button key={t} className={`ar-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        {loading ? (
          <p className="ar-empty">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="ar-empty">No {tab} requests.</p>
        ) : (
          requests.map(r => {
            const avatarSrc = r.requester?.profile_image_url || r.requester?.avatar_url
            const initials = (r.requester?.display_name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
            const isActing = acting === r.id
            return (
              <div key={r.id} className="ar-row">
                <div className="ar-user">
                  <div className="ar-avatar">
                    {avatarSrc ? (
                      <Image src={avatarSrc} alt="" width={32} height={32} style={{ objectFit: 'cover' }} />
                    ) : (
                      <div className="ar-avatar-initials">{initials}</div>
                    )}
                  </div>
                  <div>
                    <div className="ar-name">{r.requester?.display_name ?? 'Unknown'}</div>
                    <div className="ar-email">{r.requester?.email}</div>
                  </div>
                  {r.roles && (
                    <span className="ar-role-badge" style={{ background: r.roles.color + '22', color: r.roles.color, marginLeft: 'auto' }}>
                      {r.roles.label}
                    </span>
                  )}
                </div>
                {r.message && <div className="ar-message">&ldquo;{r.message}&rdquo;</div>}
                <div className="ar-meta">
                  Requested {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {r.resource_key && <> &nbsp;·&nbsp; Resource: <code>{r.resource_key}</code></>}
                </div>
                {tab === 'pending' && (
                  <>
                    <textarea
                      className="ar-review-input"
                      placeholder="Optional note to the requester…"
                      value={reviewNote[r.id] ?? ''}
                      onChange={e => setReviewNote(prev => ({ ...prev, [r.id]: e.target.value }))}
                    />
                    <div className="ar-actions">
                      <button className="ar-btn-approve" disabled={isActing} onClick={() => handleAction(r.id, 'approved')}>
                        {isActing ? 'Saving…' : 'Approve'}
                      </button>
                      <button className="ar-btn-deny" disabled={isActing} onClick={() => handleAction(r.id, 'denied')}>
                        Deny
                      </button>
                    </div>
                  </>
                )}
                {tab !== 'pending' && r.reviewer && (
                  <p className="ar-review-note">
                    {tab === 'approved' ? 'Approved' : 'Denied'} by {r.reviewer.display_name}
                    {r.review_note && <> — {r.review_note}</>}
                  </p>
                )}
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
