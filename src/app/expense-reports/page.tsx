'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { ExpenseReport } from '@/types'

function formatMonth(ym: string) {
  const [year, month] = ym.split('-')
  return new Date(Number(year), Number(month) - 1, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function currentYearMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  draft:                 { label: 'Draft',                  bg: '#f3f4f6', color: '#374151' },
  submitted:             { label: 'Awaiting Review',        bg: '#dbeafe', color: '#1d4ed8' },
  needs_changes:         { label: 'Needs Changes',          bg: '#fef3c7', color: '#92400e' },
  approved:              { label: 'Approved',               bg: '#dcfce7', color: '#166534' },
  submitted_to_payroll:  { label: 'Submitted to Payroll',   bg: '#ede9fe', color: '#5b21b6' },
}

function StatusBadge({ status }: { status: string }) {
  const { label, bg, color } = STATUS_CONFIG[status] ?? { label: status, bg: '#f3f4f6', color: '#374151' }
  return (
    <span style={{ background: bg, color, padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

export default function ExpenseReportsPage() {
  const [reports, setReports] = useState<ExpenseReport[]>([])
  const [instructions, setInstructions] = useState<string | null>(null)
  const [templateDriveUrl, setTemplateDriveUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth())
  const [deleteTarget, setDeleteTarget] = useState<ExpenseReport | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [reportsRes, configRes] = await Promise.all([
      fetch('/api/expense-reports').then(r => r.json()),
      fetch('/api/admin/expense-reports/config').catch(() => ({ ok: false })),
    ])
    setReports(reportsRes.reports ?? [])

    // Config is also readable to check instructions (falls back gracefully for non-admins)
    try {
      const configData = await (configRes as Response).json()
      setInstructions(configData.config?.template_instructions ?? null)
      setTemplateDriveUrl(configData.config?.template_drive_url ?? null)
    } catch {}

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const hasCurrentMonth = reports.some(r => r.period_month === currentYearMonth())

  async function deleteReport() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    const res = await fetch(`/api/expense-reports/${deleteTarget.id}`, { method: 'DELETE' })
    if (res.ok) {
      setDeleteTarget(null)
      load()
    } else {
      const data = await res.json().catch(() => ({}))
      setDeleteError(data.error ?? 'Failed to delete report')
    }
    setDeleting(false)
  }

  async function createReport() {
    setCreating(true)
    setCreateError(null)
    const res = await fetch('/api/expense-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period_month: selectedMonth }),
    })
    const data = await res.json()
    if (res.ok && data.report?.drive_url) {
      window.open(data.report.drive_url, '_blank', 'noopener')
      setShowMonthPicker(false)
      load()
    } else if (res.status === 409 && data.report?.drive_url) {
      // Already exists — just open it
      window.open(data.report.drive_url, '_blank', 'noopener')
      setShowMonthPicker(false)
    } else {
      setCreateError(data.error ?? 'Failed to create expense report')
    }
    setCreating(false)
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <style>{`
        .er-table { width: 100%; border-collapse: collapse; }
        .er-table th { text-align: left; padding: 10px 14px; background: #f8f7ff; color: #6d28d9; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; border-bottom: 2px solid #ede9fe; }
        .er-table td { padding: 12px 14px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
        .er-table tr:last-child td { border-bottom: none; }
        .er-table tr:hover td { background: #faf5ff; }
        .btn-primary { background: #7c3aed; color: #fff; border: none; padding: 9px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .btn-primary:hover:not(:disabled) { background: #6d28d9; }
        .btn-primary:disabled { opacity: .6; cursor: not-allowed; }
        .btn-secondary { background: #ede9fe; color: #5b21b6; border: none; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .btn-secondary:hover { background: #ddd6fe; }
        .btn-sheets { background: #188038; color: #fff; border: none; padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; display: inline-block; }
        .btn-sheets:hover { background: #137333; }
        .btn-danger { background: #fee2e2; color: #dc2626; border: none; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .btn-danger:hover:not(:disabled) { background: #fecaca; }
        .btn-danger:disabled { opacity: .6; cursor: not-allowed; }
        .btn-danger-solid { background: #dc2626; color: #fff; border: none; padding: 9px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .btn-danger-solid:hover:not(:disabled) { background: #b91c1c; }
        .btn-danger-solid:disabled { opacity: .6; cursor: not-allowed; }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 50; display: flex; align-items: center; justify-content: center; }
        .modal { background: #fff; border-radius: 16px; padding: 32px; max-width: 440px; width: 90vw; box-shadow: 0 20px 60px rgba(0,0,0,.18); }
        .form-input { width: 100%; border: 1.5px solid #d1d5db; border-radius: 8px; padding: 8px 12px; font-size: 14px; box-sizing: border-box; }
        .form-input:focus { outline: none; border-color: #7c3aed; }
        .callout-amber { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 10px; padding: 14px 18px; color: #78350f; font-size: 14px; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#1e1b4b' }}>Expense Reports</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
            Submit your monthly expense reports for review.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {templateDriveUrl && (
            <a href={templateDriveUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <button className="btn-secondary">📄 View Template</button>
            </a>
          )}
          <button className="btn-primary" onClick={() => setShowMonthPicker(true)}>
            + Create Expense Report
          </button>
        </div>
      </div>

      {instructions && (
        <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: '14px 18px', marginBottom: 24, fontSize: 14, color: '#4c1d95', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
          <strong style={{ display: 'block', marginBottom: 4 }}>Instructions</strong>
          {instructions}
        </div>
      )}

      {!hasCurrentMonth && !loading && (
        <div className="callout-amber" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <span>You haven't created an expense report for <strong>{formatMonth(currentYearMonth())}</strong> yet.</span>
          <button className="btn-primary" style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => { setSelectedMonth(currentYearMonth()); setShowMonthPicker(true) }}>
            Create now →
          </button>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e9d5ff', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>Loading…</p>
        ) : reports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
            <p style={{ fontSize: 16, margin: 0 }}>No expense reports yet.</p>
            <p style={{ fontSize: 14, margin: '8px 0 0' }}>Click <strong>Create Expense Report</strong> to get started.</p>
          </div>
        ) : (
          <table className="er-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Status</th>
                <th>Reviewer Note</th>
                <th>Last Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600, color: '#1e1b4b' }}>{formatMonth(r.period_month)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td style={{ fontSize: 13, color: '#6b7280', maxWidth: 260 }}>
                    {r.reviewer_comment ? (
                      <span style={{ fontStyle: 'italic' }}>&ldquo;{r.reviewer_comment}&rdquo;</span>
                    ) : '—'}
                  </td>
                  <td style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>{formatDate(r.updated_at)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {r.drive_url && (
                        <a href={r.drive_url} target="_blank" rel="noopener noreferrer" className="btn-sheets">
                          Open in Sheets ↗
                        </a>
                      )}
                      <Link href={`/expense-reports/${r.id}`} style={{ textDecoration: 'none' }}>
                        <button className="btn-secondary">Details</button>
                      </Link>
                      {r.status === 'draft' && (
                        <button className="btn-danger" onClick={() => { setDeleteTarget(r); setDeleteError(null) }}>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) { setDeleteTarget(null); setDeleteError(null) } }}>
          <div className="modal">
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#1e1b4b' }}>Delete Expense Report?</h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>
              Are you sure you want to delete your <strong>{formatMonth(deleteTarget.period_month)}</strong> expense report? This cannot be undone.
            </p>
            {deleteError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 14, marginBottom: 16 }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" disabled={deleting} onClick={() => { setDeleteTarget(null); setDeleteError(null) }}>Cancel</button>
              <button className="btn-danger-solid" disabled={deleting} onClick={deleteReport}>
                {deleting ? 'Deleting…' : 'Delete Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showMonthPicker && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowMonthPicker(false) }}>
          <div className="modal">
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#1e1b4b' }}>Create Expense Report</h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>
              A copy of the expense report template will be created in Google Sheets and shared with you and the reviewer. Fill it out, then use the <strong>Arc Expense Report</strong> menu inside the sheet to submit for review.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Month</label>
              <input
                type="month"
                className="form-input"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
              />
            </div>
            {createError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 14, marginBottom: 16 }}>
                {createError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => { setShowMonthPicker(false); setCreateError(null) }}>Cancel</button>
              <button className="btn-primary" disabled={creating || !selectedMonth} onClick={createReport}>
                {creating ? 'Creating…' : `Create for ${selectedMonth ? formatMonth(selectedMonth) : '—'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
