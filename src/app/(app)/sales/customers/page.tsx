'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type DataTableColumn, FilterPillGroup, type FilterPillOption, MultiSelect, type MultiSelectOption } from '@/components/ui'

const PAGE_SIZE = 50

type TagOption = { id: string; name: string; color: string }

type CustomerListItem = {
  id: string
  name: string
  client_status: 'Prospective' | 'Active' | 'Former' | null
  phone: string | null
  website: string | null
  logo_url: string | null
  assigned_to: string | null
  assigned_user_name: string | null
  tags: TagOption[]
  updated_at: string
}

function statusBadge(status: CustomerListItem['client_status']) {
  if (!status) return null
  const styles: Record<string, string> = {
    Active:      'bg-green-50  text-green-700  border-green-200',
    Prospective: 'bg-slate-50  text-slate-600  border-slate-200',
    Former:      'bg-red-50    text-red-700    border-red-200',
  }
  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-bold ${styles[status] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
      {status}
    </span>
  )
}

type StatusFilter = '' | 'Active' | 'Prospective' | 'Former'

const STATUS_OPTIONS: FilterPillOption<StatusFilter>[] = [
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
    value: 'Active',
    label: 'Active',
    color: 'green',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    ),
  },
  {
    value: 'Prospective',
    label: 'Prospective',
    color: 'slate',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    value: 'Former',
    label: 'Former',
    color: 'red',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    ),
  },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<CustomerListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [allTags, setAllTags] = useState<TagOption[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('Active')
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetch('/api/marketing/tags').then((r) => r.json()).then((d) => { if (Array.isArray(d)) setAllTags(d) })
  }, [])

  const fetchCustomers = useCallback(async (currentPage: number) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    if (tagFilter.length > 0) params.set('tag_id', tagFilter.join(','))
    params.set('page', String(currentPage))
    params.set('limit', String(PAGE_SIZE))
    try {
      const res = await fetch(`/api/marketing/customers?${params}`)
      const data = await res.json()
      setCustomers(Array.isArray(data.customers) ? data.customers : [])
      setTotal(typeof data.total === 'number' ? data.total : 0)
    } finally {
      setLoading(false)
    }
  }, [search, status, tagFilter])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [search, status, tagFilter])

  // Fetch when page or filters change (debounced)
  useEffect(() => {
    const t = setTimeout(() => fetchCustomers(page), 300)
    return () => clearTimeout(t)
  }, [fetchCustomers, page])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const customerColumns: DataTableColumn<CustomerListItem>[] = [
    {
      key: 'logo',
      header: '',
      render: (c) => c.logo_url ? (
        <img
          src={c.logo_url}
          alt=""
          className="h-8 w-8 rounded-md border border-purple-100 bg-white object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      ) : (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-purple-100 text-[10px] font-bold text-purple-800">
          {c.name.slice(0, 2).toUpperCase()}
        </div>
      ),
      className: 'w-12 pr-1',
      skeletonWidth: '32px',
    },
    {
      key: 'name',
      header: 'Name',
      render: (c) => <span className="font-semibold text-slate-950">{c.name}</span>,
      sortValue: (c) => c.name,
      skeletonWidth: '60%',
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => statusBadge(c.client_status) ?? <span className="text-slate-400">—</span>,
      sortValue: (c) => c.client_status ?? '',
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (c) => <span className="text-slate-600">{c.phone ?? '—'}</span>,
      sortValue: (c) => c.phone ?? '',
      className: 'hidden md:table-cell',
    },
    {
      key: 'tags',
      header: 'Tags',
      render: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.tags.length > 0
            ? c.tags.map((t) => (
                <span key={t.id} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: t.color }}>
                  {t.name}
                </span>
              ))
            : <span className="text-slate-400">—</span>
          }
        </div>
      ),
      sortValue: (c) => c.tags.map((tag) => tag.name).join(', '),
      className: 'hidden lg:table-cell',
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (c) => <span className="text-slate-600">{c.assigned_user_name ?? '—'}</span>,
      sortValue: (c) => c.assigned_user_name ?? '',
      className: 'hidden lg:table-cell',
    },
    {
      key: 'updated',
      header: 'Updated',
      render: (c) => <span className="text-slate-500">{formatDate(c.updated_at)}</span>,
      sortValue: (c) => new Date(c.updated_at),
      className: 'hidden lg:table-cell',
    },
  ]

  return (
    <div className="w-full px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500 mt-0.5">All customer organizations</p>
        </div>
        <button
          onClick={() => router.push('/sales/customers/new')}
          className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Customer
        </button>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterPillGroup
          options={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
          label="Filter by status"
        />
        <div className="flex flex-wrap items-center gap-2">
          {allTags.length > 0 && (
            <MultiSelect
              options={allTags.map((t): MultiSelectOption => ({ value: t.id, label: t.name, color: t.color }))}
              value={tagFilter}
              onChange={setTagFilter}
              placeholder="All Tags"
              label="Filter by tag"
            />
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
              placeholder="Search customers…"
              className="h-[34px] min-w-[220px] rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
        </div>
      </div>

      <DataTable
        rows={customers}
        columns={customerColumns}
        loading={loading}
        emptyMessage={search || status || tagFilter ? 'No customers match your filters.' : 'No customers yet. Create one to get started.'}
        getRowKey={(customer) => customer.id}
        onRowClick={(customer) => router.push(`/sales/customers/${customer.id}`)}
        pagination={{
          page,
          total,
          pageSize: PAGE_SIZE,
          itemName: 'customer',
          onPageChange: (nextPage) => setPage(Math.min(totalPages, Math.max(1, nextPage))),
        }}
      />
    </div>
  )
}
