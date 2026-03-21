'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type TagOption = { id: string; name: string; color: string }

type CustomerListItem = {
  id: string
  name: string
  client_status: 'Prospective' | 'Active' | 'Former' | null
  phone: string | null
  website: string | null
  assigned_to: string | null
  assigned_user_name: string | null
  tags: TagOption[]
  updated_at: string
}

function statusBadge(status: CustomerListItem['client_status']) {
  if (!status) return null
  const styles: Record<string, string> = {
    Active: 'bg-green-100 text-green-800',
    Prospective: 'bg-slate-100 text-slate-700',
    Former: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${styles[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  )
}

export default function CustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<CustomerListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [allTags, setAllTags] = useState<TagOption[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [tagFilter, setTagFilter] = useState('')

  useEffect(() => {
    fetch('/api/crm/tags').then((r) => r.json()).then((d) => { if (Array.isArray(d)) setAllTags(d) })
  }, [])

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    if (tagFilter) params.set('tag_id', tagFilter)
    try {
      const res = await fetch(`/api/crm/customers?${params}`)
      const data = await res.json()
      setCustomers(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [search, status, tagFilter])

  useEffect(() => {
    const t = setTimeout(fetchCustomers, 300)
    return () => clearTimeout(t)
  }, [fetchCustomers])

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500 mt-0.5">All customer organizations</p>
        </div>
        <button
          onClick={() => router.push('/crm/customers/new')}
          className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Customer
        </button>
      </div>

      {/* Filters */}
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
            placeholder="Search customers…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          <option value="">All Statuses</option>
          <option value="Prospective">Prospective</option>
          <option value="Active">Active</option>
          <option value="Former">Former</option>
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
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Phone</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Tags</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Owner</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {[...Array(6)].map((_, j) => (
                    <td key={j} className="px-5 py-3.5">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: j === 0 ? '60%' : '40%' }} />
                    </td>
                  ))}
                </tr>
              ))
            )}
            {!loading && customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">
                  {search || status || tagFilter ? 'No customers match your filters.' : 'No customers yet. Create one to get started.'}
                </td>
              </tr>
            )}
            {!loading && customers.map((c) => (
              <tr
                key={c.id}
                onClick={() => router.push(`/crm/customers/${c.id}`)}
                className="hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <td className="px-5 py-3.5 font-medium text-slate-900">{c.name}</td>
                <td className="px-5 py-3.5">{statusBadge(c.client_status)}</td>
                <td className="px-5 py-3.5 text-slate-600 hidden md:table-cell">{c.phone ?? '—'}</td>
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
                <td className="px-5 py-3.5 text-slate-600 hidden lg:table-cell">{c.assigned_user_name ?? '—'}</td>
                <td className="px-5 py-3.5 text-slate-400 hidden lg:table-cell">
                  {new Date(c.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && customers.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
            {customers.length} customer{customers.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
