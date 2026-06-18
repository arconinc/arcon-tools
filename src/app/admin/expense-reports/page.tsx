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

function formatCurrency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  draft:                { label: 'In Progress',          bg: '#f3f4f6', color: '#374151' },
  submitted:            { label: 'Needs Review',         bg: '#ede9fe', color: '#6d28d9' },
  needs_changes:        { label: 'Awaiting Changes',     bg: '#fef3c7', color: '#92400e' },
  approved:             { label: 'Approved',             bg: '#dcfce7', color: '#166534' },
  submitted_to_payroll: { label: 'Submitted to Payroll', bg: '#fce7f3', color: '#9f1239' },
}

const STAT_CARDS: { key: string; subtitle: (reports: ExpenseReport[], count: number) => string }[] = [
  { key: 'submitted',            subtitle: (reports) => { const total = reports.filter(r => r.status === 'submitted').reduce((s, r) => s + (r.total_original ?? 0), 0); return total > 0 ? `${formatCurrency(total)} pending` : 'No pending reports' } },
  { key: 'needs_changes',        subtitle: (_, count) => count === 1 ? 'Sent back to employee' : 'Sent back to employees' },
  { key: 'approved',             subtitle: () => 'Ready for payroll' },
  { key: 'submitted_to_payroll', subtitle: () => 'Completed' },
]

function StatusBadge({ status }: { status: string }) {
  const { label, bg, color } = STATUS_CONFIG[status] ?? { label: status, bg: '#f3f4f6', color: '#374151' }
  return <span style={{ background: bg, color, padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
}

export default function AdminExpenseReportsPage() {
  const [reports, setReports] = useState<ExpenseReport[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')

  async function loadReports() {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (monthFilter) params.set('month', monthFilter)
    const res = await fetch(`/api/admin/expense-reports?${params}`)
    const data = await res.json()
    setReports(data.reports ?? [])
    setLoading(false)
  }

  useEffect(() => { loadReports() }, [statusFilter, monthFilter])

  const counts = Object.fromEntries(
    Object.keys(STATUS_CONFIG).map(s => [s, reports.filter(r => r.status === s).length])
  )

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>
      <style>{`
        .er-table { width: 100%; border-collapse: collapse; }
        .er-table th { text-align: left; padding: 10px 14px; background: #f8f7ff; color: #6d28d9; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; border-bottom: 2px solid #ede9fe; }
        .er-table td { padding: 12px 14px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
        .er-table tr:last-child td { border-bottom: none; }
        .er-table tr:hover td { background: #faf5ff; }
        .btn-secondary { background: #ede9fe; color: #5b21b6; border: none; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .btn-secondary:hover:not(:disabled) { background: #ddd6fe; }
        .btn-secondary:disabled { opacity: .6; cursor: not-allowed; }
        .form-input { border: 1.5px solid #d1d5db; border-radius: 8px; padding: 8px 12px; font-size: 14px; box-sizing: border-box; }
        .form-input:focus { outline: none; border-color: #7c3aed; }
        .stat-card { border-radius: 14px; padding: 20px 22px; cursor: pointer; transition: box-shadow .15s, filter .15s; }
        .stat-card:hover { filter: brightness(.96); box-shadow: 0 2px 10px rgba(0,0,0,.08); }
      `}</style>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#1e1b4b' }}>Expense Report Approvals</h1>
        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>Review and action employee expense report submissions.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        {STAT_CARDS.map(({ key, subtitle }) => {
          const cfg = STATUS_CONFIG[key]
          const count = counts[key] ?? 0
          const isActive = statusFilter === key
          return (
            <div key={key} className="stat-card" style={{ background: cfg.bg, outline: isActive ? `2.5px solid ${cfg.color}` : 'none' }} onClick={() => setStatusFilter(isActive ? '' : key)}>
              <div style={{ fontSize: 32, fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{count}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: cfg.color, marginTop: 8 }}>{cfg.label}</div>
              <div style={{ fontSize: 12, color: cfg.color, opacity: .7, marginTop: 3 }}>{subtitle(reports, count)}</div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-input" style={{ minWidth: 180 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <input type="month" className="form-input" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} />
        {(statusFilter || monthFilter) && (
          <button className="btn-secondary" onClick={() => { setStatusFilter(''); setMonthFilter('') }}>Clear</button>
        )}
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>Loading…</p>
      ) : reports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>No expense reports found.</div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e9d5ff', borderRadius: 12, overflow: 'hidden' }}>
          <table className="er-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Month</th>
                <th>Status</th>
                <th>Items</th>
                <th>Total</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#1e1b4b' }}>{(r.submitter as { display_name: string } | null)?.display_name ?? '—'}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{(r.submitter as { email: string } | null)?.email}</div>
                  </td>
                  <td style={{ fontWeight: 600, color: '#374151' }}>{formatMonth(r.period_month)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td style={{ color: '#6b7280', fontSize: 13 }}>{r.line_item_count ?? 0}</td>
                  <td style={{ fontWeight: 500, color: '#1e1b4b', fontSize: 13 }}>
                    {(r.total_original ?? 0) > 0 ? formatCurrency(r.total_original ?? 0) : '—'}
                  </td>
                  <td style={{ fontSize: 13, color: '#6b7280' }}>{formatDate(r.updated_at)}</td>
                  <td>
                    <Link href={`/admin/expense-reports/${r.id}`} style={{ textDecoration: 'none' }}>
                      <button className="btn-secondary">Review</button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
