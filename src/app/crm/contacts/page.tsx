'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

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

const TYPE_COLORS: Record<string, string> = {
  Customer: 'bg-blue-100 text-blue-800',
  Vendor: 'bg-orange-100 text-orange-800',
  Prospect: 'bg-yellow-100 text-yellow-800',
  Partner: 'bg-purple-100 text-purple-800',
  Other: 'bg-slate-100 text-slate-700',
}

export default function ContactsPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<ContactListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [allTags, setAllTags] = useState<TagOption[]>([])
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetch('/api/crm/tags').then((r) => r.json()).then((d) => { if (Array.isArray(d)) setAllTags(d) })
  }, [])

  const fetchContacts = useCallback(async (currentPage: number) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (type) params.set('type', type)
    if (tagFilter) params.set('tag_id', tagFilter)
    params.set('page', String(currentPage))
    params.set('limit', String(PAGE_SIZE))
    try {
      const res = await fetch(`/api/crm/contacts?${params}`)
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

  function orgName(c: ContactListItem) {
    return c.customer_name ?? c.vendor_name ?? null
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeTo = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="w-full px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500 mt-0.5">People across all organizations</p>
        </div>
        <button
          onClick={() => router.push('/crm/contacts/new')}
          className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Contact
        </button>
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
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
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          <option value="">All Types</option>
          <option value="Customer">Customer</option>
          <option value="Vendor">Vendor</option>
          <option value="Prospect">Prospect</option>
          <option value="Partner">Partner</option>
          <option value="Other">Other</option>
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

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Type</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Organization</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Tags</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Email</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Phone</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {[...Array(6)].map((_, j) => (
                  <td key={j} className="px-5 py-3.5">
                    <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: j === 0 ? '50%' : '40%' }} />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && contacts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">
                  {search || type || tagFilter ? 'No contacts match your filters.' : 'No contacts yet. Create one to get started.'}
                </td>
              </tr>
            )}
            {!loading && contacts.map((c) => (
              <tr
                key={c.id}
                onClick={() => router.push(`/crm/contacts/${c.id}`)}
                className="hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <td className="px-5 py-3.5">
                  <div className="font-medium text-slate-900">{c.first_name} {c.last_name}</div>
                  {c.title && <div className="text-xs text-slate-400 mt-0.5">{c.title}</div>}
                </td>
                <td className="px-5 py-3.5 hidden md:table-cell">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${TYPE_COLORS[c.type_of_contact] ?? TYPE_COLORS.Other}`}>
                    {c.type_of_contact}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-slate-600 hidden md:table-cell">{orgName(c) ?? <span className="text-slate-400">—</span>}</td>
                <td className="px-5 py-3.5 hidden lg:table-cell">
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
                </td>
                <td className="px-5 py-3.5 text-slate-600 hidden lg:table-cell">{c.email ?? <span className="text-slate-400">—</span>}</td>
                <td className="px-5 py-3.5 text-slate-600 hidden lg:table-cell">{c.phone ?? <span className="text-slate-400">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && total > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap">
            <span className="text-xs text-slate-400">
              Showing {rangeFrom}–{rangeTo} of {total} contact{total !== 1 ? 's' : ''}
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
