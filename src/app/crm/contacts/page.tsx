'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

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
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (type) params.set('type', type)
    try {
      const res = await fetch(`/api/crm/contacts?${params}`)
      const data = await res.json()
      setContacts(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [search, type])

  useEffect(() => {
    const t = setTimeout(fetchContacts, 300)
    return () => clearTimeout(t)
  }, [fetchContacts])

  function orgName(c: ContactListItem) {
    return c.customer_name ?? c.vendor_name ?? null
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
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

      <div className="flex gap-3 mb-5">
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
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Type</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Organization</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Email</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Phone</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {[...Array(5)].map((_, j) => (
                  <td key={j} className="px-5 py-3.5">
                    <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: j === 0 ? '50%' : '40%' }} />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && contacts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-400">
                  {search || type ? 'No contacts match your filters.' : 'No contacts yet. Create one to get started.'}
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
                <td className="px-5 py-3.5 text-slate-600 hidden lg:table-cell">{c.email ?? <span className="text-slate-400">—</span>}</td>
                <td className="px-5 py-3.5 text-slate-600 hidden lg:table-cell">{c.phone ?? <span className="text-slate-400">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && contacts.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
