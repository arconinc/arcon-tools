'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type SpecListItem = {
  id: string
  customer_name: string | null
  contact_name: string | null
  item_name: string
  vendor: string | null
  status: string
  date_sent: string | null
  csr_name: string | null
  follow_up_date: string | null
  item_image_url: string | null
}

type Stats = {
  sent_this_month: number
  pending_follow_ups: number
  in_production: number
  awaiting_response: number
}

type ProactiveCustomer = {
  id: string
  customer_name: string | null
  follow_up_date: string | null
  item_name: string
  item_image_url: string | null
  vendor: string | null
}

const STATUS_LABELS: Record<string, string> = {
  not_contacted: 'Not Contacted',
  ordered: 'Ordered',
  in_production: 'In Production',
  shipped: 'Shipped',
  delivered: 'Delivered',
  approved: 'Approved',
  declined: 'Declined',
  no_response: 'No Response',
}

const STATUS_COLORS: Record<string, string> = {
  not_contacted: 'bg-slate-100 text-slate-600',
  ordered: 'bg-blue-100 text-blue-700',
  in_production: 'bg-yellow-100 text-yellow-700',
  shipped: 'bg-orange-100 text-orange-700',
  delivered: 'bg-indigo-100 text-indigo-700',
  approved: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  no_response: 'bg-pink-100 text-pink-700',
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function relDate(d: string | null) {
  if (!d) return null
  const diff = Math.round((new Date(d).getTime() - Date.now()) / 86400000)
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  if (diff === 0) return 'Due today'
  return `Due in ${diff}d`
}

const PAGE_SIZE = 50

export default function SpecSamplesDashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'log' | 'proactive'>('log')
  const [stats, setStats] = useState<Stats | null>(null)
  const [specs, setSpecs] = useState<SpecListItem[]>([])
  const [proactive, setProactive] = useState<ProactiveCustomer[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  // Filters
  const [month, setMonth] = useState('')
  const [csrFilter, setCsrFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [vendorFilter, setVendorFilter] = useState('')

  useEffect(() => {
    fetch('/api/marketing/specs/stats').then(r => r.json()).then(setStats)
  }, [])

  const fetchSpecs = useCallback(async (currentPage: number) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (month) params.set('month', month)
    if (csrFilter) params.set('csr_id', csrFilter)
    if (statusFilter) params.set('status', statusFilter)
    if (vendorFilter) params.set('vendor', vendorFilter)
    params.set('page', String(currentPage))
    params.set('limit', String(PAGE_SIZE))
    try {
      const res = await fetch(`/api/marketing/specs?${params}`)
      const data = await res.json()
      setSpecs(Array.isArray(data.specs) ? data.specs : [])
      setTotal(typeof data.total === 'number' ? data.total : 0)
    } finally {
      setLoading(false)
    }
  }, [month, csrFilter, statusFilter, vendorFilter])

  const fetchProactive = useCallback(async () => {
    const res = await fetch('/api/marketing/specs?status=not_contacted&limit=100')
    const data = await res.json()
    setProactive(Array.isArray(data.specs) ? data.specs : [])
  }, [])

  useEffect(() => { setPage(1) }, [month, csrFilter, statusFilter, vendorFilter])

  useEffect(() => {
    const t = setTimeout(() => fetchSpecs(page), 200)
    return () => clearTimeout(t)
  }, [fetchSpecs, page])

  useEffect(() => {
    if (activeTab === 'proactive') fetchProactive()
  }, [activeTab, fetchProactive])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div style={{ padding: '32px', maxWidth: '100%' }}>
      <style>{`
        .stat-card { background: white; border: 1px solid #e8e4f3; border-radius: 16px; padding: 22px 24px; flex: 1; min-width: 200px; display: flex; align-items: center; gap: 18px; }
        .stat-icon { width: 52px; height: 52px; border-radius: 50%; background: #ede9f8; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .stat-body { display: flex; flex-direction: column; gap: 2px; }
        .stat-label { font-size: 13px; color: #6b7280; font-weight: 500; margin-bottom: 2px; }
        .stat-value { font-size: 36px; font-weight: 800; color: #111827; line-height: 1; }
        .tab-btn { padding: 8px 20px; font-weight: 500; font-size: 14px; cursor: pointer; border: none; border-bottom: 2px solid transparent; margin-bottom: -1px; background: transparent; transition: all .15s; }
        .tab-active { color: #7c3aed; font-weight: 700; border-bottom-color: #7c3aed; }
        .tab-inactive { color: #64748b; }
        .tab-inactive:hover { color: #1e293b; }
        .filter-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
        .filter-input { border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 12px; font-size: 14px; color: #1e293b; background: white; outline: none; }
        .filter-input:focus { border-color: #7c3aed; }
        .specs-table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
        .specs-table th { background: #f8fafc; padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
        .specs-table td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; vertical-align: middle; }
        .specs-table tr:last-child td { border-bottom: none; }
        .specs-table tr:hover td { background: #fafbff; }
        .spec-item-img { width: 36px; height: 36px; border-radius: 6px; object-fit: cover; background: #f1f5f9; flex-shrink: 0; }
        .action-link { color: #7c3aed; font-size: 13px; font-weight: 500; text-decoration: none; }
        .action-link:hover { text-decoration: underline; }
        .followup-badge { font-size: 12px; font-weight: 600; }
        .followup-overdue { color: #dc2626; }
        .followup-today { color: #d97706; }
        .followup-soon { color: #64748b; }
        .proactive-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
        .proactive-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; gap: 14px; align-items: flex-start; }
        .proactive-img { width: 60px; height: 60px; border-radius: 8px; object-fit: cover; background: #f1f5f9; flex-shrink: 0; }
        .proactive-name { font-weight: 600; color: #1e293b; font-size: 15px; margin-bottom: 2px; }
        .proactive-item { font-size: 13px; color: #64748b; margin-bottom: 8px; }
        .btn-send { background: #7c3aed; color: white; border: none; border-radius: 7px; padding: 6px 14px; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; display: inline-block; }
        .btn-send:hover { background: #6d28d9; }
        .pagination { display: flex; align-items: center; gap: 8px; justify-content: flex-end; margin-top: 16px; }
        .pg-btn { border: 1px solid #e2e8f0; background: white; color: #374151; border-radius: 7px; padding: 6px 12px; font-size: 14px; cursor: pointer; }
        .pg-btn:hover:not(:disabled) { background: #f8fafc; }
        .pg-btn:disabled { opacity: .45; cursor: default; }
        .pg-active { background: #7c3aed; color: white; border-color: #7c3aed; }
        .empty-state { text-align: center; padding: 48px 24px; color: #94a3b8; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#1e293b', margin: 0 }}>Spec Samples</h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: 4 }}>Track and manage spec samples sent to customers</p>
        </div>
        <Link href="/marketing/specs/new" style={{ background: '#7c3aed', color: 'white', padding: '10px 20px', borderRadius: '9px', fontWeight: 600, fontSize: '14px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>+</span> New Spec
        </Link>
      </div>

      {/* Stats Bar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '28px', flexWrap: 'wrap' }}>
        <div className="stat-card">
          <div className="stat-icon">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#7c3aed" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          </div>
          <div className="stat-body">
            <div className="stat-label">Specs Sent This Month</div>
            <div className="stat-value">{stats?.sent_this_month ?? '—'}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#7c3aed" strokeWidth={1.8}><circle cx="12" cy="12" r="9"/><path strokeLinecap="round" d="M12 7v5l3 2"/><circle cx="17" cy="17" r="4" fill="white" stroke="#7c3aed" strokeWidth={1.8}/><path strokeLinecap="round" d="M17 15.5v1.5l1 1"/></svg>
          </div>
          <div className="stat-body">
            <div className="stat-label">Pending Follow-Ups</div>
            <div className="stat-value">{stats?.pending_follow_ups ?? '—'}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#7c3aed" strokeWidth={1.8}><rect x="2" y="7" width="20" height="14" rx="2"/><path strokeLinecap="round" d="M6 7V5a2 2 0 012-2h8a2 2 0 012 2v2M9 11h.01M12 11h.01M15 11h.01M9 14h.01M12 14h.01M15 14h.01"/></svg>
          </div>
          <div className="stat-body">
            <div className="stat-label">In Production</div>
            <div className="stat-value">{stats?.in_production ?? '—'}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#7c3aed" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          </div>
          <div className="stat-body">
            <div className="stat-label">Awaiting Response</div>
            <div className="stat-value">{stats?.awaiting_response ?? '—'}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', marginBottom: '20px', borderBottom: '1px solid #e2e8f0' }}>
        <button className={`tab-btn ${activeTab === 'log' ? 'tab-active' : 'tab-inactive'}`} onClick={() => setActiveTab('log')}>Master Log</button>
        <button className={`tab-btn ${activeTab === 'proactive' ? 'tab-active' : 'tab-inactive'}`} onClick={() => setActiveTab('proactive')}>Proactive Tracker</button>
      </div>

      {activeTab === 'log' && (
        <>
          {/* Filters */}
          <div className="filter-row">
            <input
              type="month"
              className="filter-input"
              value={month}
              onChange={e => setMonth(e.target.value)}
              style={{ width: 160 }}
            />
            <select className="filter-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input
              className="filter-input"
              placeholder="Search vendor..."
              value={vendorFilter}
              onChange={e => setVendorFilter(e.target.value)}
              style={{ width: 180 }}
            />
            <span style={{ color: '#94a3b8', fontSize: 13 }}>{total} spec{total !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <div className="empty-state">Loading…</div>
          ) : specs.length === 0 ? (
            <div className="empty-state">
              <p style={{ marginBottom: 12 }}>No specs found for these filters.</p>
              <Link href="/marketing/specs/new" className="btn-send">Create First Spec</Link>
            </div>
          ) : (
            <>
              <table className="specs-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Customer</th>
                    <th>Contact</th>
                    <th>Vendor</th>
                    <th>Status</th>
                    <th>Date Sent</th>
                    <th>CSR</th>
                    <th>Follow-up</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {specs.map(spec => {
                    const rel = relDate(spec.follow_up_date)
                    const isOverdue = rel?.includes('overdue')
                    const isToday = rel === 'Due today'
                    return (
                      <tr key={spec.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/marketing/specs/${spec.id}`)}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {spec.item_image_url ? (
                              <img src={spec.item_image_url} alt="" className="spec-item-img" />
                            ) : (
                              <div className="spec-item-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#cbd5e1" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path strokeLinecap="round" d="M21 15l-5-5L5 21"/></svg>
                              </div>
                            )}
                            <span style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{spec.item_name}</span>
                          </div>
                        </td>
                        <td>{spec.customer_name ?? <span style={{ color: '#94a3b8' }}>—</span>}</td>
                        <td style={{ color: '#64748b' }}>{spec.contact_name ?? '—'}</td>
                        <td style={{ color: '#64748b' }}>{spec.vendor ?? '—'}</td>
                        <td><StatusPill status={spec.status} /></td>
                        <td style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(spec.date_sent)}</td>
                        <td style={{ color: '#64748b' }}>{spec.csr_name ?? '—'}</td>
                        <td>
                          {spec.follow_up_date ? (
                            <div>
                              <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>{fmtDate(spec.follow_up_date)}</div>
                              {rel && (
                                <div className={`followup-badge ${isOverdue ? 'followup-overdue' : isToday ? 'followup-today' : 'followup-soon'}`}>{rel}</div>
                              )}
                            </div>
                          ) : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <Link href={`/marketing/specs/${spec.id}`} className="action-link">View</Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className="pagination">
                  <button className="pg-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>←</button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const p = i + 1
                    return (
                      <button key={p} className={`pg-btn ${page === p ? 'pg-active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                    )
                  })}
                  {totalPages > 5 && page < totalPages && <span style={{ color: '#94a3b8' }}>…</span>}
                  <button className="pg-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>→</button>
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>Page {page} of {totalPages}</span>
                </div>
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'proactive' && (
        <>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
            Customers with spec samples in "Not Contacted" status — ready for outreach.
          </p>
          {proactive.length === 0 ? (
            <div className="empty-state">No customers pending outreach.</div>
          ) : (
            <div className="proactive-grid">
              {proactive.map(item => (
                <div key={item.id} className="proactive-card">
                  {item.item_image_url ? (
                    <img src={item.item_image_url} alt="" className="proactive-img" />
                  ) : (
                    <div className="proactive-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }}>
                      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#cbd5e1" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path strokeLinecap="round" d="M21 15l-5-5L5 21"/></svg>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="proactive-name">{item.customer_name ?? 'Unknown Customer'}</div>
                    <div className="proactive-item">{item.item_name}{item.vendor ? ` · ${item.vendor}` : ''}</div>
                    <Link href={`/marketing/specs/${item.id}`} className="btn-send">View Spec</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
