'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SpecIdea } from '@/types'
import { DataTable, FilterPillGroup, type DataTableColumn, type FilterPillOption } from '@/components/ui'

type StatusFilter = 'active' | 'archived'

const STATUS_OPTIONS: FilterPillOption<StatusFilter>[] = [
  {
    value: 'active',
    label: 'Active',
    color: 'green',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  {
    value: 'archived',
    label: 'Archived',
    color: 'slate',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 8v13H3V8" />
        <path d="M1 3h22v5H1z" />
        <path d="M10 12h4" />
      </svg>
    ),
  },
]

function SearchIcon() {
  return (
    <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="8" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
    </svg>
  )
}

function ImagePlaceholder() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-purple-100 bg-purple-50 text-purple-200">
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    </div>
  )
}

export default function AdminSpecIdeasPage() {
  const router = useRouter()
  const [ideas, setIdeas] = useState<SpecIdea[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [vendors, setVendors] = useState<string[]>([])
  const [vendorFilter, setVendorFilter] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchIdeas = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '500' })
    if (search) params.set('q', search)
    params.set('active_only', statusFilter === 'archived' ? 'false' : '1')
    if (vendorFilter) params.set('vendor', vendorFilter)
    try {
      const res = await fetch(`/api/marketing/spec-ideas?${params}`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setIdeas(data)
        const vs = [...new Set(data.map((d: SpecIdea) => d.vendor).filter(Boolean))].sort() as string[]
        setVendors(vs)
      }
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, vendorFilter])

  useEffect(() => { fetchIdeas() }, [fetchIdeas])

  async function handleCreate() {
    setCreating(true)
    const res = await fetch('/api/marketing/spec-ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor: 'New Supplier', item_name: 'New Item' }),
    })
    const idea = await res.json()
    setCreating(false)
    if (idea?.id) router.push(`/admin/specs/ideas/${idea.id}`)
  }

  const filtered = useMemo(
    () => ideas.filter((idea) => statusFilter === 'archived' ? !idea.is_active : idea.is_active),
    [ideas, statusFilter],
  )

  const hasFilters = Boolean(search || vendorFilter || statusFilter !== 'active')

  const columns: DataTableColumn<SpecIdea>[] = [
    {
      key: 'image',
      header: '',
      render: (idea) => idea.image_url ? (
        <img
          src={idea.image_url}
          alt=""
          className="h-10 w-10 rounded-md border border-purple-100 object-cover"
        />
      ) : <ImagePlaceholder />,
      className: 'w-14 pr-1',
      skeletonWidth: '40px',
    },
    {
      key: 'item',
      header: 'Item',
      render: (idea) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-950">{idea.item_name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            {idea.item_number ? <span>#{idea.item_number}</span> : <span>No item number</span>}
            {!idea.is_active && (
              <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                Archived
              </span>
            )}
          </div>
        </div>
      ),
      sortValue: (idea) => idea.item_name,
      skeletonWidth: '65%',
    },
    {
      key: 'vendor',
      header: 'Supplier',
      render: (idea) => <span className="font-semibold text-purple-700">{idea.vendor}</span>,
      sortValue: (idea) => idea.vendor,
    },
    {
      key: 'category',
      header: 'Category',
      render: (idea) => <span className="text-slate-600">{idea.category ?? '—'}</span>,
      sortValue: (idea) => idea.category ?? '',
      className: 'hidden md:table-cell',
    },
    {
      key: 'price',
      header: 'Price Range',
      render: (idea) => <span className="font-semibold text-slate-700">{idea.price_range ?? '—'}</span>,
      sortValue: (idea) => idea.price_range ?? '',
      className: 'hidden lg:table-cell',
    },
    {
      key: 'tags',
      header: 'Tags',
      render: (idea) => {
        const tags = idea.tags ?? []
        if (tags.length === 0) return <span className="text-slate-400">—</span>
        return (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 2).map((tag) => (
              <span key={tag} className="inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">
                {tag}
              </span>
            ))}
            {tags.length > 2 && <span className="text-xs font-semibold text-slate-400">+{tags.length - 2}</span>}
          </div>
        )
      },
      sortValue: (idea) => (idea.tags ?? []).join(', '),
      className: 'hidden xl:table-cell',
    },
    {
      key: 'updated',
      header: 'Updated',
      render: (idea) => (
        <span className="text-xs text-slate-500">
          {new Date(idea.updated_at).toLocaleDateString()}
        </span>
      ),
      sortValue: (idea) => new Date(idea.updated_at),
      className: 'hidden lg:table-cell',
    },
    {
      key: 'actions',
      header: '',
      render: (idea) => (
        <Link
          href={`/admin/specs/ideas/${idea.id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex rounded-md border border-purple-100 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-purple-50 hover:text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-300"
        >
          Edit
        </Link>
      ),
      className: 'w-20 text-right',
      headerClassName: 'text-right',
      skeletonWidth: '42px',
    },
  ]

  return (
    <div className="w-full px-6 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Spec Ideas</h1>
          <p className="mt-0.5 text-sm text-slate-500">Manage the product catalog for spec sample creation.</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span aria-hidden="true">+</span>
          {creating ? 'Creating...' : 'New Idea'}
        </button>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterPillGroup
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
          label="Filter by status"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={vendorFilter}
            onChange={e => setVendorFilter(e.target.value)}
            aria-label="Filter by supplier"
            className="h-[34px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-300"
          >
            <option value="">All Suppliers</option>
            {vendors.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <div className="relative">
            <SearchIcon />
            <input
              type="search"
              placeholder="Search ideas..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-[34px] min-w-[220px] rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setVendorFilter('')
                setStatusFilter('active')
              }}
              className="text-xs font-semibold text-purple-700 hover:underline focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <DataTable
        rows={filtered}
        columns={columns}
        loading={loading}
        emptyMessage={hasFilters ? 'No spec ideas match your filters.' : 'No active spec ideas yet. Create one to get started.'}
        getRowKey={(idea) => idea.id}
        onRowClick={(idea) => router.push(`/admin/specs/ideas/${idea.id}`)}
        minWidth="980px"
      />
    </div>
  )
}
