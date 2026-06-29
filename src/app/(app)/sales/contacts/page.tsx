'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type DataTableColumn, MultiSelect, type MultiSelectOption } from '@/components/ui'
import { FilterPillGroup, type FilterPillOption } from '@/components/ui/FilterPill'

const PAGE_SIZE = 50

type TagOption = { id: string; name: string; color: string }

type ContactListItem = {
  id: string
  first_name: string
  last_name: string
  title: string | null
  email: string | null
  phone: string | null
  type_of_contact: 'Customer' | 'Vendor' | 'Prospect' | 'Partner' | 'Other'
  customer_id: string | null
  vendor_id: string | null
  customer_name: string | null
  vendor_name: string | null
  tags: TagOption[]
  updated_at: string
}

const TYPE_BADGE: Record<string, string> = {
  Customer: 'bg-blue-100 text-blue-800',
  Vendor: 'bg-orange-100 text-orange-800',
  Prospect: 'bg-yellow-100 text-yellow-800',
  Partner: 'bg-purple-100 text-purple-800',
  Other: 'bg-slate-100 text-slate-700',
}

type TypeFilter = '' | 'Customer' | 'Vendor' | 'Prospect' | 'Partner' | 'Other'

const TYPE_OPTIONS: FilterPillOption<TypeFilter>[] = [
  { value: '', label: 'All Types' },
  { value: 'Customer', label: 'Customer', color: 'blue' },
  { value: 'Vendor', label: 'Supplier', color: 'amber' },
  { value: 'Prospect', label: 'Prospect', color: 'amber' },
  { value: 'Partner', label: 'Partner', color: 'purple' },
  { value: 'Other', label: 'Other', color: 'slate' },
]

const TYPE_LABELS: Record<string, string> = {
  Vendor: 'Supplier',
}

export default function ContactsPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<ContactListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [allTags, setAllTags] = useState<TagOption[]>([])
  const [search, setSearch] = useState('')
  const [type, setType] = useState<TypeFilter>('')
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetch('/api/marketing/tags').then((r) => r.json()).then((d) => { if (Array.isArray(d)) setAllTags(d) })
  }, [])

  const fetchContacts = useCallback(async (currentPage: number) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (type) params.set('type', type)
    if (tagFilter.length > 0) params.set('tag_id', tagFilter.join(','))
    params.set('page', String(currentPage))
    params.set('limit', String(PAGE_SIZE))
    try {
      const res = await fetch(`/api/marketing/contacts?${params}`)
      const data = await res.json()
      setContacts(Array.isArray(data.contacts) ? data.contacts : [])
      setTotal(typeof data.total === 'number' ? data.total : 0)
    } finally {
      setLoading(false)
    }
  }, [search, type, tagFilter])

  useEffect(() => { setPage(1) }, [search, type, tagFilter])

  useEffect(() => {
    const t = setTimeout(() => fetchContacts(page), 300)
    return () => clearTimeout(t)
  }, [fetchContacts, page])

  const columns = useMemo<DataTableColumn<ContactListItem>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      sortValue: (c) => c.last_name + c.first_name,
      render: (c) => (
        <div>
          <div className="font-medium text-slate-900">{c.first_name} {c.last_name}</div>
          {c.title && <div className="text-xs text-slate-400 mt-0.5">{c.title}</div>}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sortValue: (c) => c.type_of_contact,
      className: 'hidden md:table-cell',
      render: (c) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${TYPE_BADGE[c.type_of_contact] ?? TYPE_BADGE.Other}`}>
          {TYPE_LABELS[c.type_of_contact] ?? c.type_of_contact}
        </span>
      ),
    },
    {
      key: 'org',
      header: 'Organization',
      sortValue: (c) => c.customer_name ?? c.vendor_name ?? '',
      className: 'hidden md:table-cell',
      render: (c) => (
        <span className="text-slate-600">{c.customer_name ?? c.vendor_name ?? <span className="text-slate-400">—</span>}</span>
      ),
    },
    {
      key: 'tags',
      header: 'Tags',
      className: 'hidden lg:table-cell',
      render: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.tags.length > 0
            ? c.tags.map((t) => (
                <span key={t.id} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold text-white" style={{ backgroundColor: t.color }}>
                  {t.name}
                </span>
              ))
            : <span className="text-slate-300">—</span>
          }
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      sortValue: (c) => c.email ?? '',
      className: 'hidden lg:table-cell',
      render: (c) => <span className="text-slate-600">{c.email ?? <span className="text-slate-400">—</span>}</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      className: 'hidden lg:table-cell',
      render: (c) => <span className="text-slate-600">{c.phone ?? <span className="text-slate-400">—</span>}</span>,
    },
  ], [])

  const emptyMessage = search || type || tagFilter
    ? 'No contacts match your filters.'
    : 'No contacts yet. Create one to get started.'

  return (
    <div className="w-full px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500 mt-0.5">People across all organizations</p>
        </div>
        <button
          onClick={() => router.push('/sales/contacts/new')}
          className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Contact
        </button>
      </div>

      <div className="flex flex-col gap-4 mb-5">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" strokeWidth={2} />
              <path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
          {allTags.length > 0 && (
            <MultiSelect
              options={allTags.map((t): MultiSelectOption => ({ value: t.id, label: t.name, color: t.color }))}
              value={tagFilter}
              onChange={setTagFilter}
              placeholder="All Tags"
              label="Filter by tag"
            />
          )}
        </div>
        <FilterPillGroup
          options={TYPE_OPTIONS}
          value={type}
          onChange={setType}
          label="Filter by type"
        />
      </div>

      <DataTable
        rows={contacts}
        columns={columns}
        loading={loading}
        emptyMessage={emptyMessage}
        getRowKey={(c) => c.id}
        onRowClick={(c) => router.push(`/sales/contacts/${c.id}`)}
        pagination={{
          page,
          total,
          pageSize: PAGE_SIZE,
          itemName: 'contact',
          onPageChange: setPage,
        }}
      />
    </div>
  )
}
