'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import TagPicker from '@/components/crm/TagPicker'

type DropdownUser = { id: string; display_name: string; email: string }
type TagOption = { id: string; name: string; color: string }

type CustomerDetail = {
  id: string; name: string; client_status: 'Prospective' | 'Active' | 'Former' | null
  phone: string | null; website: string | null; linkedin: string | null; email_domains: string | null
  billing_address1: string | null; billing_address2: string | null; billing_city: string | null
  billing_state: string | null; billing_zip: string | null; billing_country: string | null
  shipping_address1: string | null; shipping_address2: string | null; shipping_city: string | null
  shipping_state: string | null; shipping_zip: string | null; shipping_country: string | null
  description: string | null; tags: TagOption[]; artwork_notes: string | null
  general_logo_color: string | null; formal_pms_colors: string | null
  assigned_to: string | null; created_by: string; created_at: string; updated_at: string
  contacts: { id: string; first_name: string; last_name: string; title: string | null; email: string | null; phone: string | null }[]
  opportunities: { id: string; name: string; value: number | null; status: string; pipeline_stage: string | null; forecast_close_date: string | null }[]
  files: { id: string; label: string; url: string; created_at: string }[]
  assigned_user: { id: string; display_name: string; email: string } | null
  created_by_user: { id: string; display_name: string; email: string } | null
}

type CreateForm = {
  name: string; client_status: string; assigned_to: string; phone: string; website: string
  linkedin: string; email_domains: string; description: string
}

const STATUS_BADGE: Record<string, string> = {
  Active: 'bg-green-100 text-green-800',
  Prospective: 'bg-slate-100 text-slate-700',
  Former: 'bg-red-100 text-red-700',
}

const OPP_STATUS_BADGE: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-700',
  stalled: 'bg-slate-100 text-slate-600',
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-sm text-slate-800">{value || <span className="text-slate-400">—</span>}</div>
    </div>
  )
}

function FieldInput({ label, name, value, onChange, type = 'text', textarea = false }: {
  label: string; name: string; value: string; onChange: (n: string, v: string) => void
  type?: string; textarea?: boolean
}) {
  const cls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
      {textarea
        ? <textarea rows={3} value={value} onChange={(e) => onChange(name, e.target.value)} className={cls + ' resize-none'} />
        : <input type={type} value={value} onChange={(e) => onChange(name, e.target.value)} className={cls} />
      }
    </div>
  )
}

export default function CustomerDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const isNew = id === 'new'

  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
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
  const [editForm, setEditForm] = useState<Partial<CustomerDetail>>({})
  const [saving, setSaving] = useState(false)

  // Tags — always-editable, saves immediately
  const [tagIds, setTagIds] = useState<string[]>([])
  const [tagSaving, setTagSaving] = useState(false)

  useEffect(() => {
    if (customer) setTagIds((customer.tags ?? []).map((t) => t.id))
  }, [customer])

  async function handleTagsChange(newIds: string[]) {
    setTagIds(newIds)
    if (!customer?.id) return
    setTagSaving(true)
    try {
      await fetch(`/api/crm/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_ids: newIds }),
      })
    } finally { setTagSaving(false) }
  }

  // Create form state
  const [createForm, setCreateForm] = useState<CreateForm>({
    name: '', client_status: '', assigned_to: '', phone: '', website: '', linkedin: '', email_domains: '', description: '',
  })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (isNew) return
    fetch(`/api/crm/customers/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return }
        setCustomer(data)
      })
      .catch(() => setError('Failed to load customer'))
      .finally(() => setLoading(false))
  }, [id, isNew])

  function startEdit() {
    if (!customer) return
    setEditForm({ ...customer })
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setEditForm({})
  }

  function handleEditChange(field: string, value: string) {
    setEditForm((prev) => ({ ...prev, [field]: value || null }))
  }

  async function saveEdit() {
    if (!customer) return
    setSaving(true)
    try {
      const res = await fetch(`/api/crm/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Save failed'); return }
      setCustomer((prev) => prev ? { ...prev, ...data } : prev)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.name.trim()) { setCreateError('Name is required'); return }
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/crm/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          client_status: createForm.client_status || null,
          assigned_to: createForm.assigned_to || null,
          phone: createForm.phone || null,
          website: createForm.website || null,
          linkedin: createForm.linkedin || null,
          email_domains: createForm.email_domains || null,
          description: createForm.description || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error ?? 'Create failed'); return }
      router.push(`/crm/customers/${data.id}`)
    } finally {
      setCreating(false)
    }
  }

  // ── Create form ─────────────────────────────────────────────────────────────
  if (isNew) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Link href="/crm/customers" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Customers
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">New Customer</h1>
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          {createError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{createError}</div>}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Name <span className="text-red-500">*</span></label>
            <input type="text" value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} required
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Status</label>
            <select value={createForm.client_status} onChange={(e) => setCreateForm((p) => ({ ...p, client_status: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
              <option value="">— Select —</option>
              <option>Prospective</option>
              <option>Active</option>
              <option>Former</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Assigned To</label>
            <select value={createForm.assigned_to} onChange={(e) => setCreateForm((p) => ({ ...p, assigned_to: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
              <option value="">— Unassigned —</option>
              {crmUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.display_name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Phone</label>
              <input type="tel" value={createForm.phone} onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Website</label>
              <input type="url" value={createForm.website} onChange={(e) => setCreateForm((p) => ({ ...p, website: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Description</label>
            <textarea rows={3} value={createForm.description} onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={creating}
              className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-xl disabled:opacity-60 transition-colors">
              {creating ? 'Creating…' : 'Create Customer'}
            </button>
            <Link href="/crm/customers" className="px-5 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    )
  }

  // ── Loading / error ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-slate-100 rounded w-32" />
          <div className="h-32 bg-slate-100 rounded-2xl" />
          <div className="h-64 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href="/crm/customers" className="text-sm text-slate-500 hover:text-slate-700">← Customers</Link>
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error ?? 'Customer not found'}</div>
      </div>
    )
  }

  // ── Detail page ─────────────────────────────────────────────────────────────
  const ef = editForm as Partial<CustomerDetail>

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Back */}
      <Link href="/crm/customers" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Customers
      </Link>

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 truncate">{customer.name}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {customer.client_status && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[customer.client_status] ?? 'bg-slate-100 text-slate-600'}`}>
                  {customer.client_status}
                </span>
              )}
              {customer.assigned_user && (
                <span className="text-sm text-slate-500">Owner: <span className="text-slate-700 font-medium">{customer.assigned_user.display_name}</span></span>
              )}
              {customer.phone && <span className="text-sm text-slate-500">{customer.phone}</span>}
              {customer.website && (
                <a href={customer.website} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-700 hover:underline">
                  {customer.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>
          <button
            onClick={() => router.push(`/crm/opportunities/new?customer_id=${customer.id}&customer_name=${encodeURIComponent(customer.name)}`)}
            className="flex-shrink-0 px-3 py-1.5 border border-purple-300 text-purple-700 text-sm font-medium rounded-lg hover:bg-purple-50 transition-colors"
          >
            + Opportunity
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5">
        {(['details', 'related', 'activity'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg capitalize transition-colors ${
              activeTab === tab ? 'bg-purple-700 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab}
            {tab === 'related' && customer.contacts.length + customer.opportunities.length + customer.files.length > 0 && (
              <span className="ml-1.5 text-xs opacity-70">
                {customer.contacts.length + customer.opportunities.length + customer.files.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Details Tab ── */}
      {activeTab === 'details' && (
        <div className="space-y-5">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {/* Section header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700">Organization Info</h2>
            {!editing ? (
              <button onClick={startEdit} className="px-3 py-1.5 text-xs font-semibold border border-slate-300 text-slate-600 rounded-lg hover:bg-white transition-colors">
                Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={saving} className="px-3 py-1.5 text-xs font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-60 transition-colors">
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={cancelEdit} className="px-3 py-1.5 text-xs font-semibold border border-slate-300 text-slate-600 rounded-lg hover:bg-white transition-colors">
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="p-6 grid grid-cols-2 gap-5">
            {editing ? (
              <>
                <FieldInput label="Name" name="name" value={(ef.name as string) ?? ''} onChange={handleEditChange} />
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Status</label>
                  <select value={(ef.client_status as string) ?? ''} onChange={(e) => handleEditChange('client_status', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                    <option value="">— Select —</option>
                    <option>Prospective</option>
                    <option>Active</option>
                    <option>Former</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Assigned To</label>
                  <select value={(ef.assigned_to as string) ?? ''} onChange={(e) => handleEditChange('assigned_to', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                    <option value="">— Unassigned —</option>
                    {crmUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.display_name}</option>
                    ))}
                  </select>
                </div>
                <FieldInput label="Phone" name="phone" value={(ef.phone as string) ?? ''} onChange={handleEditChange} type="tel" />
                <FieldInput label="Website" name="website" value={(ef.website as string) ?? ''} onChange={handleEditChange} type="url" />
                <FieldInput label="LinkedIn" name="linkedin" value={(ef.linkedin as string) ?? ''} onChange={handleEditChange} type="url" />
                <FieldInput label="Email Domains" name="email_domains" value={(ef.email_domains as string) ?? ''} onChange={handleEditChange} />
                <div className="col-span-2">
                  <FieldInput label="Description" name="description" value={(ef.description as string) ?? ''} onChange={handleEditChange} textarea />
                </div>
                <div className="col-span-2 border-t border-slate-100 pt-5 mt-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Billing Address</div>
                  <div className="grid grid-cols-2 gap-4">
                    <FieldInput label="Address 1" name="billing_address1" value={(ef.billing_address1 as string) ?? ''} onChange={handleEditChange} />
                    <FieldInput label="Address 2" name="billing_address2" value={(ef.billing_address2 as string) ?? ''} onChange={handleEditChange} />
                    <FieldInput label="City" name="billing_city" value={(ef.billing_city as string) ?? ''} onChange={handleEditChange} />
                    <FieldInput label="State" name="billing_state" value={(ef.billing_state as string) ?? ''} onChange={handleEditChange} />
                    <FieldInput label="ZIP" name="billing_zip" value={(ef.billing_zip as string) ?? ''} onChange={handleEditChange} />
                    <FieldInput label="Country" name="billing_country" value={(ef.billing_country as string) ?? ''} onChange={handleEditChange} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <Field label="Phone" value={customer.phone} />
                <Field label="Website" value={customer.website} />
                <Field label="LinkedIn" value={customer.linkedin} />
                <Field label="Email Domains" value={customer.email_domains} />
                <div className="col-span-2">
                  <Field label="Description" value={customer.description} />
                </div>
                {(customer.billing_address1 || customer.billing_city) && (
                  <div className="col-span-2 border-t border-slate-100 pt-4">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Billing Address</div>
                    <div className="text-sm text-slate-800">
                      {[customer.billing_address1, customer.billing_address2, customer.billing_city && `${customer.billing_city}, ${customer.billing_state} ${customer.billing_zip}`, customer.billing_country].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Arcon Program Data section */}
          <div className="border-t border-slate-100">
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Arcon Program Data</h2>
            </div>
            <div className="p-6 grid grid-cols-2 gap-5">
              {editing ? (
                <>
                  <FieldInput label="General Logo Color" name="general_logo_color" value={(ef.general_logo_color as string) ?? ''} onChange={handleEditChange} />
                  <FieldInput label="Formal PMS Colors" name="formal_pms_colors" value={(ef.formal_pms_colors as string) ?? ''} onChange={handleEditChange} />
                  <div className="col-span-2">
                    <FieldInput label="Artwork Notes" name="artwork_notes" value={(ef.artwork_notes as string) ?? ''} onChange={handleEditChange} textarea />
                  </div>
                </>
              ) : (
                <>
                  <Field label="General Logo Color" value={customer.general_logo_color} />
                  <Field label="Formal PMS Colors" value={customer.formal_pms_colors} />
                  <div className="col-span-2">
                    <Field label="Artwork Notes" value={customer.artwork_notes} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="border-t border-slate-100 px-6 py-4 bg-slate-50 flex gap-6 text-xs text-slate-400">
            <span>Created {new Date(customer.created_at).toLocaleDateString()} by {customer.created_by_user?.display_name ?? '—'}</span>
            <span>Updated {new Date(customer.updated_at).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Tags card — always editable */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <h2 className="text-sm font-semibold text-slate-700">Tags</h2>
            </div>
            {tagSaving && <span className="text-xs text-slate-400">Saving…</span>}
          </div>
          <div className="p-4">
            <TagPicker value={tagIds} onChange={handleTagsChange} placeholder="Add tags to this customer…" />
          </div>
        </div>
        </div>
      )}

      {/* ── Related Tab ── */}
      {activeTab === 'related' && (
        <div className="space-y-5">
          {/* Contacts */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Contacts ({customer.contacts.length})</h2>
              <button onClick={() => router.push(`/crm/contacts/new?customer_id=${customer.id}`)}
                className="text-xs font-semibold text-purple-700 hover:text-purple-900">
                + Add
              </button>
            </div>
            {customer.contacts.length === 0
              ? <div className="px-5 py-6 text-sm text-slate-400 text-center">No contacts linked to this customer.</div>
              : <div className="divide-y divide-slate-100">
                  {customer.contacts.map((c) => (
                    <div key={c.id} onClick={() => router.push(`/crm/contacts/${c.id}`)}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-700 flex-shrink-0">
                        {c.first_name[0]}{c.last_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800">{c.first_name} {c.last_name}</div>
                        {c.title && <div className="text-xs text-slate-400">{c.title}</div>}
                      </div>
                      <div className="text-xs text-slate-400 hidden md:block">{c.email ?? ''}</div>
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* Opportunities */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Opportunities ({customer.opportunities.length})</h2>
              <button onClick={() => router.push(`/crm/opportunities/new?customer_id=${customer.id}&customer_name=${encodeURIComponent(customer.name)}`)}
                className="text-xs font-semibold text-purple-700 hover:text-purple-900">
                + Add
              </button>
            </div>
            {customer.opportunities.length === 0
              ? <div className="px-5 py-6 text-sm text-slate-400 text-center">No opportunities yet.</div>
              : <div className="divide-y divide-slate-100">
                  {customer.opportunities.map((o) => (
                    <div key={o.id} onClick={() => router.push(`/crm/opportunities/${o.id}`)}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800">{o.name}</div>
                        <div className="text-xs text-slate-400">{o.pipeline_stage ?? 'No stage'}</div>
                      </div>
                      <div className="text-right">
                        {o.value != null && <div className="text-sm font-semibold text-slate-700">${o.value.toLocaleString()}</div>}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${OPP_STATUS_BADGE[o.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {o.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* Files */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Files ({customer.files.length})</h2>
            </div>
            {customer.files.length === 0
              ? <div className="px-5 py-6 text-sm text-slate-400 text-center">No files attached.</div>
              : <div className="divide-y divide-slate-100">
                  {customer.files.map((f) => (
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
          Task activity for this customer will appear here once the Tasks feature is complete.{' '}
          <button onClick={() => router.push(`/crm/tasks?customer_id=${customer.id}`)} className="text-purple-700 hover:underline">View tasks →</button>
        </div>
      )}
    </div>
  )
}
