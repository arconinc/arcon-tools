'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

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
  tags: TagOption[]
  updated_at: string
}

export default function VendorsPage() {
  const router = useRouter()
  const [vendors, setVendors] = useState<VendorListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [allTags, setAllTags] = useState<TagOption[]>([])
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetch('/api/crm/tags').then((r) => r.json()).then((d) => { if (Array.isArray(d)) setAllTags(d) })
  }, [])

  const fetchVendors = useCallback(async (currentPage: number) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (tagFilter) params.set('tag_id', tagFilter)
    params.set('page', String(currentPage))
    params.set('limit', String(PAGE_SIZE))
    try {
      const res = await fetch(`/api/crm/vendors?${params}`)
      const data = await res.json()
      setVendors(Array.isArray(data.vendors) ? data.vendors : [])
      setTotal(typeof data.total === 'number' ? data.total : 0)
    } finally {
      setLoading(false)
    }
  }, [search, tagFilter])

  useEffect(() => { setPage(1) }, [search, tagFilter])

  useEffect(() => {
    const t = setTimeout(() => fetchVendors(page), 300)
    return () => clearTimeout(t)
  }, [fetchVendors, page])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeTo = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="w-full px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendors</h1>
          <p className="text-sm text-slate-500 mt-0.5">Supplier organizations and partners</p>
        </div>
        <button
          onClick={() => router.push('/crm/vendors/new')}
          className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Vendor
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
            placeholder="Search vendors…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
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
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Product Line</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Phone</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Tags</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Website</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Premier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {[...Array(6)].map((_, j) => (
                  <td key={j} className="px-5 py-3.5">
                    <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: j === 0 ? '55%' : '35%' }} />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && vendors.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">
                  {search || tagFilter ? 'No vendors match your filters.' : 'No vendors yet. Create one to get started.'}
                </td>
              </tr>
            )}
            {!loading && vendors.map((v) => (
              <tr
                key={v.id}
                onClick={() => router.push(`/crm/vendors/${v.id}`)}
                className="hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <td className="px-5 py-3.5 font-medium text-slate-900">{v.name}</td>
                <td className="px-5 py-3.5 text-slate-600 hidden md:table-cell">{v.product_line ?? '—'}</td>
                <td className="px-5 py-3.5 text-slate-600 hidden md:table-cell">{v.phone ?? '—'}</td>
                <td className="px-5 py-3.5 hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {v.tags.length > 0
                      ? v.tags.map((t) => (
                          <span key={t.id} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold text-white" style={{ backgroundColor: t.color }}>
                            {t.name}
                          </span>
                        ))
                      : <span className="text-slate-300">—</span>
                    }
                  </div>
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell">
                  {v.website
                    ? <a href={v.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-purple-700 hover:underline">{v.website.replace(/^https?:\/\//, '')}</a>
                    : <span className="text-slate-400">—</span>
                  }
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell">
                  {v.premier_group_member
                    ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800">Premier</span>
                    : <span className="text-slate-400">—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && total > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap">
            <span className="text-xs text-slate-400">
              Showing {rangeFrom}–{rangeTo} of {total} vendor{total !== 1 ? 's' : ''}
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
