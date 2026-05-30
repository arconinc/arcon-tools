'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface ReportDetail {
  id: string
  created_by: string
  period_month: string
  status: string
  drive_file_id: string | null
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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; description: string }> = {
  draft:                 { label: 'Draft',                  bg: '#f3f4f6', color: '#374151', description: 'The employee has not yet submitted this report.' },
  submitted:             { label: 'Awaiting Review',        bg: '#dbeafe', color: '#1d4ed8', description: 'Submitted and waiting for your review.' },
  needs_changes:         { label: 'Needs Changes',          bg: '#fef3c7', color: '#92400e', description: 'You have requested changes. Waiting for re-submission.' },
  approved:              { label: 'Approved',               bg: '#dcfce7', color: '#166534', description: 'Report has been approved.' },
  submitted_to_payroll:  { label: 'Submitted to Payroll',   bg: '#ede9fe', color: '#5b21b6', description: 'Submitted to payroll for reimbursement.' },
}

export default function AdminExpenseReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Modal state for Needs Changes
  const [showNeedsChanges, setShowNeedsChanges] = useState(false)
  const [needsChangesComment, setNeedsChangesComment] = useState('')

  // Confirm modals
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [showPayrollConfirm, setShowPayrollConfirm] = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/admin/expense-reports/${id}`)
    if (res.status === 404 || res.status === 403) { router.replace('/admin/expense-reports'); return }
    const data = await res.json()
    setReport(data.report)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function handleAction(status: string, comment?: string) {
    setActionLoading(true)
    setActionError(null)
    const res = await fetch(`/api/admin/expense-reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, comment: comment ?? null }),
    })
    const data = await res.json()
    if (!res.ok) {
      setActionError(data.error ?? 'Action failed')
      setActionLoading(false)
      return
    }
    setShowNeedsChanges(false)
    setShowApproveConfirm(false)
    setShowPayrollConfirm(false)
    setNeedsChangesComment('')
    load()
    setActionLoading(false)
  }

  if (loading) return <p style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading…</p>
  if (!report) return null

  const statusCfg = STATUS_CONFIG[report.status] ?? { label: report.status, bg: '#f3f4f6', color: '#374151', description: '' }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 24px' }}>
      <style>{`
        .btn-primary { background: #7c3aed; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .btn-primary:hover:not(:disabled) { background: #6d28d9; }
        .btn-primary:disabled { opacity: .6; cursor: not-allowed; }
        .btn-secondary { background: #ede9fe; color: #5b21b6; border: none; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .btn-secondary:hover:not(:disabled) { background: #ddd6fe; }
        .btn-secondary:disabled { opacity: .6; cursor: not-allowed; }
        .btn-green { background: #16a34a; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .btn-green:hover:not(:disabled) { background: #15803d; }
        .btn-green:disabled { opacity: .6; cursor: not-allowed; }
        .btn-amber { background: #d97706; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .btn-amber:hover:not(:disabled) { background: #b45309; }
        .btn-amber:disabled { opacity: .6; cursor: not-allowed; }
        .btn-sheets { background: #188038; color: #fff; border: none; padding: 12px 24px; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; text-decoration: none; display: inline-block; }
        .btn-sheets:hover { background: #137333; }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 50; display: flex; align-items: center; justify-content: center; }
        .modal { background: #fff; border-radius: 16px; padding: 32px; max-width: 500px; width: 90vw; box-shadow: 0 20px 60px rgba(0,0,0,.18); }
        .form-input { width: 100%; border: 1.5px solid #d1d5db; border-radius: 8px; padding: 8px 12px; font-size: 14px; box-sizing: border-box; }
        .form-input:focus { outline: none; border-color: #7c3aed; }
      `}</style>

      <div style={{ marginBottom: 8 }}>
        <Link href="/admin/expense-reports" style={{ color: '#7c3aed', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>
          ← Back to All Reports
        </Link>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '16px 0 4px', fontSize: 24, fontWeight: 700, color: '#1e1b4b' }}>
          {report.submitter?.display_name ?? 'Unknown'} — {formatMonth(report.period_month)}
        </h1>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#9ca3af' }}>
          {report.submitter?.email} · Created {formatDate(report.created_at)} · Last updated {formatDate(report.updated_at)}
        </p>
      </div>

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
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Your Reviewer Note</div>
          <p style={{ margin: 0, fontSize: 14, color: '#78350f', fontStyle: 'italic' }}>&ldquo;{report.reviewer_comment}&rdquo;</p>
        </div>
      )}

      {/* Open in Sheets */}
      <div style={{ marginBottom: 32 }}>
        {report.drive_url ? (
          <a href={report.drive_url} target="_blank" rel="noopener noreferrer" className="btn-sheets">
            Open in Google Sheets ↗
          </a>
        ) : (
          <p style={{ color: '#9ca3af', fontSize: 14 }}>No Google Sheets link available.</p>
        )}
        <p style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>
          Use the <strong>Arc Expense Report</strong> menu inside Google Sheets to update the status directly from the sheet. The actions below are a fallback if needed.
        </p>
      </div>

      {/* Admin status actions */}
      {report.status !== 'submitted_to_payroll' && (
        <div style={{ background: '#f8f7ff', border: '1px solid #e9d5ff', borderRadius: 12, padding: '20px 24px' }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#374151' }}>Update Status</h2>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
            These actions mirror the options in the Google Sheets menu. Use them if you prefer to update status from The Arc.
          </p>

          {actionError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 14, marginBottom: 14 }}>
              {actionError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {['submitted', 'needs_changes', 'draft'].includes(report.status) && (
              <button className="btn-amber" disabled={actionLoading} onClick={() => setShowNeedsChanges(true)}>
                ↩ Needs Changes
              </button>
            )}
            {['submitted', 'needs_changes', 'draft'].includes(report.status) && (
              <button className="btn-green" disabled={actionLoading} onClick={() => setShowApproveConfirm(true)}>
                ✓ Approve
              </button>
            )}
            {report.status === 'approved' && (
              <button className="btn-primary" disabled={actionLoading} onClick={() => setShowPayrollConfirm(true)}>
                💰 Submit to Payroll
              </button>
            )}
            {report.status === 'submitted_to_payroll' && (
              <span style={{ color: '#5b21b6', fontWeight: 600, fontSize: 14 }}>✓ Submitted to payroll — no further action needed.</span>
            )}
          </div>
        </div>
      )}

      {report.status === 'submitted_to_payroll' && (
        <div style={{ background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: 12, padding: '16px 20px' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#5b21b6', fontWeight: 600 }}>✓ This report has been submitted to payroll. No further action needed.</p>
        </div>
      )}

      {/* Needs Changes modal */}
      {showNeedsChanges && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) { setShowNeedsChanges(false); setNeedsChangesComment('') } }}>
          <div className="modal">
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#1e1b4b' }}>Request Changes</h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280' }}>
              {report.submitter?.display_name} will be notified that their report needs corrections.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Comment for employee *</label>
              <textarea
                className="form-input"
                rows={4}
                value={needsChangesComment}
                onChange={e => setNeedsChangesComment(e.target.value)}
                placeholder="Describe what needs to be corrected or updated…"
                autoFocus
              />
            </div>
            {actionError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 14, marginBottom: 14 }}>
                {actionError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => { setShowNeedsChanges(false); setNeedsChangesComment('') }}>Cancel</button>
              <button
                className="btn-amber"
                disabled={actionLoading || !needsChangesComment.trim()}
                onClick={() => handleAction('needs_changes', needsChangesComment.trim())}
              >
                {actionLoading ? 'Saving…' : '↩ Request Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve confirmation */}
      {showApproveConfirm && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowApproveConfirm(false) }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 700, color: '#1e1b4b' }}>Approve Report?</h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280' }}>
              This will mark <strong>{report.submitter?.display_name}</strong>&apos;s {formatMonth(report.period_month)} expense report as approved and notify them.
            </p>
            {actionError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 14, marginBottom: 14 }}>
                {actionError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowApproveConfirm(false)}>Cancel</button>
              <button className="btn-green" disabled={actionLoading} onClick={() => handleAction('approved')}>
                {actionLoading ? 'Saving…' : '✓ Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit to payroll confirmation */}
      {showPayrollConfirm && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowPayrollConfirm(false) }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 700, color: '#1e1b4b' }}>Submit to Payroll?</h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280' }}>
              This will mark <strong>{report.submitter?.display_name}</strong>&apos;s {formatMonth(report.period_month)} expense report as submitted to payroll and notify them.
            </p>
            {actionError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 14, marginBottom: 14 }}>
                {actionError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowPayrollConfirm(false)}>Cancel</button>
              <button className="btn-primary" disabled={actionLoading} onClick={() => handleAction('submitted_to_payroll')}>
                {actionLoading ? 'Saving…' : '💰 Submit to Payroll'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
