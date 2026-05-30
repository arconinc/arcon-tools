'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface ReportDetail {
  id: string
  period_month: string
  status: string
  drive_url: string | null
  reviewer_comment: string | null
  created_at: string
  updated_at: string
  submitter: { id: string; display_name: string; email: string } | null
}

function formatMonth(ym: string) {
  const [year, month] = ym.split('-')
  return new Date(Number(year), Number(month) - 1, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; description: string }> = {
  draft:                 { label: 'Draft',                  bg: '#f3f4f6', color: '#374151', description: 'Open the sheet, fill it out, then use the Arc Expense Report menu to submit for review.' },
  submitted:             { label: 'Awaiting Review',        bg: '#dbeafe', color: '#1d4ed8', description: 'Your report has been submitted and is awaiting review.' },
  needs_changes:         { label: 'Needs Changes',          bg: '#fef3c7', color: '#92400e', description: 'The reviewer has requested changes. Open the sheet, make corrections, and re-submit.' },
  approved:              { label: 'Approved',               bg: '#dcfce7', color: '#166534', description: 'Your expense report has been approved. No further action needed.' },
  submitted_to_payroll:  { label: 'Submitted to Payroll',   bg: '#ede9fe', color: '#5b21b6', description: 'Your expense report has been submitted to payroll for reimbursement.' },
}

export default function ExpenseReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/expense-reports/${id}`)
      .then(r => { if (r.status === 404) { router.replace('/expense-reports'); return null } return r.json() })
      .then(data => { if (data) setReport(data.report) })
      .finally(() => setLoading(false))
  }, [id])

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    const res = await fetch(`/api/expense-reports/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.replace('/expense-reports')
    } else {
      const data = await res.json().catch(() => ({}))
      setDeleteError(data.error ?? 'Failed to delete report')
      setDeleting(false)
    }
  }

  if (loading) return <p style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading…</p>
  if (!report) return null

  const statusCfg = STATUS_CONFIG[report.status] ?? { label: report.status, bg: '#f3f4f6', color: '#374151', description: '' }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>
      <style>{`
        .btn-sheets { background: #188038; color: #fff; border: none; padding: 12px 24px; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; text-decoration: none; display: inline-block; }
        .btn-sheets:hover { background: #137333; }
        .btn-secondary { background: #ede9fe; color: #5b21b6; border: none; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .btn-secondary:hover { background: #ddd6fe; }
        .btn-danger { background: #fee2e2; color: #dc2626; border: none; padding: 9px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .btn-danger:hover:not(:disabled) { background: #fecaca; }
        .btn-danger-solid { background: #dc2626; color: #fff; border: none; padding: 9px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .btn-danger-solid:hover:not(:disabled) { background: #b91c1c; }
        .btn-danger-solid:disabled { opacity: .6; cursor: not-allowed; }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 50; display: flex; align-items: center; justify-content: center; }
        .modal { background: #fff; border-radius: 16px; padding: 32px; max-width: 440px; width: 90vw; box-shadow: 0 20px 60px rgba(0,0,0,.18); }
      `}</style>

      <div style={{ marginBottom: 8 }}>
        <Link href="/expense-reports" style={{ color: '#7c3aed', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          ← Back to Expense Reports
        </Link>
      </div>

      <h1 style={{ margin: '16px 0 4px', fontSize: 24, fontWeight: 700, color: '#1e1b4b' }}>
        {formatMonth(report.period_month)} Expense Report
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: '#9ca3af' }}>
        Created {formatDate(report.created_at)} · Last updated {formatDate(report.updated_at)}
      </p>

      {/* Status card */}
      <div style={{ background: statusCfg.bg, border: `1.5px solid ${statusCfg.color}33`, borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ background: statusCfg.bg, color: statusCfg.color, border: `1.5px solid ${statusCfg.color}55`, padding: '3px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700 }}>
            {statusCfg.label}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: statusCfg.color, fontWeight: 500 }}>{statusCfg.description}</p>
      </div>

      {/* Reviewer comment */}
      {report.reviewer_comment && (
        <div style={{ background: '#fef3c7', border: '1.5px solid #fcd34d', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Reviewer Note</div>
          <p style={{ margin: 0, fontSize: 14, color: '#78350f', fontStyle: 'italic' }}>&ldquo;{report.reviewer_comment}&rdquo;</p>
        </div>
      )}

      {/* Primary action */}
      {report.drive_url ? (
        <a href={report.drive_url} target="_blank" rel="noopener noreferrer" className="btn-sheets" style={{ marginBottom: 12 }}>
          Open in Google Sheets ↗
        </a>
      ) : (
        <p style={{ color: '#9ca3af', fontSize: 14 }}>No Google Sheets link available.</p>
      )}

      {['draft', 'needs_changes'].includes(report.status) && report.drive_url && (
        <p style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>
          After opening the sheet, use the <strong>Arc Expense Report</strong> menu to submit for review.
        </p>
      )}

      {report.status === 'draft' && (
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #f3f4f6' }}>
          <button className="btn-danger" onClick={() => { setShowDeleteConfirm(true); setDeleteError(null) }}>
            Delete Report
          </button>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) { setShowDeleteConfirm(false); setDeleteError(null) } }}>
          <div className="modal">
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#1e1b4b' }}>Delete Expense Report?</h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>
              Are you sure you want to delete your <strong>{formatMonth(report.period_month)}</strong> expense report? This cannot be undone.
            </p>
            {deleteError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 14, marginBottom: 16 }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" disabled={deleting} onClick={() => { setShowDeleteConfirm(false); setDeleteError(null) }}>Cancel</button>
              <button className="btn-danger-solid" disabled={deleting} onClick={handleDelete}>
                {deleting ? 'Deleting…' : 'Delete Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
