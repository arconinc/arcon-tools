'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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

const STEPS = [
  {
    num: 1,
    icon: '📋',
    title: 'Create',
    detail: 'Click "+ New Expense Report" and pick the month.',
  },
  {
    num: 2,
    icon: '✏️',
    title: 'Add Expenses',
    detail: 'Fill in date, vendor, category, and amount for each item. Import from Expensify CSV if you prefer.',
  },
  {
    num: 3,
    icon: '📎',
    title: 'Attach Receipts',
    detail: 'Upload receipt photos or PDFs — stored privately and linked to your report.',
  },
  {
    num: 4,
    icon: '📤',
    title: 'Submit',
    detail: 'Click "Submit for Review." Your reviewer is notified automatically.',
  },
  {
    num: 5,
    icon: '💬',
    title: 'Respond',
    detail: 'If changes are requested, make corrections and resubmit. Your reviewer can comment on individual items.',
  },
  {
    num: 6,
    icon: '✅',
    title: 'Done',
    detail: 'Once approved, your report moves to "Submitted to Payroll." No further action needed.',
  },
]

function HowItWorks({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <div style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #f0f9ff 100%)', border: '1px solid #e9d5ff', borderRadius: 14, marginBottom: 24, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', background: 'none', border: 'none', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: 8 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>💡</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#4c1d95' }}>How It Works</span>
          <span style={{ fontSize: 12, color: '#7c3aed', background: '#ede9fe', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>Due by the 5th</span>
        </div>
        <span style={{ color: '#7c3aed', fontSize: 14, fontWeight: 700, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s', display: 'inline-block' }}>▾</span>
      </button>

      {expanded && (
        <div style={{ padding: '0 18px 18px' }}>
          <div className="steps-grid">
            {STEPS.map(step => (
              <div key={step.num} className="step-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                    color: '#fff', fontSize: 11, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, boxShadow: '0 2px 6px rgba(124,58,237,.3)',
                  }}>
                    {step.num}
                  </div>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>{step.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b' }}>{step.title}</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.55 }}>{step.detail}</p>
              </div>
            ))}
          </div>
          <p style={{ margin: '14px 0 0', fontSize: 12, color: '#7c3aed', textAlign: 'center', fontWeight: 500 }}>
            Reports are due by the <strong>5th of the following month</strong>. Contact HR with questions.
          </p>
        </div>
      )}
    </div>
  )
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
  const router = useRouter()
  const [reports, setReports] = useState<ExpenseReport[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth())
  const [deleteTarget, setDeleteTarget] = useState<ExpenseReport | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [howItWorksOpen, setHowItWorksOpen] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; right: number } | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/expense-reports')
    const data = await res.json()
    setReports(data.reports ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const hasActiveCurrentMonth = reports.some(r => r.period_month === currentYearMonth())

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
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>
      <style>{`
        .er-card { background: #fff; border: 1px solid #e9d5ff; border-radius: 14px; overflow: hidden; }
        .er-table { width: 100%; border-collapse: collapse; }
        .er-table th { text-align: left; padding: 10px 16px; background: #f8f7ff; color: #6d28d9; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; border-bottom: 2px solid #ede9fe; white-space: nowrap; }
        .er-table td { padding: 14px 16px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
        .er-table tr:last-child td { border-bottom: none; }
        .er-table tr:hover td { background: #faf5ff; }
        .er-table tbody tr { cursor: pointer; }
        .er-month { font-weight: 700; color: #1e1b4b; font-size: 15px; }
        .er-meta { font-size: 12px; color: #9ca3af; margin-top: 2px; }
        .er-actions { display: flex; gap: 8px; align-items: center; }
        .btn-primary { background: #7c3aed; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background .15s; }
        .btn-primary:hover:not(:disabled) { background: #6d28d9; }
        .btn-primary:disabled { opacity: .6; cursor: not-allowed; }
        .btn-secondary { background: #ede9fe; color: #5b21b6; border: none; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background .15s; }
        .btn-secondary:hover { background: #ddd6fe; }
        .btn-danger { background: #fee2e2; color: #dc2626; border: none; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background .15s; }
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
        .steps-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
        .step-card { background: rgba(255,255,255,.85); border: 1px solid #e9d5ff; border-radius: 10px; padding: 12px; }
        @media (max-width: 860px) { .steps-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 520px) { .steps-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 639px) {
          .er-table th.hide-mobile, .er-table td.hide-mobile { display: none; }
          .er-actions-desktop { display: none; }
          .er-actions-mobile { display: flex; }
        }
        @media (min-width: 640px) {
          .er-actions-desktop { display: flex; }
          .er-actions-mobile { display: none; }
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

      <HowItWorks expanded={howItWorksOpen} onToggle={() => setHowItWorksOpen(v => !v)} />

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
          <table className="er-table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="hide-mobile">Items</th>
                <th className="hide-mobile">Total</th>
                <th>Status</th>
                <th className="hide-mobile">Updated</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(r => {
                const isComplete = r.status === 'approved' || r.status === 'submitted_to_payroll'
                return (
                  <tr key={r.id} onClick={() => router.push(`/expense-reports/${r.id}`)}>
                    <td>
                      <div className="er-month">{formatMonth(r.period_month)}</div>
                      {r.reviewer_comment && (
                        <div style={{ marginTop: 4, fontSize: 12, color: '#92400e', fontStyle: 'italic', background: '#fef3c7', padding: '3px 8px', borderRadius: 5, display: 'inline-block' }}>
                          &ldquo;{r.reviewer_comment}&rdquo;
                        </div>
                      )}
                    </td>
                    <td className="hide-mobile" style={{ color: '#6b7280', fontSize: 13 }}>
                      {(r.line_item_count ?? 0) > 0 ? r.line_item_count : '—'}
                    </td>
                    <td className="hide-mobile" style={{ fontWeight: 500, color: '#1e1b4b', fontSize: 13 }}>
                      {(r.total_original ?? 0) > 0 ? formatCurrency(r.total_original ?? 0) : '—'}
                    </td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="hide-mobile" style={{ fontSize: 13, color: '#9ca3af' }}>{formatDate(r.updated_at)}</td>
                    <td>
                      {/* Desktop */}
                      <div className="er-actions er-actions-desktop" style={{ justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                        {!isComplete && (
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
                      {/* Mobile dropdown */}
                      <div className="er-actions-mobile" style={{ justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                        {openMenuId === r.id && (
                          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => { setOpenMenuId(null); setMenuAnchor(null) }} />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (openMenuId === r.id) { setOpenMenuId(null); setMenuAnchor(null) }
                            else { const rect = e.currentTarget.getBoundingClientRect(); setMenuAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right }); setOpenMenuId(r.id) }
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: '2px 8px', color: '#9ca3af', borderRadius: 6, lineHeight: 1 }}
                        >
                          ···
                        </button>
                        {openMenuId === r.id && menuAnchor && (
                          <div style={{ position: 'fixed', top: menuAnchor.top, right: menuAnchor.right, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 140, padding: '4px 0' }}>
                            {!isComplete && (
                              <Link href={`/expense-reports/${r.id}/edit`} style={{ textDecoration: 'none' }}>
                                <button onClick={() => { setOpenMenuId(null); setMenuAnchor(null) }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: '#7c3aed', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>
                                  ✏️ Edit
                                </button>
                              </Link>
                            )}
                            <Link href={`/expense-reports/${r.id}`} style={{ textDecoration: 'none' }}>
                              <button onClick={() => { setOpenMenuId(null); setMenuAnchor(null) }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>
                                👁 View
                              </button>
                            </Link>
                            {r.status === 'draft' && (
                              <button
                                onClick={() => { setOpenMenuId(null); setMenuAnchor(null); setDeleteTarget(r); setDeleteError(null) }}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: '#dc2626', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}
                              >
                                🗑 Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
