'use client'

import { useState, useEffect } from 'react'
import { PtoRequest, PTO_REASON_LABELS } from '@/types'

function formatDate(d: string) {
  const [y, m, day] = d.split('-')
  const date = new Date(Number(y), Number(m) - 1, Number(day))
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type Filter = 'all' | 'pending' | 'approved' | 'denied'

const STAT_CARDS: { key: Filter; label: string; bg: string; color: string; subtitle: (count: number) => string }[] = [
  { key: 'pending',  label: 'Pending',      bg: '#fef9c3', color: '#854d0e', subtitle: (n) => n === 1 ? 'Awaiting review' : 'Awaiting review' },
  { key: 'approved', label: 'Approved',     bg: '#dcfce7', color: '#166534', subtitle: () => 'Time off approved' },
  { key: 'denied',   label: 'Not Approved', bg: '#fee2e2', color: '#991b1b', subtitle: () => 'Requests denied' },
]

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
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    pending:  { bg: '#fef9c3', color: '#854d0e', label: 'Pending' },
    approved: { bg: '#dcfce7', color: '#166534', label: 'Approved' },
    denied:   { bg: '#fee2e2', color: '#991b1b', label: 'Not Approved' },
  }
  const c = cfg[status] ?? { bg: '#f3f4f6', color: '#374151', label: status }
  return (
    <span style={{ background: c.bg, color: c.color, padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
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
    all:      requests.length,
    pending:  requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    denied:   requests.filter(r => r.status === 'denied').length,
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
        .pto-table { width: 100%; border-collapse: collapse; }
        .pto-table th { text-align: left; padding: 10px 14px; background: #f8f7ff; color: #6d28d9; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; border-bottom: 2px solid #ede9fe; }
        .pto-table td { padding: 12px 14px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
        .pto-table tr:last-child td { border-bottom: none; }
        .pto-table tr:hover td { background: #faf5ff; }
        .btn-approve { background: #dcfce7; color: #166534; border: 1px solid #86efac; border-radius: 6px; padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer; }
        .btn-approve:hover { background: #bbf7d0; }
        .btn-deny { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; border-radius: 6px; padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer; }
        .btn-deny:hover { background: #fecaca; }
        .stat-card { border-radius: 14px; padding: 20px 22px; cursor: pointer; transition: box-shadow .15s, filter .15s; }
        .stat-card:hover { filter: brightness(.96); box-shadow: 0 2px 10px rgba(0,0,0,.08); }
        .form-input { border: 1.5px solid #d1d5db; border-radius: 8px; padding: 8px 12px; font-size: 14px; box-sizing: border-box; }
        .form-input:focus { outline: none; border-color: #7c3aed; }
        .btn-secondary { background: #ede9fe; color: #5b21b6; border: none; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .btn-secondary:hover { background: #ddd6fe; }
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

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#1e1b4b' }}>PTO Requests</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>Review and action employee time-off requests.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
          {STAT_CARDS.map(({ key, label, bg, color, subtitle }) => {
            const count = counts[key]
            const isActive = filter === key
            return (
              <div key={key} className="stat-card" style={{ background: bg, outline: isActive ? `2.5px solid ${color}` : 'none' }} onClick={() => setFilter(isActive ? 'all' : key)}>
                <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color, marginTop: 8 }}>{label}</div>
                <div style={{ fontSize: 12, color, opacity: .7, marginTop: 3 }}>{subtitle(count)}</div>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="form-input" style={{ minWidth: 180 }} value={filter} onChange={e => setFilter(e.target.value as Filter)}>
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="denied">Not Approved</option>
          </select>
          {filter !== 'all' && (
            <button className="btn-secondary" onClick={() => setFilter('all')}>Clear</button>
          )}
        </div>

        {loading ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>No requests found.</div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e9d5ff', borderRadius: 12, overflow: 'hidden' }}>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar user={u} />
                          <div>
                            <div style={{ fontWeight: 600, color: '#1e1b4b' }}>{u?.display_name ?? '—'}</div>
                            <div style={{ fontSize: 12, color: '#9ca3af' }}>{u?.email ?? ''}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#374151' }}>
                          {formatDate(r.start_date)}
                          {r.start_date !== r.end_date ? ` – ${formatDate(r.end_date)}` : ''}
                        </div>
                        {(r.start_half_day || r.end_half_day) && (
                          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                            {r.start_half_day && 'Half day start'}
                            {r.start_half_day && r.end_half_day && ' · '}
                            {r.end_half_day && 'Half day end'}
                          </div>
                        )}
                      </td>
                      <td style={{ color: '#374151', fontSize: 13 }}>
                        {PTO_REASON_LABELS[r.reason]}
                        {r.notes && (
                          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3, fontStyle: 'italic' }}>{r.notes}</div>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={r.status} />
                        {r.reviewer_comment && (
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, fontStyle: 'italic' }}>{r.reviewer_comment}</div>
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
