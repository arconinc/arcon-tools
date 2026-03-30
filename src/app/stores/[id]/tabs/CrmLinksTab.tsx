'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { StoreDetail } from '@/types'

export function CrmLinksTab({ store, onSaved }: { store: StoreDetail; onSaved: () => void }) {
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([])
  const [contacts, setContacts] = useState<{ id: string; first_name: string; last_name: string; email: string | null }[]>([])
  const [linkedCustomer, setLinkedCustomer] = useState(store.customer)
  const [linkedContacts, setLinkedContacts] = useState(store.contacts)
  const [customerSearch, setCustomerSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/crm/customers?limit=200').then(r => r.json()).then(d => { if (d?.customers) setCustomers(d.customers) })
  }, [])

  useEffect(() => {
    if (!linkedCustomer) { setContacts([]); return }
    fetch(`/api/crm/contacts?customer_id=${linkedCustomer.id}&limit=200`)
      .then(r => r.json())
      .then(d => { if (d?.contacts) setContacts(d.contacts) })
  }, [linkedCustomer?.id])

  async function setCustomer(customerId: string | null) {
    setSaving(true); setErr(null)
    if (customerId) {
      await fetch(`/api/stores/${store.id}/customer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId }),
      })
      const found = customers.find(c => c.id === customerId)
      setLinkedCustomer(found ?? null)
    } else {
      await fetch(`/api/stores/${store.id}/customer`, { method: 'DELETE' })
      setLinkedCustomer(null)
      setLinkedContacts([])
    }
    setSaving(false)
    onSaved()
  }

  async function addContact(contactId: string) {
    const res = await fetch(`/api/stores/${store.id}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contactId }),
    })
    if (res.ok) {
      const c = contacts.find(x => x.id === contactId)
      if (c) setLinkedContacts(lc => [...lc, c])
    }
  }

  async function removeContact(contactId: string) {
    const res = await fetch(`/api/stores/${store.id}/contacts?contact_id=${contactId}`, { method: 'DELETE' })
    if (res.ok) setLinkedContacts(lc => lc.filter(c => c.id !== contactId))
  }

  const filteredCustomers = customers.filter(c =>
    !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase())
  )
  const unlinkedContacts = contacts.filter(c => !linkedContacts.find(lc => lc.id === c.id))

  return (
    <div className="space-y-6">
      {err && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{err}</div>}

      {/* Customer */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">CRM Customer</h3>
        {linkedCustomer ? (
          <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm shrink-0">
              {linkedCustomer.name[0]}
            </div>
            <Link href={`/crm/customers/${linkedCustomer.id}`} className="flex-1 text-sm font-medium text-slate-800 hover:text-purple-700 transition-colors">
              {linkedCustomer.name}
            </Link>
            <button onClick={() => setCustomer(null)} disabled={saving}
              className="text-slate-300 hover:text-red-500 transition-colors p-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input type="text" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
              placeholder="Search customers…"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            {customerSearch && (
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto bg-white">
                {filteredCustomers.slice(0, 10).map(c => (
                  <button key={c.id} type="button" onClick={() => { setCustomer(c.id); setCustomerSearch('') }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-purple-50 hover:text-purple-700 transition-colors border-b border-slate-50 last:border-0">
                    {c.name}
                  </button>
                ))}
                {filteredCustomers.length === 0 && <p className="px-4 py-2.5 text-sm text-slate-400">No customers found</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contacts — only available once a customer is linked */}
      {linkedCustomer && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Contacts</h3>
          {linkedContacts.length > 0 && (
            <div className="space-y-2 mb-3">
              {linkedContacts.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm shrink-0">
                    {c.first_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{c.first_name} {c.last_name}</p>
                    {c.email && <p className="text-xs text-slate-400 truncate">{c.email}</p>}
                  </div>
                  <button onClick={() => removeContact(c.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors p-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          {unlinkedContacts.length > 0 ? (
            <select
              defaultValue=""
              onChange={e => { if (e.target.value) addContact(e.target.value) }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
            >
              <option value="">Add a contact…</option>
              {unlinkedContacts.map(c => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.email ? ` (${c.email})` : ''}</option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-slate-400">All contacts for this customer have been added.</p>
          )}
        </div>
      )}
    </div>
  )
}
