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

function formatCurrency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  draft:                 { label: 'In Progress',           bg: '#f3f4f6', color: '#374151' },
  submitted:             { label: 'Submitted',             bg: '#dbeafe', color: '#1d4ed8' },
  needs_changes:         { label: 'Changes Needed',        bg: '#fef3c7', color: '#92400e' },
  approved:              { label: 'Approved',              bg: '#dcfce7', color: '#166534' },
  submitted_to_payroll:  { label: 'Submitted to Payroll',  bg: '#ede9fe', color: '#5b21b6' },
}

function StatusBadge({ status }: { status: string }) {
  const { label, bg, color } = STATUS_CONFIG[status] ?? { label: status, bg: '#f3f4f6', color: '#374151' }
  return (
    <span style={{ background: bg, color, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

export default function ExpenseReportsPage() {
  const [reports, setReports] = useState<ExpenseReport[]>([])
  const [instructions, setInstructions] = useState<string | null>(null)
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
      fetch('/api/admin/expense-reports/config').catch(() => null),
    ])
    setReports(reportsRes.reports ?? [])
    try {
      const configData = configRes ? await (configRes as Response).json() : null
      setInstructions(configData?.config?.template_instructions ?? null)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const hasActiveCurrentMonth = reports.some(
    r => r.period_month === currentYearMonth() && r.status !== 'approved' && r.status !== 'submitted_to_payroll'
  )

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
    if (res.ok) {
      setShowMonthPicker(false)
      load()
      window.location.href = `/expense-reports/${data.report.id}/edit`
    } else if (res.status === 409 && data.existing?.id) {
      setShowMonthPicker(false)
      window.location.href = `/expense-reports/${data.existing.id}/edit`
    } else {
      setCreateError(data.error ?? 'Failed to create expense report')
    }
    setCreating(false)
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>
      <style>{`
        .er-card { background: #fff; border: 1px solid #e9d5ff; border-radius: 12px; overflow: hidden; }
        .er-row { padding: 16px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .er-row:last-child { border-bottom: none; }
        .er-row:hover { background: #faf5ff; }
        .er-month { font-weight: 700; color: #1e1b4b; font-size: 15px; flex: 1; min-width: 140px; }
        .er-meta { font-size: 12px; color: #9ca3af; }
        .er-total { font-size: 13px; color: #374151; font-weight: 500; white-space: nowrap; }
        .er-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; flex-wrap: wrap; }
        .btn-primary { background: #7c3aed; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .btn-primary:hover:not(:disabled) { background: #6d28d9; }
        .btn-primary:disabled { opacity: .6; cursor: not-allowed; }
        .btn-secondary { background: #ede9fe; color: #5b21b6; border: none; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .btn-secondary:hover { background: #ddd6fe; }
        .btn-danger { background: #fee2e2; color: #dc2626; border: none; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .btn-danger:hover:not(:disabled) { background: #fecaca; }
        .btn-danger-solid { background: #dc2626; color: #fff; border: none; padding: 9px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .btn-danger-solid:hover:not(:disabled) { background: #b91c1c; }
        .btn-danger-solid:disabled, .btn-danger:disabled { opacity: .6; cursor: not-allowed; }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 50; display: flex; align-items: flex-end; justify-content: center; padding-bottom: env(safe-area-inset-bottom); }
        @media (min-width: 640px) { .modal-backdrop { align-items: center; } }
        .modal { background: #fff; border-radius: 20px 20px 0 0; padding: 28px 24px 32px; width: 100%; max-width: 460px; box-shadow: 0 -4px 30px rgba(0,0,0,.12); }
        @media (min-width: 640px) { .modal { border-radius: 16px; padding: 32px; box-shadow: 0 20px 60px rgba(0,0,0,.18); } }
        .form-input { width: 100%; border: 1.5px solid #d1d5db; border-radius: 8px; padding: 10px 12px; font-size: 15px; box-sizing: border-box; }
        .form-input:focus { outline: none; border-color: #7c3aed; }
        @media (max-width: 639px) {
          .er-table-row { display: none; }
          .er-row { flex-direction: column; align-items: flex-start; gap: 8px; }
          .er-actions { width: 100%; }
          .er-actions a, .er-actions button { flex: 1; text-align: center; justify-content: center; }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#1e1b4b' }}>Expense Reports</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
            Track and submit your monthly expense reports.
          </p>
        </div>
        <button className="btn-primary" onClick={() => { setSelectedMonth(currentYearMonth()); setShowMonthPicker(true) }}>
          + New Expense Report
        </button>
      </div>

      {instructions && (
        <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: '14px 18px', marginBottom: 24, fontSize: 14, color: '#4c1d95', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
          <strong style={{ display: 'block', marginBottom: 4 }}>Instructions</strong>
          {instructions}
        </div>
      )}

      {!hasActiveCurrentMonth && !loading && (
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, fontSize: 14, color: '#78350f' }}>
          <span>No active report for <strong>{formatMonth(currentYearMonth())}</strong> yet.</span>
          <button className="btn-primary" style={{ fontSize: 13, padding: '7px 14px' }} onClick={() => { setSelectedMonth(currentYearMonth()); setShowMonthPicker(true) }}>
            Start one →
          </button>
        </div>
      )}

      <div className="er-card">
        {loading ? (
          <p style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>Loading…</p>
        ) : reports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: '#9ca3af' }}>
            <p style={{ fontSize: 16, margin: 0 }}>No expense reports yet.</p>
            <p style={{ fontSize: 14, margin: '8px 0 0' }}>Click <strong>+ New Expense Report</strong> to get started.</p>
          </div>
        ) : (
          reports.map(r => (
            <div key={r.id} className="er-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span className="er-month">{formatMonth(r.period_month)}</span>
                  <StatusBadge status={r.status} />
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {(r.line_item_count ?? 0) > 0 && (
                    <span className="er-total">
                      {r.line_item_count} item{r.line_item_count === 1 ? '' : 's'}
                      {(r.total_original ?? 0) > 0 && ` · ${formatCurrency(r.total_original ?? 0)}`}
                    </span>
                  )}
                  <span className="er-meta">Updated {formatDate(r.updated_at)}</span>
                </div>
                {r.reviewer_comment && (
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: '#92400e', fontStyle: 'italic', background: '#fef3c7', padding: '4px 10px', borderRadius: 6, display: 'inline-block' }}>
                    &ldquo;{r.reviewer_comment}&rdquo;
                  </p>
                )}
              </div>
              <div className="er-actions">
                {(r.status === 'draft' || r.status === 'needs_changes') && (
                  <Link href={`/expense-reports/${r.id}/edit`} style={{ textDecoration: 'none' }}>
                    <button className="btn-primary" style={{ fontSize: 13, padding: '7px 14px' }}>Edit</button>
                  </Link>
                )}
                <Link href={`/expense-reports/${r.id}`} style={{ textDecoration: 'none' }}>
                  <button className="btn-secondary">View</button>
                </Link>
                {r.status === 'draft' && (
                  <button className="btn-danger" onClick={() => { setDeleteTarget(r); setDeleteError(null) }}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) { setDeleteTarget(null); setDeleteError(null) } }}>
          <div className="modal">
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#1e1b4b' }}>Delete Expense Report?</h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>
              Delete your <strong>{formatMonth(deleteTarget.period_month)}</strong> expense report and all its data? This cannot be undone.
            </p>
            {deleteError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 14, marginBottom: 16 }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" disabled={deleting} onClick={() => { setDeleteTarget(null); setDeleteError(null) }}>Cancel</button>
              <button className="btn-danger-solid" disabled={deleting} onClick={deleteReport}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showMonthPicker && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) { setShowMonthPicker(false); setCreateError(null) } }}>
          <div className="modal">
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#1e1b4b' }}>New Expense Report</h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>
              Choose the month this report covers. You can add expense line items after creating it.
            </p>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Month</label>
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
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowMonthPicker(false); setCreateError(null) }}>Cancel</button>
              <button className="btn-primary" style={{ flex: 2 }} disabled={creating || !selectedMonth} onClick={createReport}>
                {creating ? 'Creating…' : `Create for ${selectedMonth ? formatMonth(selectedMonth) : '—'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
