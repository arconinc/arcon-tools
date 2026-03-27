'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import TagPicker from '@/components/crm/TagPicker'
import EntitySearchPicker from '@/components/crm/EntitySearchPicker'
import { formatPhoneInput } from '@/lib/phone'

type DropdownUser = { id: string; display_name: string; email: string }
type TagOption = { id: string; name: string; color: string }

type ContactDetail = {
  id: string; first_name: string; last_name: string; title: string | null; email: string | null
  phone: string | null; home_phone: string | null; mobile_phone: string | null; other_phone: string | null
  linkedin: string | null
  mailing_address1: string | null; mailing_address2: string | null; mailing_city: string | null
  mailing_state: string | null; mailing_zip: string | null; mailing_country: string | null
  other_address1: string | null; other_address2: string | null; other_city: string | null
  other_state: string | null; other_zip: string | null; other_country: string | null
  description: string | null; industry: string | null
  type_of_contact: 'Customer' | 'Vendor' | 'Prospect' | 'Partner' | 'Other'
  products_purchased: string | null; organization_website: string | null
  arcon_salesperson: string | null; contact_owner: string | null; tags: TagOption[]
  customer_id: string | null; vendor_id: string | null
  department: string | null
  created_by: string; created_at: string; updated_at: string
  customer: { id: string; name: string; website: string | null } | null
  vendor: { id: string; name: string; website: string | null } | null
  files: { id: string; label: string; url: string; created_at: string }[]
}

const TYPE_COLORS: Record<string, string> = {
  Customer: 'bg-blue-100 text-blue-800', Vendor: 'bg-orange-100 text-orange-800',
  Prospect: 'bg-yellow-100 text-yellow-800', Partner: 'bg-purple-100 text-purple-800',
  Other: 'bg-slate-100 text-slate-700',
}

function Field({ label, value, link, email }: { label: string; value: string | null | undefined; link?: boolean; email?: boolean }) {
  const display = value
    ? link
      ? <a href={value} target="_blank" rel="noopener noreferrer" className="text-purple-700 hover:underline break-all">{value.replace(/^https?:\/\//, '')}</a>
      : email
        ? <a href={`mailto:${value}`} className="text-purple-700 hover:underline">{value}</a>
        : <span>{value}</span>
    : <span className="text-slate-400">—</span>
  return (
    <div>
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-sm text-slate-800">{display}</div>
    </div>
  )
}

function FI({ label, name, value, onChange, type = 'text' }: {
  label: string; name: string; value: string; onChange: (n: string, v: string) => void; type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(name, e.target.value)}
        className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white" />
    </div>
  )
}

export default function ContactDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const id = params.id
  const isNew = id === 'new'

  const [contact, setContact] = useState<ContactDetail | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [error, setError] = useState<string | null>(null)

  // Dropdown data
  const [crmUsers, setCrmUsers] = useState<DropdownUser[]>([])

  useEffect(() => {
    fetch('/api/crm/users').then((r) => r.json()).then((users) => {
      if (Array.isArray(users)) setCrmUsers(users)
    })
  }, [])
  const [activeTab, setActiveTab] = useState<'details' | 'related' | 'activity'>('details')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<ContactDetail>>({})
  const [editCustomerName, setEditCustomerName] = useState<string | null>(null)
  const [editVendorName, setEditVendorName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Tags — always-editable, saves immediately
  const [tagIds, setTagIds] = useState<string[]>([])
  const [tagSaving, setTagSaving] = useState(false)

  useEffect(() => {
    if (contact) setTagIds((contact.tags ?? []).map((t) => t.id))
  }, [contact])

  async function handleTagsChange(newIds: string[]) {
    setTagIds(newIds)
    if (!contact?.id) return
    setTagSaving(true)
    try {
      await fetch(`/api/crm/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_ids: newIds }),
      })
    } finally { setTagSaving(false) }
  }

  const [createForm, setCreateForm] = useState({
    first_name: '', last_name: '', title: '', email: '', phone: '',
    type_of_contact: 'Customer',
    customer_id: searchParams?.get('customer_id') ?? '',
    vendor_id: searchParams?.get('vendor_id') ?? '',
  })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (isNew) return
    fetch(`/api/crm/contacts/${id}`)
      .then((r) => r.json())
      .then((data) => { if (data.error) { setError(data.error); return } setContact(data) })
      .catch(() => setError('Failed to load contact'))
      .finally(() => setLoading(false))
  }, [id, isNew])

  function startEdit() {
    if (!contact) return
    setEditForm({ ...contact })
    setEditCustomerName(contact.customer?.name ?? null)
    setEditVendorName(contact.vendor?.name ?? null)
    setEditing(true)
  }
  function cancelEdit() {
    setEditing(false)
    setEditForm({})
    setEditCustomerName(null)
    setEditVendorName(null)
  }
  const PHONE_FIELDS = new Set(['phone', 'home_phone', 'mobile_phone', 'other_phone'])
  function handleEditChange(field: string, value: string) {
    const formatted = PHONE_FIELDS.has(field) ? formatPhoneInput(value) : value
    setEditForm((prev) => ({ ...prev, [field]: formatted || null }))
  }

  async function saveEdit() {
    if (!contact) return
    setSaving(true)
    try {
      const res = await fetch(`/api/crm/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Save failed'); return }
      // Re-fetch full contact to get updated nested relations (customer, vendor)
      const full = await fetch(`/api/crm/contacts/${contact.id}`).then((r) => r.json())
      if (!full.error) setContact(full)
      setEditing(false)
    } finally { setSaving(false) }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.first_name.trim() || !createForm.last_name.trim()) {
      setCreateError('First and last name are required'); return
    }
    setCreating(true); setCreateError(null)
    try {
      const res = await fetch('/api/crm/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: createForm.first_name.trim(),
          last_name: createForm.last_name.trim(),
          title: createForm.title || null,
          email: createForm.email || null,
          phone: createForm.phone || null,
          type_of_contact: createForm.type_of_contact,
          customer_id: createForm.customer_id || null,
          vendor_id: createForm.vendor_id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error ?? 'Create failed'); return }
      router.push(`/crm/contacts/${data.id}`)
    } finally { setCreating(false) }
  }

  if (isNew) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-6">
        <Link href="/crm/contacts" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Contacts
        </Link>
        <h1 className="text-xl font-bold text-slate-900 mb-4">New Contact</h1>
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          {createError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{createError}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">First Name <span className="text-red-500">*</span></label>
              <input type="text" value={createForm.first_name} onChange={(e) => setCreateForm((p) => ({ ...p, first_name: e.target.value }))} required
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Last Name <span className="text-red-500">*</span></label>
              <input type="text" value={createForm.last_name} onChange={(e) => setCreateForm((p) => ({ ...p, last_name: e.target.value }))} required
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Title / Role</label>
            <input type="text" value={createForm.title} onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
              className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Email</label>
              <input type="email" value={createForm.email} onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Phone</label>
              <input type="tel" value={createForm.phone} onChange={(e) => setCreateForm((p) => ({ ...p, phone: formatPhoneInput(e.target.value) }))}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Type of Contact</label>
            <select value={createForm.type_of_contact} onChange={(e) => setCreateForm((p) => ({ ...p, type_of_contact: e.target.value }))}
              className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
              <option>Customer</option><option>Vendor</option><option>Prospect</option><option>Partner</option><option>Other</option>
            </select>
          </div>
          <EntitySearchPicker
            label="Link to Customer"
            apiPath="/api/crm/customers"
            resultsKey="customers"
            value={createForm.customer_id || null}
            displayName={null}
            onSelect={(id) => setCreateForm((p) => ({ ...p, customer_id: id ?? '' }))}
            placeholder="Search customers…"
          />
          <EntitySearchPicker
            label="Link to Vendor"
            apiPath="/api/crm/vendors"
            resultsKey="vendors"
            value={createForm.vendor_id || null}
            displayName={null}
            onSelect={(id) => setCreateForm((p) => ({ ...p, vendor_id: id ?? '' }))}
            placeholder="Search vendors…"
          />
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={creating}
              className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-xl disabled:opacity-60 transition-colors">
              {creating ? 'Creating…' : 'Create Contact'}
            </button>
            <Link href="/crm/contacts" className="px-5 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="px-6 py-5 animate-pulse space-y-3">
        <div className="h-5 bg-slate-100 rounded w-24" />
        <div className="h-24 bg-slate-100 rounded-2xl" />
        <div className="h-64 bg-slate-100 rounded-2xl" />
      </div>
    )
  }

  if (error || !contact) {
    return (
      <div className="px-6 py-5">
        <Link href="/crm/contacts" className="text-sm text-slate-500 hover:text-slate-700">← Contacts</Link>
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error ?? 'Contact not found'}</div>
      </div>
    )
  }

  const ef = editForm as Partial<ContactDetail>

  return (
    <div className="px-6 py-5">
      <Link href="/crm/contacts" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Contacts
      </Link>

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-3">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-base font-bold text-purple-700 flex-shrink-0">
            {contact.first_name[0]}{contact.last_name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">{contact.first_name} {contact.last_name}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${TYPE_COLORS[contact.type_of_contact] ?? TYPE_COLORS.Other}`}>
                {contact.type_of_contact}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 flex-wrap">
              {contact.title && <span className="text-xs text-slate-500">{contact.title}</span>}
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="text-xs text-purple-700 hover:underline">{contact.email}</a>
              )}
              {contact.phone && <span className="text-xs text-slate-500">{contact.phone}</span>}
              {contact.customer && (
                <Link href={`/crm/customers/${contact.customer.id}`} className="text-xs text-purple-700 hover:underline">{contact.customer.name}</Link>
              )}
              {contact.vendor && (
                <Link href={`/crm/vendors/${contact.vendor.id}`} className="text-xs text-purple-700 hover:underline">{contact.vendor.name}</Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3">
        {(['details', 'related', 'activity'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg capitalize transition-colors ${
              activeTab === tab ? 'bg-purple-700 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── Details Tab ── */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-3 gap-4 items-start">
          {/* Main column */}
          <div className="col-span-2 space-y-3">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
                <h2 className="text-sm font-semibold text-slate-700">Name &amp; Contact Details</h2>
                {!editing ? (
                  <button onClick={startEdit} className="px-3 py-1 text-xs font-semibold border border-slate-300 text-slate-600 rounded-lg hover:bg-white transition-colors">Edit</button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={saving} className="px-3 py-1 text-xs font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-60 transition-colors">{saving ? 'Saving…' : 'Save'}</button>
                    <button onClick={cancelEdit} className="px-3 py-1 text-xs font-semibold border border-slate-300 text-slate-600 rounded-lg hover:bg-white transition-colors">Cancel</button>
                  </div>
                )}
              </div>

              {/* Basic contact fields */}
              <div className="px-5 py-4 grid grid-cols-3 gap-3">
                {editing ? (
                  <>
                    <FI label="First Name" name="first_name" value={(ef.first_name as string) ?? ''} onChange={handleEditChange} />
                    <FI label="Last Name" name="last_name" value={(ef.last_name as string) ?? ''} onChange={handleEditChange} />
                    <FI label="Title / Role" name="title" value={(ef.title as string) ?? ''} onChange={handleEditChange} />
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Type of Contact</label>
                      <select value={(ef.type_of_contact as string) ?? 'Customer'} onChange={(e) => handleEditChange('type_of_contact', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                        <option>Customer</option><option>Vendor</option><option>Prospect</option><option>Partner</option><option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Department</label>
                      <select value={(ef.department as string) ?? ''} onChange={(e) => handleEditChange('department', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                        <option value="">— None —</option>
                        <option>Accounting</option>
                        <option>C-Suite</option>
                        <option>Customer Service</option>
                        <option>Finance</option>
                        <option>HR</option>
                        <option>IT</option>
                        <option>Legal</option>
                        <option>Management</option>
                        <option>Marketing</option>
                        <option>Operations</option>
                        <option>Purchasing</option>
                        <option>Sales</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <FI label="Primary Email" name="email" value={(ef.email as string) ?? ''} onChange={handleEditChange} type="email" />
                    <FI label="Industry" name="industry" value={(ef.industry as string) ?? ''} onChange={handleEditChange} />
                    <FI label="Phone (Main)" name="phone" value={(ef.phone as string) ?? ''} onChange={handleEditChange} type="tel" />
                    <FI label="Mobile Phone" name="mobile_phone" value={(ef.mobile_phone as string) ?? ''} onChange={handleEditChange} type="tel" />
                    <FI label="Home Phone" name="home_phone" value={(ef.home_phone as string) ?? ''} onChange={handleEditChange} type="tel" />
                    <FI label="Other Phone" name="other_phone" value={(ef.other_phone as string) ?? ''} onChange={handleEditChange} type="tel" />
                    <div className="col-span-3">
                      <FI label="LinkedIn" name="linkedin" value={(ef.linkedin as string) ?? ''} onChange={handleEditChange} type="url" />
                    </div>
                  </>
                ) : (
                  <>
                    <Field label="Title / Role" value={contact.title} />
                    <Field label="Type of Contact" value={contact.type_of_contact} />
                    <Field label="Department" value={contact.department} />
                    <Field label="Industry" value={contact.industry} />
                    <Field label="Primary Email" value={contact.email} email />
                    <Field label="Phone (Main)" value={contact.phone} />
                    <Field label="Mobile Phone" value={contact.mobile_phone} />
                    <Field label="Home Phone" value={contact.home_phone} />
                    <Field label="Other Phone" value={contact.other_phone} />
                    <Field label="LinkedIn" value={contact.linkedin} link />
                  </>
                )}
              </div>

              {/* Addresses */}
              {(editing || contact.mailing_address1 || contact.mailing_city || contact.other_address1 || contact.other_city) && (
                <div className="border-t border-slate-100">
                  <div className="grid grid-cols-2 divide-x divide-slate-100">
                    {/* Mailing */}
                    <div>
                      <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                        <div className="w-0.5 h-3.5 bg-purple-300 rounded-full" />
                        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Mailing Address</h3>
                      </div>
                      <div className="px-5 py-4">
                        {editing ? (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2"><FI label="Address 1" name="mailing_address1" value={(ef.mailing_address1 as string) ?? ''} onChange={handleEditChange} /></div>
                            <div className="col-span-2"><FI label="Address 2" name="mailing_address2" value={(ef.mailing_address2 as string) ?? ''} onChange={handleEditChange} /></div>
                            <FI label="City" name="mailing_city" value={(ef.mailing_city as string) ?? ''} onChange={handleEditChange} />
                            <FI label="State" name="mailing_state" value={(ef.mailing_state as string) ?? ''} onChange={handleEditChange} />
                            <FI label="ZIP" name="mailing_zip" value={(ef.mailing_zip as string) ?? ''} onChange={handleEditChange} />
                            <div className="col-span-2"><FI label="Country" name="mailing_country" value={(ef.mailing_country as string) ?? ''} onChange={handleEditChange} /></div>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-800 leading-snug">
                            {contact.mailing_address1 && <div>{contact.mailing_address1}</div>}
                            {contact.mailing_address2 && <div>{contact.mailing_address2}</div>}
                            {(contact.mailing_city || contact.mailing_state || contact.mailing_zip) && (
                              <div>
                                {[contact.mailing_city, contact.mailing_state].filter(Boolean).join(', ')}
                                {contact.mailing_zip ? ` ${contact.mailing_zip}` : ''}
                              </div>
                            )}
                            {contact.mailing_country && <div>{contact.mailing_country}</div>}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Other */}
                    <div>
                      <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                        <div className="w-0.5 h-3.5 bg-purple-300 rounded-full" />
                        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Other Address</h3>
                      </div>
                      <div className="px-5 py-4">
                        {editing ? (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2"><FI label="Address 1" name="other_address1" value={(ef.other_address1 as string) ?? ''} onChange={handleEditChange} /></div>
                            <div className="col-span-2"><FI label="Address 2" name="other_address2" value={(ef.other_address2 as string) ?? ''} onChange={handleEditChange} /></div>
                            <FI label="City" name="other_city" value={(ef.other_city as string) ?? ''} onChange={handleEditChange} />
                            <FI label="State" name="other_state" value={(ef.other_state as string) ?? ''} onChange={handleEditChange} />
                            <FI label="ZIP" name="other_zip" value={(ef.other_zip as string) ?? ''} onChange={handleEditChange} />
                            <div className="col-span-2"><FI label="Country" name="other_country" value={(ef.other_country as string) ?? ''} onChange={handleEditChange} /></div>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-800 leading-snug">
                            {contact.other_address1 && <div>{contact.other_address1}</div>}
                            {contact.other_address2 && <div>{contact.other_address2}</div>}
                            {(contact.other_city || contact.other_state || contact.other_zip) && (
                              <div>
                                {[contact.other_city, contact.other_state].filter(Boolean).join(', ')}
                                {contact.other_zip ? ` ${contact.other_zip}` : ''}
                              </div>
                            )}
                            {contact.other_country && <div>{contact.other_country}</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Arcon Program Data */}
              <div className="border-t border-slate-100">
                <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <div className="w-0.5 h-3.5 bg-purple-300 rounded-full" />
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Arcon Program Data</h3>
                </div>
                <div className="px-5 py-4 grid grid-cols-2 gap-3">
                  {editing ? (
                    <>
                      <div className="col-span-2">
                        <FI label="Products Purchased" name="products_purchased" value={(ef.products_purchased as string) ?? ''} onChange={handleEditChange} />
                      </div>
                      <FI label="Organization Website" name="organization_website" value={(ef.organization_website as string) ?? ''} onChange={handleEditChange} type="url" />
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Arcon Salesperson</label>
                        <select value={(ef.arcon_salesperson as string) ?? ''} onChange={(e) => handleEditChange('arcon_salesperson', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                          <option value="">— None —</option>
                          {crmUsers.map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Contact Owner</label>
                        <select value={(ef.contact_owner as string) ?? ''} onChange={(e) => handleEditChange('contact_owner', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                          <option value="">— None —</option>
                          {crmUsers.map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                        </select>
                      </div>
                      <EntitySearchPicker
                        label="Link to Customer"
                        apiPath="/api/crm/customers"
                        resultsKey="customers"
                        value={(ef.customer_id as string) || null}
                        displayName={editCustomerName}
                        onSelect={(id, name) => { handleEditChange('customer_id', id ?? ''); setEditCustomerName(name) }}
                        placeholder="Search customers…"
                      />
                      <EntitySearchPicker
                        label="Link to Vendor"
                        apiPath="/api/crm/vendors"
                        resultsKey="vendors"
                        value={(ef.vendor_id as string) || null}
                        displayName={editVendorName}
                        onSelect={(id, name) => { handleEditChange('vendor_id', id ?? ''); setEditVendorName(name) }}
                        placeholder="Search vendors…"
                      />
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Description</label>
                        <textarea rows={3} value={(ef.description as string) ?? ''} onChange={(e) => handleEditChange('description', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
                      </div>
                    </>
                  ) : (
                    <>
                      {contact.products_purchased && (
                        <div className="col-span-2"><Field label="Products Purchased" value={contact.products_purchased} /></div>
                      )}
                      <Field label="Organization Website" value={contact.organization_website} link />
                      {contact.description && (
                        <div className="col-span-2"><Field label="Description" value={contact.description} /></div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Meta */}
              <div className="border-t border-slate-100 px-5 py-3 bg-slate-50 flex gap-6 text-xs text-slate-400">
                <span>Created {new Date(contact.created_at).toLocaleDateString()}</span>
                <span>Updated {new Date(contact.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-3">
            {/* Tags card */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <h2 className="text-sm font-semibold text-slate-700">Tags</h2>
                </div>
                {tagSaving && <span className="text-xs text-slate-400">Saving…</span>}
              </div>
              <div className="p-3">
                <TagPicker value={tagIds} onChange={handleTagsChange} placeholder="Add tags…" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Related Tab ── */}
      {activeTab === 'related' && (
        <div className="space-y-3">
          {/* Linked Organizations */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Organizations</h2>
            </div>
            <div className="p-5">
              {!contact.customer && !contact.vendor ? (
                <div className="text-sm text-slate-400">No organization linked. This is a standalone contact.</div>
              ) : (
                <div className="space-y-3">
                  {contact.customer && (
                    <div onClick={() => router.push(`/crm/customers/${contact.customer!.id}`)}
                      className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">C</div>
                      <div>
                        <div className="text-sm font-medium text-slate-800">{contact.customer.name}</div>
                        <div className="text-xs text-slate-400">Customer</div>
                      </div>
                    </div>
                  )}
                  {contact.vendor && (
                    <div onClick={() => router.push(`/crm/vendors/${contact.vendor!.id}`)}
                      className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                      <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-xs font-bold text-orange-700 flex-shrink-0">V</div>
                      <div>
                        <div className="text-sm font-medium text-slate-800">{contact.vendor.name}</div>
                        <div className="text-xs text-slate-400">Vendor</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Files */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Files ({contact.files.length})</h2>
            </div>
            {contact.files.length === 0
              ? <div className="px-5 py-6 text-sm text-slate-400 text-center">No files attached.</div>
              : <div className="divide-y divide-slate-100">
                  {contact.files.map((f) => (
                    <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                      <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      <span className="text-sm text-purple-700 hover:underline">{f.label}</span>
                    </a>
                  ))}
                </div>
            }
          </div>
        </div>
      )}

      {/* ── Activity Tab ── */}
      {activeTab === 'activity' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-400">
          Task activity for this contact will appear here once the Tasks feature is complete.{' '}
          <button onClick={() => router.push(`/crm/tasks?contact_id=${contact.id}`)} className="text-purple-700 hover:underline">View tasks →</button>
        </div>
      )}
    </div>
  )
}
