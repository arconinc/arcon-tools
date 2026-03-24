'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const PAGE_SIZE = 50

type TagOption = { id: string; name: string; color: string }

type OppListItem = {
  id: string
  name: string
  customer_id: string
  customer_name: string | null
  assigned_to: string | null
  assigned_user_name: string | null
  pipeline_stage: string | null
  value: number | null
  probability: number | null
  status: 'open' | 'won' | 'lost' | 'stalled'
  forecast_close_date: string | null
  created_at: string
  updated_at: string
  tags: TagOption[]
}

const STAGES = ['Send Quote', 'Follow Up on Quote', 'Quote Accepted', 'Send Thank You Email']

function PipelineMini({ stage, status }: { stage: string | null; status: string }) {
  const isClosed = status === 'won' || status === 'lost'
  const currentIdx = stage ? STAGES.indexOf(stage) : -1

  return (
    <div className="flex items-center gap-0 min-w-[180px]">
      {STAGES.map((s, idx) => {
        const isActive = s === stage
        const isPast = currentIdx > idx
        const segColor = isClosed
          ? status === 'won'
            ? 'bg-green-100 text-green-700'
            : 'bg-red-50 text-red-400'
          : isActive
          ? 'bg-purple-700 text-white'
          : isPast
          ? 'bg-purple-100 text-purple-600'
          : 'bg-slate-100 text-slate-400'
        const arrowColor = isClosed
          ? status === 'won'
            ? 'border-l-green-100'
            : 'border-l-red-50'
          : isActive
          ? 'border-l-purple-700'
          : isPast
          ? 'border-l-purple-100'
          : 'border-l-slate-100'

        return (
          <div key={s} className="flex items-center flex-1 min-w-0">
            <div
              title={s}
              className={`flex-1 py-1 text-[10px] font-medium text-center truncate ${segColor} ${idx === 0 ? 'rounded-l' : ''} ${idx === STAGES.length - 1 ? 'rounded-r' : ''}`}
            />
            {idx < STAGES.length - 1 && (
              <div className={`w-0 h-0 border-t-[10px] border-b-[10px] border-l-[7px] border-t-transparent border-b-transparent z-10 -mx-px flex-shrink-0 ${arrowColor}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-700',
  stalled: 'bg-slate-100 text-slate-600',
}

function fmt$(val: number | null) {
  if (val == null) return '—'
  return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 0 })
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isOverdue(iso: string | null) {
  if (!iso) return false
  return new Date(iso) < new Date()
}

export default function OpportunitiesPage() {
  const router = useRouter()
  const [rawOpps, setRawOpps] = useState<OppListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [allTags, setAllTags] = useState<TagOption[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetch('/api/crm/tags').then((r) => r.json()).then((d) => { if (Array.isArray(d)) setAllTags(d) })
  }, [])

  const fetchOpps = useCallback(async (currentPage: number) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (stageFilter) params.set('stage', stageFilter)
    if (tagFilter) params.set('tag_id', tagFilter)
    params.set('page', String(currentPage))
    params.set('limit', String(PAGE_SIZE))
    try {
      const res = await fetch(`/api/crm/opportunities?${params}`)
      const data = await res.json()
      setRawOpps(Array.isArray(data.items) ? data.items : [])
      setTotal(typeof data.total === 'number' ? data.total : 0)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, stageFilter, tagFilter])

  // Reset to page 1 on server-side filter change
  useEffect(() => { setPage(1) }, [statusFilter, stageFilter, tagFilter])

  useEffect(() => {
    fetchOpps(page)
  }, [fetchOpps, page])

  const opps = (() => {
    let items = rawOpps
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          (o.customer_name ?? '').toLowerCase().includes(q)
      )
    }
    if (ownerFilter) {
      items = items.filter((o) => o.assigned_to === ownerFilter)
    }
    return items
  })()

  const ownerOptions = (() => {
    const seen = new Map<string, string>()
    for (const o of rawOpps) {
      if (o.assigned_to && !seen.has(o.assigned_to)) {
        seen.set(o.assigned_to, o.assigned_user_name ?? o.assigned_to)
      }
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  })()

  const openCount = opps.filter((o) => o.status === 'open').length
  const openValue = opps
    .filter((o) => o.status === 'open' && o.value != null)
    .reduce((s, o) => s + (o.value ?? 0), 0)

  const activeFilters = !!(search || statusFilter || stageFilter || ownerFilter || tagFilter)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeTo = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="w-full px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Opportunities</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track deals and pipeline progress</p>
        </div>
        <button
          onClick={() => router.push('/crm/opportunities/new')}
          className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Opportunity
        </button>
      </div>

      {/* Pipeline summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Open Pipeline</div>
          <div className="text-2xl font-bold text-slate-900">{fmt$(openValue)}</div>
          <div className="text-xs text-slate-400 mt-0.5">{openCount} open opportunit{openCount !== 1 ? 'ies' : 'y'}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Won (This View)</div>
          <div className="text-2xl font-bold text-green-700">
            {fmt$(opps.filter((o) => o.status === 'won').reduce((s, o) => s + (o.value ?? 0), 0))}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">{opps.filter((o) => o.status === 'won').length} won</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" strokeWidth={2} />
            <path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or customer…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
          <option value="stalled">Stalled</option>
        </select>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          <option value="">All Stages</option>
          {STAGES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          <option value="">All Owners</option>
          {ownerOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        {allTags.length > 0 && (
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <option value="">All Tags</option>
            {allTags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Customer</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Value</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Pipeline</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden xl:table-cell">Tags</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden xl:table-cell">Forecast Close</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden xl:table-cell">Owner</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {[...Array(8)].map((_, j) => (
                  <td key={j} className="px-5 py-3.5">
                    <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: j === 0 ? '60%' : '40%' }} />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && opps.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-sm text-slate-400">
                  {activeFilters
                    ? 'No opportunities match your filters.'
                    : 'No opportunities yet. Create one to get started.'}
                </td>
              </tr>
            )}
            {!loading && opps.map((o) => (
              <tr
                key={o.id}
                onClick={() => router.push(`/crm/opportunities/${o.id}`)}
                className="hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <td className="px-5 py-3.5 font-medium text-slate-900">{o.name}</td>
                <td className="px-5 py-3.5 text-slate-600 hidden md:table-cell">{o.customer_name ?? '—'}</td>
                <td className="px-5 py-3.5 font-semibold text-slate-700">{fmt$(o.value)}</td>
                <td className="px-5 py-3.5 hidden lg:table-cell">
                  <PipelineMini stage={o.pipeline_stage} status={o.status} />
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize ${STATUS_BADGE[o.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {o.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 hidden xl:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {o.tags.length > 0
                      ? o.tags.map((t) => (
                          <span key={t.id} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold text-white" style={{ backgroundColor: t.color }}>
                            {t.name}
                          </span>
                        ))
                      : <span className="text-slate-300">—</span>
                    }
                  </div>
                </td>
                <td className="px-5 py-3.5 hidden xl:table-cell">
                  <span className={o.forecast_close_date && isOverdue(o.forecast_close_date) && o.status === 'open' ? 'text-red-600 font-medium' : 'text-slate-500'}>
                    {fmtDate(o.forecast_close_date)}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-slate-500 hidden xl:table-cell">{o.assigned_user_name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && total > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap">
            <span className="text-xs text-slate-400">
              Showing {rangeFrom}–{rangeTo} of {total} opportunit{total !== 1 ? 'ies' : 'y'}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-500 px-1">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
