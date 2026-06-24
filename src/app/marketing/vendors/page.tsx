'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type DataTableColumn, FilterPillGroup, type FilterPillOption } from '@/components/ui'

const PAGE_SIZE = 50

type TagOption = { id: string; name: string; color: string }

type VendorListItem = {
  id: string
  name: string
  phone: string | null
  website: string | null
  product_line: string | null
  specialty: string | null
  premier_group_member: boolean
  logo_url: string | null
  tags: TagOption[]
  updated_at: string
}

type PremierFilter = '' | 'premier'

const PREMIER_OPTIONS: FilterPillOption<PremierFilter>[] = [
  {
    value: '',
    label: 'All',
    color: 'purple',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="12" r="4" /><circle cx="16" cy="12" r="4" />
      </svg>
    ),
  },
  {
    value: 'premier',
    label: 'Premier',
    color: 'purple',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
]

export default function VendorsPage() {
  const router = useRouter()
  const [vendors, setVendors] = useState<VendorListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [allTags, setAllTags] = useState<TagOption[]>([])
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [premierFilter, setPremierFilter] = useState<PremierFilter>('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetch('/api/marketing/tags').then((r) => r.json()).then((d) => { if (Array.isArray(d)) setAllTags(d) })
  }, [])

  const fetchVendors = useCallback(async (currentPage: number) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (tagFilter) params.set('tag_id', tagFilter)
    if (premierFilter === 'premier') params.set('premier', 'true')
    params.set('page', String(currentPage))
    params.set('limit', String(PAGE_SIZE))
    try {
      const res = await fetch(`/api/marketing/vendors?${params}`)
      const data = await res.json()
      setVendors(Array.isArray(data.vendors) ? data.vendors : [])
      setTotal(typeof data.total === 'number' ? data.total : 0)
    } finally {
      setLoading(false)
    }
  }, [search, tagFilter, premierFilter])

  useEffect(() => { setPage(1) }, [search, tagFilter, premierFilter])

  useEffect(() => {
    const t = setTimeout(() => fetchVendors(page), 300)
    return () => clearTimeout(t)
  }, [fetchVendors, page])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const vendorColumns: DataTableColumn<VendorListItem>[] = [
    {
      key: 'logo',
      header: '',
      render: (v) => v.logo_url ? (
        <img
          src={v.logo_url}
          alt=""
          className="h-8 w-8 rounded-md border border-purple-100 bg-white object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      ) : (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-purple-100 text-[10px] font-bold text-purple-800">
          {v.name.slice(0, 2).toUpperCase()}
        </div>
      ),
      className: 'w-12 pr-1',
      skeletonWidth: '32px',
    },
    {
      key: 'name',
      header: 'Name',
      render: (v) => <span className="font-semibold text-slate-950">{v.name}</span>,
      sortValue: (v) => v.name,
      skeletonWidth: '55%',
    },
    {
      key: 'product_line',
      header: 'Product Line',
      render: (v) => <span className="text-slate-600">{v.product_line ?? '—'}</span>,
      sortValue: (v) => v.product_line ?? '',
      className: 'hidden md:table-cell',
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (v) => <span className="text-slate-600">{v.phone ?? '—'}</span>,
      sortValue: (v) => v.phone ?? '',
      className: 'hidden md:table-cell',
    },
    {
      key: 'tags',
      header: 'Tags',
      render: (v) => (
        <div className="flex flex-wrap gap-1">
          {v.tags.length > 0
            ? v.tags.map((t) => (
                <span key={t.id} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: t.color }}>
                  {t.name}
                </span>
              ))
            : <span className="text-slate-400">—</span>
          }
        </div>
      ),
      sortValue: (v) => v.tags.map((tag) => tag.name).join(', '),
      className: 'hidden lg:table-cell',
    },
    {
      key: 'website',
      header: 'Website',
      render: (v) => v.website
        ? (
          <a href={v.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-medium text-purple-700 hover:underline">
            {v.website.replace(/^https?:\/\//, '')}
          </a>
        )
        : <span className="text-slate-400">—</span>,
      sortValue: (v) => v.website ?? '',
      className: 'hidden lg:table-cell',
    },
    {
      key: 'premier',
      header: 'Premier',
      render: (v) => v.premier_group_member
        ? <span className="inline-flex items-center rounded-md border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-700">Premier</span>
        : <span className="text-slate-400">—</span>,
      sortValue: (v) => v.premier_group_member,
      className: 'hidden lg:table-cell',
    },
  ]

  return (
    <div className="w-full px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Suppliers</h1>
          <p className="text-sm text-slate-500 mt-0.5">Supplier organizations and partners</p>
        </div>
        <button
          onClick={() => router.push('/marketing/vendors/new')}
          className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Vendor
        </button>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterPillGroup
          options={PREMIER_OPTIONS}
          value={premierFilter}
          onChange={setPremierFilter}
          label="Filter by tier"
        />
        <div className="flex flex-wrap items-center gap-2">
          {allTags.length > 0 && (
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              aria-label="Filter by tag"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              <option value="">All Tags</option>
              {allTags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="8" strokeWidth={2} />
              <path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search suppliers…"
              className="h-[34px] min-w-[220px] rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
        </div>
      </div>

      <DataTable
        rows={vendors}
        columns={vendorColumns}
        loading={loading}
        emptyMessage={search || tagFilter || premierFilter ? 'No vendors match your filters.' : 'No vendors yet. Create one to get started.'}
        getRowKey={(vendor) => vendor.id}
        onRowClick={(vendor) => router.push(`/marketing/vendors/${vendor.id}`)}
        pagination={{
          page,
          total,
          pageSize: PAGE_SIZE,
          itemName: 'vendor',
          onPageChange: (nextPage) => setPage(Math.min(totalPages, Math.max(1, nextPage))),
        }}
      />
    </div>
  )
}
