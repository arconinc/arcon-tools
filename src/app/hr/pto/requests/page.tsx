'use client'

import { useState, useEffect } from 'react'
import { PtoRequest, PTO_REASON_LABELS } from '@/types'

function formatDate(d: string) {
  const [y, m, day] = d.split('-')
  const date = new Date(Number(y), Number(m) - 1, Number(day))
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type Filter = 'all' | 'pending' | 'approved' | 'denied'

function Avatar({ user }: { user?: { display_name: string; avatar_url?: string | null } }) {
  if (user?.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt=""
        referrerPolicy="no-referrer"
        style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  const initials = (user?.display_name ?? '?').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#6b1e98', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
      {initials}
    </div>
  )
}

function StatusBadge({ status }: { status: PtoRequest['status'] }) {
  const cfg: Record<string, { bg: string; color: string; border: string; label: string }> = {
    pending: { bg: '#fef9c3', color: '#854d0e', border: '#fde047', label: 'Pending' },
    approved: { bg: '#dcfce7', color: '#166534', border: '#86efac', label: 'Approved' },
    denied: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', label: 'Not Approved' },
  }
  const c = cfg[status]
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  )
}

type RequestWithUser = PtoRequest & { users?: { display_name: string; email: string; avatar_url: string | null } }

export default function HrPtoRequestsPage() {
  const [requests, setRequests] = useState<RequestWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('pending')
  const [modal, setModal] = useState<{ id: string; action: 'approve' | 'deny'; title: string } | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/hr/pto/review')
      .then(r => r.json())
      .then(d => setRequests(d.requests ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)
  const counts: Record<Filter, number> = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    denied: requests.filter(r => r.status === 'denied').length,
  }

  function openModal(id: string, action: 'approve' | 'deny', name: string) {
    setModal({ id, action, title: name })
    setComment('')
    setModalError(null)
  }

  async function submitReview() {
    if (!modal) return
    if (modal.action === 'deny' && !comment.trim()) {
      setModalError('A comment is required when denying a request.')
      return
    }
    setSubmitting(true)
    setModalError(null)
    try {
      const res = await fetch(`/api/hr/pto/review/${modal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: modal.action, reviewer_comment: comment.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setModalError(data.error ?? 'Failed')
        return
      }
      setRequests(prev => prev.map(r => r.id === modal.id ? { ...r, ...data.request } : r))
      setModal(null)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <style>{`
        .hr-pto-page { padding: 28px 32px; max-width: 1000px; }
        .hr-pto-title { font-size: 22px; font-weight: 800; color: #111; margin-bottom: 20px; }
        .filter-tabs { display: flex; gap: 6px; margin-bottom: 18px; flex-wrap: wrap; }
        .filter-tab { padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; border: 1px solid #e5e7eb; background: #fff; color: #555; cursor: pointer; }
        .filter-tab.active { background: #f3e8ff; border-color: #6b1e98; color: #6b1e98; }
        .filter-tab-count { background: rgba(0,0,0,0.08); border-radius: 999px; padding: 1px 7px; font-size: 10px; margin-left: 5px; }
        .pto-table { width: 100%; border-collapse: collapse; }
        .pto-table th { font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.06em; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: left; }
        .pto-table td { padding: 14px 12px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; font-size: 13px; color: #333; }
        .pto-table tr:last-child td { border-bottom: none; }
        .emp-cell { display: flex; align-items: center; gap: 10px; }
        .emp-name { font-weight: 700; color: #111; font-size: 13px; }
        .emp-email { font-size: 11px; color: #888; }
        .btn-approve { background: #dcfce7; color: #166534; border: 1px solid #86efac; border-radius: 6px; padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer; }
        .btn-approve:hover { background: #bbf7d0; }
        .btn-deny { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; border-radius: 6px; padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer; }
        .btn-deny:hover { background: #fecaca; }
        .reviewer-comment { font-size: 11px; color: #888; margin-top: 4px; font-style: italic; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1000; display: flex; align-items: center; justify-content: center; }
        .modal-box { background: #fff; border-radius: 12px; padding: 24px; width: 420px; max-width: 95vw; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
        .modal-title { font-size: 16px; font-weight: 800; color: #111; margin-bottom: 8px; }
        .modal-desc { font-size: 13px; color: #555; margin-bottom: 16px; line-height: 1.5; }
        .modal-textarea { width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 10px; font-size: 13px; resize: vertical; min-height: 80px; }
        .modal-textarea:focus { outline: 2px solid #6b1e98; border-color: #6b1e98; }
        .modal-actions { display: flex; gap: 10px; margin-top: 14px; justify-content: flex-end; }
        .modal-error { background: #fee2e2; border: 1px solid #fca5a5; border-radius: 6px; color: #991b1b; font-size: 12px; padding: 8px 12px; margin-top: 8px; }
        .btn-confirm-approve { background: #16a34a; color: #fff; border: none; border-radius: 7px; padding: 9px 18px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .btn-confirm-approve:hover:not(:disabled) { background: #15803d; }
        .btn-confirm-deny { background: #dc2626; color: #fff; border: none; border-radius: 7px; padding: 9px 18px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .btn-confirm-deny:hover:not(:disabled) { background: #b91c1c; }
        .btn-cancel-modal { background: #f3f4f6; color: #555; border: 1px solid #e5e7eb; border-radius: 7px; padding: 9px 16px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .btn-cancel-modal:hover { background: #e5e7eb; }
        button:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      <div className="hr-pto-page">
        <div className="hr-pto-title">PTO Requests</div>

        <div className="filter-tabs">
          {(['pending', 'all', 'approved', 'denied'] as Filter[]).map(f => (
            <button key={f} className={`filter-tab${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'pending' ? 'Pending' : f === 'approved' ? 'Approved' : 'Not Approved'}
              <span className="filter-tab-count">{counts[f]}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#888', fontSize: 14 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#888', fontSize: 14 }}>No requests to show.</div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <table className="pto-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Dates</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const u = r.users
                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="emp-cell">
                          <Avatar user={u} />
                          <div>
                            <div className="emp-name">{u?.display_name ?? '—'}</div>
                            <div className="emp-email">{u?.email ?? ''}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {formatDate(r.start_date)}
                          {r.start_date !== r.end_date ? ` – ${formatDate(r.end_date)}` : ''}
                        </div>
                        {(r.start_half_day || r.end_half_day) && (
                          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                            {r.start_half_day && 'Half day start'}
                            {r.start_half_day && r.end_half_day && ' · '}
                            {r.end_half_day && 'Half day end'}
                          </div>
                        )}
                      </td>
                      <td>
                        {PTO_REASON_LABELS[r.reason]}
                        {r.notes && (
                          <div style={{ fontSize: 11, color: '#666', marginTop: 3, fontStyle: 'italic' }}>{r.notes}</div>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={r.status} />
                        {r.reviewer_comment && (
                          <div className="reviewer-comment">{r.reviewer_comment}</div>
                        )}
                      </td>
                      <td>
                        {r.status === 'pending' && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn-approve" onClick={() => openModal(r.id, 'approve', u?.display_name ?? 'this employee')}>Approve</button>
                            <button className="btn-deny" onClick={() => openModal(r.id, 'deny', u?.display_name ?? 'this employee')}>Deny</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {modal.action === 'approve' ? 'Approve PTO Request' : 'Deny PTO Request'}
            </div>
            <div className="modal-desc">
              {modal.action === 'approve'
                ? `Approve the PTO request for ${modal.title}? They will be notified.`
                : `Deny the PTO request for ${modal.title}. A comment is required.`}
            </div>
            <textarea
              className="modal-textarea"
              placeholder={modal.action === 'approve' ? 'Optional comment…' : 'Reason for denial (required)…'}
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
            {modalError && <div className="modal-error">{modalError}</div>}
            <div className="modal-actions">
              <button className="btn-cancel-modal" onClick={() => setModal(null)}>Cancel</button>
              <button
                className={modal.action === 'approve' ? 'btn-confirm-approve' : 'btn-confirm-deny'}
                disabled={submitting}
                onClick={submitReview}
              >
                {submitting ? 'Saving…' : modal.action === 'approve' ? 'Approve' : 'Deny'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
