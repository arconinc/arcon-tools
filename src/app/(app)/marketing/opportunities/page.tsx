'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { opportunityStatusBadge } from '@/lib/badges'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { FilterPillGroup, type FilterPillOption } from '@/components/ui/FilterPill'
import { MultiSelect, type MultiSelectOption } from '@/components/ui/MultiSelect'
import { SavedFiltersMenu } from '@/components/ui/SavedFiltersMenu'

const PAGE_SIZE = 50
const PAGE_KEY = 'marketing/opportunities'
const FILTER_STORAGE_KEY = `savedFilters:current:${PAGE_KEY}`
const ACTIVE_FILTER_STORAGE_KEY = `savedFilters:active:${PAGE_KEY}`

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

type StatusFilter = '' | 'open' | 'won' | 'lost' | 'stalled'

type StoredOpportunityFilters = {
  search?: unknown
  statusFilter?: unknown
  stageFilter?: unknown
  ownerFilter?: unknown
  tagFilter?: unknown
}

function readStoredFilters(): StoredOpportunityFilters {
  if (typeof window === 'undefined') return {}
  try {
    const stored = window.localStorage.getItem(FILTER_STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function readStoredString(key: string) {
  if (typeof window === 'undefined') return null
  try { return window.localStorage.getItem(key) } catch { return null }
}

function asStringArray(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  return typeof value === 'string' && value ? [value] : []
}

const STAGES = ['Send Quote', 'Follow Up on Quote', 'Quote Accepted', 'Send Thank You Email']

const STATUS_OPTIONS: FilterPillOption<StatusFilter>[] = [
  { value: '', label: 'All', color: 'slate' },
  { value: 'open', label: 'Open', color: 'blue' },
  { value: 'won', label: 'Won', color: 'green' },
  { value: 'lost', label: 'Lost', color: 'red' },
  { value: 'stalled', label: 'Stalled', color: 'amber' },
]

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
  const storedFilters = readStoredFilters()
  const [rawOpps, setRawOpps] = useState<OppListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [allTags, setAllTags] = useState<TagOption[]>([])
  const [search, setSearch] = useState(() => typeof storedFilters.search === 'string' ? storedFilters.search : '')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const status = storedFilters.statusFilter
    return status === 'open' || status === 'won' || status === 'lost' || status === 'stalled' ? status : ''
  })
  const [stageFilter, setStageFilter] = useState<string[]>(() => asStringArray(storedFilters.stageFilter))
  const [ownerFilter, setOwnerFilter] = useState<string[]>(() => asStringArray(storedFilters.ownerFilter))
  const [tagFilter, setTagFilter] = useState<string[]>(() => asStringArray(storedFilters.tagFilter))
  const [page, setPage] = useState(1)
  const [activeFilterId, setActiveFilterId] = useState<string | null>(() => readStoredString(ACTIVE_FILTER_STORAGE_KEY))

  useEffect(() => {
    fetch('/api/marketing/tags').then((r) => r.json()).then((d) => { if (Array.isArray(d)) setAllTags(d) })
  }, [])



  const fetchOpps = useCallback(async (currentPage: number) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (stageFilter.length > 0) params.set('stage', stageFilter.join(','))
    if (tagFilter.length > 0) params.set('tag_id', tagFilter.join(','))
    params.set('page', String(currentPage))
    params.set('limit', String(PAGE_SIZE))
    try {
      const res = await fetch(`/api/marketing/opportunities?${params}`)
      const data = await res.json()
      setRawOpps(Array.isArray(data.items) ? data.items : [])
      setTotal(typeof data.total === 'number' ? data.total : 0)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, JSON.stringify(stageFilter), JSON.stringify(tagFilter)])

  useEffect(() => { setPage(1) }, [search, statusFilter, stageFilter, ownerFilter, tagFilter])

  useEffect(() => {
    try {
      window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(getCurrentFilterConfig()))
    } catch {}
  }, [search, statusFilter, stageFilter, ownerFilter, tagFilter])

  useEffect(() => {
    try {
      if (activeFilterId) window.localStorage.setItem(ACTIVE_FILTER_STORAGE_KEY, activeFilterId)
      else window.localStorage.removeItem(ACTIVE_FILTER_STORAGE_KEY)
    } catch {}
  }, [activeFilterId])

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
    if (ownerFilter.length > 0) {
      items = items.filter((o) => o.assigned_to && ownerFilter.includes(o.assigned_to))
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

  const activeFilters = !!(search || statusFilter || stageFilter.length || ownerFilter.length || tagFilter.length)

  function getCurrentFilterConfig(): Record<string, unknown> {
    return {
      search: search || null,
      statusFilter: statusFilter || null,
      stageFilter: stageFilter.length ? stageFilter : null,
      ownerFilter: ownerFilter.length ? ownerFilter : null,
      tagFilter: tagFilter.length ? tagFilter : null,
    }
  }

  function handleLoadFilter(config: Record<string, unknown>) {
    setSearch((config.search as string | null) ?? '')
    setStatusFilter(((config.statusFilter as StatusFilter | null) ?? '') as StatusFilter)
    const sf = config.stageFilter
    setStageFilter(Array.isArray(sf) ? sf : sf ? [sf as string] : [])
    const of_ = config.ownerFilter
    setOwnerFilter(Array.isArray(of_) ? of_ : of_ ? [of_ as string] : [])
    const tf = config.tagFilter
    setTagFilter(Array.isArray(tf) ? tf : tf ? [tf as string] : [])
    setPage(1)
  }

  const columns: DataTableColumn<OppListItem>[] = [
    {
      key: 'name',
      header: 'Name',
      sortValue: (o) => o.name,
      render: (o) => <span className="font-medium text-slate-900">{o.name}</span>,
    },
    {
      key: 'customer',
      header: 'Customer',
      sortValue: (o) => o.customer_name,
      render: (o) => <span className="text-slate-600">{o.customer_name ?? '—'}</span>,
      className: 'hidden md:table-cell',
    },
    {
      key: 'value',
      header: 'Value',
      sortValue: (o) => o.value,
      render: (o) => <span className="font-semibold text-slate-700">{fmt$(o.value)}</span>,
    },
    {
      key: 'pipeline',
      header: 'Pipeline',
      render: (o) => <PipelineMini stage={o.pipeline_stage} status={o.status} />,
      className: 'hidden lg:table-cell',
      skeletonWidth: '180px',
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (o) => o.status,
      render: (o) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize ${opportunityStatusBadge(o.status) ?? 'bg-slate-100 text-slate-600'}`}>
          {o.status}
        </span>
      ),
    },
    {
      key: 'tags',
      header: 'Tags',
      render: (o) => (
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
      ),
      className: 'hidden xl:table-cell',
    },
    {
      key: 'forecast_close_date',
      header: 'Forecast Close',
      sortValue: (o) => o.forecast_close_date ? new Date(o.forecast_close_date) : null,
      render: (o) => (
        <span className={o.forecast_close_date && isOverdue(o.forecast_close_date) && o.status === 'open' ? 'text-red-600 font-medium' : 'text-slate-500'}>
          {fmtDate(o.forecast_close_date)}
        </span>
      ),
      className: 'hidden xl:table-cell',
    },
    {
      key: 'owner',
      header: 'Owner',
      sortValue: (o) => o.assigned_user_name,
      render: (o) => <span className="text-slate-500">{o.assigned_user_name ?? '—'}</span>,
      className: 'hidden xl:table-cell',
    },
  ]

  const stageOptions: MultiSelectOption[] = STAGES.map((s) => ({ value: s, label: s }))
  const ownerSelectOptions: MultiSelectOption[] = ownerOptions.map(([id, name]) => ({ value: id, label: name }))
  const tagSelectOptions: MultiSelectOption[] = allTags.map((t) => ({ value: t.id, label: t.name, color: t.color }))

  return (
    <div className="w-full px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Opportunities</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track deals and pipeline progress</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/marketing/opportunities/new')}
            className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            New Opportunity
          </button>
        </div>
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
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <SavedFiltersMenu
          pageKey={PAGE_KEY}
          currentConfig={getCurrentFilterConfig()}
          onLoad={handleLoadFilter}
          activeFilterId={activeFilterId}
          onActiveFilterIdChange={setActiveFilterId}
          defaultActiveFilterId={activeFilterId}
        />
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
        <FilterPillGroup
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
          label="Status filter"
        />
        <MultiSelect
          options={stageOptions}
          value={stageFilter}
          onChange={setStageFilter}
          placeholder="All Stages"
          label="Filter by stage"
        />
        <MultiSelect
          options={ownerSelectOptions}
          value={ownerFilter}
          onChange={setOwnerFilter}
          placeholder="All Owners"
          label="Filter by owner"
        />
        {allTags.length > 0 && (
          <MultiSelect
            options={tagSelectOptions}
            value={tagFilter}
            onChange={setTagFilter}
            placeholder="All Tags"
            label="Filter by tag"
          />
        )}
      </div>

      <DataTable
        rows={opps}
        columns={columns}
        loading={loading}
        emptyMessage={activeFilters ? 'No opportunities match your filters.' : 'No opportunities yet. Create one to get started.'}
        getRowKey={(o) => o.id}
        onRowClick={(o) => router.push(`/marketing/opportunities/${o.id}`)}
        pagination={{
          page,
          total,
          pageSize: PAGE_SIZE,
          itemName: 'opportunit',
          onPageChange: setPage,
        }}
        minWidth="900px"
      />
    </div>
  )
}
