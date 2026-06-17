'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PtoRequest, PTO_REASON_LABELS } from '@/types'

function formatDate(d: string) {
  const [y, m, day] = d.split('-')
  const date = new Date(Number(y), Number(m) - 1, Number(day))
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusBadge({ status }: { status: PtoRequest['status'] }) {
  const styles: Record<string, string> = {
    pending: 'background:#fef9c3;color:#854d0e;border:1px solid #fde047',
    approved: 'background:#dcfce7;color:#166534;border:1px solid #86efac',
    denied: 'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5',
  }
  const labels: Record<string, string> = {
    pending: 'Pending',
    approved: 'Approved',
    denied: 'Not Approved',
  }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      ...Object.fromEntries(styles[status].split(';').filter(Boolean).map(s => {
        const [k, v] = s.split(':')
        return [k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v.trim()]
      })),
    }}>
      {labels[status]}
    </span>
  )
}

export default function PtoRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<PtoRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/hr/pto')
      .then(r => r.json())
      .then(d => setRequests(d.requests ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string) {
    if (!confirm('Delete this PTO request?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/hr/pto/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setRequests(prev => prev.filter(r => r.id !== id))
      } else {
        const data = await res.json()
        alert(data.error ?? 'Failed to delete')
      }
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <style>{`
        .pto-page { padding: 28px 32px; max-width: 900px; }
        .pto-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .pto-title { font-size: 22px; font-weight: 800; color: #111; }
        .btn-primary { background: #6b1e98; color: #fff; border: none; border-radius: 7px; padding: 9px 18px; font-size: 13px; font-weight: 700; cursor: pointer; text-decoration: none; display: inline-block; }
        .btn-primary:hover { background: #581580; }
        .pto-empty { text-align: center; padding: 48px 0; color: #888; font-size: 14px; }
        .pto-table { width: 100%; border-collapse: collapse; }
        .pto-table th { font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.06em; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: left; }
        .pto-table td { padding: 14px 12px; border-bottom: 1px solid #f3f4f6; vertical-align: top; font-size: 13px; color: #333; }
        .pto-table tr:last-child td { border-bottom: none; }
        .pto-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .btn-sm { padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1px solid transparent; }
        .btn-edit { background: #f3e8ff; color: #6b1e98; border-color: #d8b4fe; }
        .btn-edit:hover { background: #ede9fe; }
        .btn-delete { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
        .btn-delete:hover { background: #fecaca; }
        .denied-comment { font-size: 11px; color: #b91c1c; margin-top: 4px; font-style: italic; }
        .pto-notes { font-size: 11px; color: #888; margin-top: 3px; }
      `}</style>
      <div className="pto-page">
        <div className="pto-header">
          <div className="pto-title">My PTO Requests</div>
          <Link href="/hr/pto/new" className="btn-primary">+ Request Time Off</Link>
        </div>

        {loading ? (
          <div className="pto-empty">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="pto-empty">
            No PTO requests yet.{' '}
            <Link href="/hr/pto/new" style={{ color: '#6b1e98', fontWeight: 700 }}>Submit your first request.</Link>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <table className="pto-table">
              <thead>
                <tr>
                  <th>Dates</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {formatDate(r.start_date)}
                        {r.start_date !== r.end_date ? ` – ${formatDate(r.end_date)}` : ''}
                      </div>
                      {(r.start_half_day || r.end_half_day) && (
                        <div className="pto-notes">
                          {r.start_half_day && 'Half day start'}
                          {r.start_half_day && r.end_half_day && ' · '}
                          {r.end_half_day && 'Half day end'}
                        </div>
                      )}
                    </td>
                    <td>
                      {PTO_REASON_LABELS[r.reason]}
                      {r.notes && <div className="pto-notes">{r.notes}</div>}
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                      {(r.status === 'approved' || r.status === 'denied') && (r as any).reviewer?.display_name && (
                        <div className="pto-notes">
                          {r.status === 'approved' ? 'Approved' : 'Denied'} by {(r as any).reviewer.display_name}
                        </div>
                      )}
                      {r.status === 'denied' && r.reviewer_comment && (
                        <div className="denied-comment">{r.reviewer_comment}</div>
                      )}
                    </td>
                    <td>
                      <div className="pto-actions">
                        {(r.status === 'pending' || r.status === 'denied') && (
                          <>
                            {r.status === 'denied' && (
                              <button
                                className="btn-sm btn-edit"
                                onClick={() => router.push(`/hr/pto/edit/${r.id}`)}
                              >
                                Edit & Resubmit
                              </button>
                            )}
                            <button
                              className="btn-sm btn-delete"
                              disabled={deletingId === r.id}
                              onClick={() => handleDelete(r.id)}
                            >
                              {deletingId === r.id ? 'Deleting…' : 'Delete'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
