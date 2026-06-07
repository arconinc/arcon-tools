'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { ExpenseReport } from '@/types'

interface UserOption { id: string; display_name: string; email: string }

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
  submitted:            { label: 'Submitted',            bg: '#dbeafe', color: '#1d4ed8' },
  needs_changes:        { label: 'Changes Needed',       bg: '#fef3c7', color: '#92400e' },
  approved:             { label: 'Approved',             bg: '#dcfce7', color: '#166534' },
  submitted_to_payroll: { label: 'Submitted to Payroll', bg: '#ede9fe', color: '#5b21b6' },
}

function StatusBadge({ status }: { status: string }) {
  const { label, bg, color } = STATUS_CONFIG[status] ?? { label: status, bg: '#f3f4f6', color: '#374151' }
  return <span style={{ background: bg, color, padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
}

export default function AdminExpenseReportsPage() {
  const [reports, setReports] = useState<ExpenseReport[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [tab, setTab] = useState<'reports' | 'config'>('reports')

  // Config
  const [config, setConfig] = useState<{
    reviewer_user_id: string | null
    template_instructions: string | null
    reviewer?: { id: string; display_name: string } | null
  } | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [configSuccess, setConfigSuccess] = useState(false)

  const [reviewerSearch, setReviewerSearch] = useState('')
  const [reviewerOptions, setReviewerOptions] = useState<UserOption[]>([])
  const [reviewerSearchLoading, setReviewerSearchLoading] = useState(false)
  const [instructions, setInstructions] = useState('')

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

  async function loadConfig() {
    setConfigLoading(true)
    const res = await fetch('/api/admin/expense-reports/config')
    const data = await res.json()
    if (data.config) {
      setConfig(data.config)
      setInstructions(data.config.template_instructions ?? '')
    }
    setConfigLoading(false)
  }

  useEffect(() => { loadReports() }, [statusFilter, monthFilter])
  useEffect(() => { loadConfig() }, [])

  async function searchReviewers(q: string) {
    if (!q.trim()) { setReviewerOptions([]); return }
    setReviewerSearchLoading(true)
    const res = await fetch(`/api/employees?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setReviewerOptions(Array.isArray(data) ? data : (data.employees ?? []))
    setReviewerSearchLoading(false)
  }

  useEffect(() => {
    const t = setTimeout(() => searchReviewers(reviewerSearch), 300)
    return () => clearTimeout(t)
  }, [reviewerSearch])

  async function saveConfig(updates: Record<string, unknown>) {
    setSavingConfig(true)
    setConfigError(null)
    setConfigSuccess(false)
    const res = await fetch('/api/admin/expense-reports/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) {
      const d = await res.json()
      setConfigError(d.error ?? 'Save failed')
    } else {
      setConfigSuccess(true)
      setTimeout(() => setConfigSuccess(false), 3000)
      loadConfig()
    }
    setSavingConfig(false)
  }

  const counts = Object.fromEntries(
    Object.keys(STATUS_CONFIG).map(s => [s, reports.filter(r => r.status === s).length])
  )

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 16px' }}>
      <style>{`
        .er-table { width: 100%; border-collapse: collapse; }
        .er-table th { text-align: left; padding: 10px 14px; background: #f8f7ff; color: #6d28d9; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; border-bottom: 2px solid #ede9fe; }
        .er-table td { padding: 12px 14px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
        .er-table tr:last-child td { border-bottom: none; }
        .er-table tr:hover td { background: #faf5ff; }
        .btn-primary { background: #7c3aed; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .btn-primary:hover:not(:disabled) { background: #6d28d9; }
        .btn-primary:disabled { opacity: .6; cursor: not-allowed; }
        .btn-secondary { background: #ede9fe; color: #5b21b6; border: none; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .btn-secondary:hover:not(:disabled) { background: #ddd6fe; }
        .btn-secondary:disabled { opacity: .6; cursor: not-allowed; }
        .form-input { width: 100%; border: 1.5px solid #d1d5db; border-radius: 8px; padding: 8px 12px; font-size: 14px; box-sizing: border-box; }
        .form-input:focus { outline: none; border-color: #7c3aed; }
        .form-label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 4px; }
        .form-hint { font-size: 12px; color: #9ca3af; margin: 4px 0 0; }
        .tab { padding: 8px 20px; border: none; background: none; font-size: 14px; font-weight: 600; cursor: pointer; border-bottom: 3px solid transparent; color: #6b7280; }
        .tab.active { color: #7c3aed; border-bottom-color: #7c3aed; }
        .stat-card { background: #fff; border: 1px solid #e9d5ff; border-radius: 12px; padding: 14px 18px; text-align: center; cursor: pointer; }
        .config-card { background: #fff; border: 1px solid #e9d5ff; border-radius: 12px; padding: 24px; }
      `}</style>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#1e1b4b' }}>Expense Report Approvals</h1>
        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>Review and action employee expense report submissions.</p>
      </div>

      <div style={{ display: 'flex', borderBottom: '2px solid #ede9fe', marginBottom: 24 }}>
        <button className={`tab ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>Reports</button>
        <button className={`tab ${tab === 'config' ? 'active' : ''}`} onClick={() => setTab('config')}>Configuration</button>
      </div>

      {tab === 'reports' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 24 }}>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <div key={key} className="stat-card" style={{ outline: statusFilter === key ? `2px solid ${cfg.color}` : 'none' }} onClick={() => setStatusFilter(statusFilter === key ? '' : key)}>
                <div style={{ fontSize: 24, fontWeight: 700, color: cfg.color }}>{counts[key] ?? 0}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{cfg.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="form-input" style={{ width: 'auto', minWidth: 180 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
            <input type="month" className="form-input" style={{ width: 'auto' }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)} />
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
        </>
      )}

      {tab === 'config' && (
        <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {configLoading ? (
            <p style={{ color: '#9ca3af' }}>Loading…</p>
          ) : (
            <>
              {configSuccess && (
                <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: '10px 16px', color: '#166534', fontSize: 14 }}>
                  ✓ Configuration saved.
                </div>
              )}
              {configError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 16px', color: '#dc2626', fontSize: 14 }}>
                  {configError}
                </div>
              )}

              {/* Reviewer */}
              <div className="config-card">
                <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#1e1b4b' }}>Reviewer</h3>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
                  This person is notified when expense reports are submitted and can review and approve them in The Arc.
                </p>
                {config?.reviewer && (
                  <div style={{ background: '#f5f3ff', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 14, color: '#4c1d95', fontWeight: 600 }}>
                    Current reviewer: {config.reviewer.display_name}
                    <button onClick={() => saveConfig({ reviewer_user_id: null })} style={{ marginLeft: 10, background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}>
                      ✕ Remove
                    </button>
                  </div>
                )}
                <label className="form-label">Search employees</label>
                <input type="text" className="form-input" placeholder="Type a name…" value={reviewerSearch} onChange={e => setReviewerSearch(e.target.value)} />
                {reviewerSearchLoading && <p style={{ fontSize: 13, color: '#9ca3af', margin: '4px 0 0' }}>Searching…</p>}
                {reviewerOptions.length > 0 && (
                  <div style={{ border: '1px solid #ddd6fe', borderRadius: 8, marginTop: 4, background: '#fff', overflow: 'hidden' }}>
                    {reviewerOptions.map(u => (
                      <button key={u.id} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f5f3ff')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        onClick={async () => { await saveConfig({ reviewer_user_id: u.id }); setReviewerSearch(''); setReviewerOptions([]) }}>
                        <strong>{u.display_name}</strong> <span style={{ color: '#9ca3af', fontSize: 12 }}>{u.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="config-card">
                <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#1e1b4b' }}>Instructions</h3>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>Shown to employees at the top of their Expense Reports page.</p>
                <textarea className="form-input" rows={5} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Enter instructions for filling out the expense report…" />
                <button className="btn-primary" style={{ marginTop: 10 }} disabled={savingConfig} onClick={() => saveConfig({ template_instructions: instructions })}>
                  {savingConfig ? 'Saving…' : 'Save Instructions'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
