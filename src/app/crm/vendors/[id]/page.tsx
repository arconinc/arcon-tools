'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

type VendorDetail = {
  id: string; name: string; phone: string | null; website: string | null; linkedin: string | null
  description: string | null; tags: string[]
  premier_group_member: boolean; product_line: string | null; specialty: string | null
  arcon_account_number: string | null; online_store: string | null
  arcon_username: string | null; arcon_password: string | null
  customer_service_email: string | null; orders_email: string | null; orders_cutoff: string | null
  rush_order_email: string | null; rush_order_cutoff: string | null; rush_art_email: string | null
  artwork_email: string | null; samples_email: string | null; virtuals_email: string | null
  spec_sample_email: string | null
  created_by: string; created_at: string; updated_at: string
  contacts: { id: string; first_name: string; last_name: string; title: string | null; email: string | null; phone: string | null }[]
  files: { id: string; label: string; url: string; created_at: string }[]
  created_by_user: { id: string; display_name: string; email: string } | null
}

function Field({ label, value, password }: { label: string; value: string | null | undefined; password?: boolean }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-sm text-slate-800">
        {value ? (password ? '••••••••' : value) : <span className="text-slate-400">—</span>}
      </div>
    </div>
  )
}

function FI({ label, name, value, onChange, type = 'text', textarea = false }: {
  label: string; name: string; value: string; onChange: (n: string, v: string) => void; type?: string; textarea?: boolean
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

export default function VendorDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const isNew = id === 'new'

  const [vendor, setVendor] = useState<VendorDetail | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'related' | 'activity'>('details')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<VendorDetail>>({})
  const [saving, setSaving] = useState(false)

  const [createForm, setCreateForm] = useState({ name: '', phone: '', website: '', linkedin: '', description: '', product_line: '', specialty: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (isNew) return
    fetch(`/api/crm/vendors/${id}`)
      .then((r) => r.json())
      .then((data) => { if (data.error) { setError(data.error); return } setVendor(data) })
      .catch(() => setError('Failed to load vendor'))
      .finally(() => setLoading(false))
  }, [id, isNew])

  function startEdit() { if (!vendor) return; setEditForm({ ...vendor }); setEditing(true) }
  function cancelEdit() { setEditing(false); setEditForm({}) }
  function handleEditChange(field: string, value: string | boolean) {
    setEditForm((prev) => ({ ...prev, [field]: typeof value === 'string' ? (value || null) : value }))
  }

  async function saveEdit() {
    if (!vendor) return
    setSaving(true)
    try {
      const res = await fetch(`/api/crm/vendors/${vendor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Save failed'); return }
      setVendor((prev) => prev ? { ...prev, ...data } : prev)
      setEditing(false)
    } finally { setSaving(false) }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.name.trim()) { setCreateError('Name is required'); return }
    setCreating(true); setCreateError(null)
    try {
      const res = await fetch('/api/crm/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          phone: createForm.phone || null, website: createForm.website || null,
          linkedin: createForm.linkedin || null, description: createForm.description || null,
          product_line: createForm.product_line || null, specialty: createForm.specialty || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error ?? 'Create failed'); return }
      router.push(`/crm/vendors/${data.id}`)
    } finally { setCreating(false) }
  }

  if (isNew) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Link href="/crm/vendors" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Vendors
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">New Vendor</h1>
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          {createError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{createError}</div>}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Name <span className="text-red-500">*</span></label>
            <input type="text" value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} required
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
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
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Product Line</label>
              <input type="text" value={createForm.product_line} onChange={(e) => setCreateForm((p) => ({ ...p, product_line: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Specialty</label>
              <input type="text" value={createForm.specialty} onChange={(e) => setCreateForm((p) => ({ ...p, specialty: e.target.value }))}
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
              {creating ? 'Creating…' : 'Create Vendor'}
            </button>
            <Link href="/crm/vendors" className="px-5 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8 animate-pulse space-y-4">
        <div className="h-5 bg-slate-100 rounded w-24" />
        <div className="h-28 bg-slate-100 rounded-2xl" />
        <div className="h-64 bg-slate-100 rounded-2xl" />
      </div>
    )
  }

  if (error || !vendor) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href="/crm/vendors" className="text-sm text-slate-500 hover:text-slate-700">← Vendors</Link>
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error ?? 'Vendor not found'}</div>
      </div>
    )
  }

  const ef = editForm as Partial<VendorDetail>

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <Link href="/crm/vendors" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Vendors
      </Link>

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{vendor.name}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {vendor.premier_group_member && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">Premier Group</span>
              )}
              {vendor.product_line && <span className="text-sm text-slate-500">{vendor.product_line}</span>}
              {vendor.phone && <span className="text-sm text-slate-500">{vendor.phone}</span>}
              {vendor.website && (
                <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-700 hover:underline">
                  {vendor.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5">
        {(['details', 'related', 'activity'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg capitalize transition-colors ${
              activeTab === tab ? 'bg-purple-700 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}>
            {tab}
            {tab === 'related' && vendor.contacts.length + vendor.files.length > 0 && (
              <span className="ml-1.5 text-xs opacity-70">{vendor.contacts.length + vendor.files.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Details Tab */}
      {activeTab === 'details' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {/* Org Info */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700">Organization Info</h2>
            {!editing ? (
              <button onClick={startEdit} className="px-3 py-1.5 text-xs font-semibold border border-slate-300 text-slate-600 rounded-lg hover:bg-white transition-colors">Edit</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={saving} className="px-3 py-1.5 text-xs font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-60 transition-colors">{saving ? 'Saving…' : 'Save'}</button>
                <button onClick={cancelEdit} className="px-3 py-1.5 text-xs font-semibold border border-slate-300 text-slate-600 rounded-lg hover:bg-white transition-colors">Cancel</button>
              </div>
            )}
          </div>
          <div className="p-6 grid grid-cols-2 gap-5">
            {editing ? (
              <>
                <FI label="Name" name="name" value={(ef.name as string) ?? ''} onChange={handleEditChange} />
                <FI label="Phone" name="phone" value={(ef.phone as string) ?? ''} onChange={handleEditChange} type="tel" />
                <FI label="Website" name="website" value={(ef.website as string) ?? ''} onChange={handleEditChange} type="url" />
                <FI label="LinkedIn" name="linkedin" value={(ef.linkedin as string) ?? ''} onChange={handleEditChange} type="url" />
                <div className="col-span-2"><FI label="Description" name="description" value={(ef.description as string) ?? ''} onChange={handleEditChange} textarea /></div>
              </>
            ) : (
              <>
                <Field label="Phone" value={vendor.phone} />
                <Field label="Website" value={vendor.website} />
                <Field label="LinkedIn" value={vendor.linkedin} />
                <div className="col-span-2"><Field label="Description" value={vendor.description} /></div>
              </>
            )}
          </div>

          {/* Vendor-Specific Fields */}
          <div className="border-t border-slate-100">
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Vendor-Specific Fields</h2>
            </div>
            <div className="p-6 grid grid-cols-2 gap-5">
              {editing ? (
                <>
                  <div className="col-span-2 flex items-center gap-3">
                    <input type="checkbox" id="premier" checked={!!(ef.premier_group_member)} onChange={(e) => handleEditChange('premier_group_member', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-400" />
                    <label htmlFor="premier" className="text-sm text-slate-700 font-medium">Premier Group Member</label>
                  </div>
                  <FI label="Product Line" name="product_line" value={(ef.product_line as string) ?? ''} onChange={handleEditChange} />
                  <FI label="Specialty" name="specialty" value={(ef.specialty as string) ?? ''} onChange={handleEditChange} />
                  <FI label="Arcon Account #" name="arcon_account_number" value={(ef.arcon_account_number as string) ?? ''} onChange={handleEditChange} />
                  <FI label="Online Store" name="online_store" value={(ef.online_store as string) ?? ''} onChange={handleEditChange} type="url" />
                  <FI label="Arcon Username" name="arcon_username" value={(ef.arcon_username as string) ?? ''} onChange={handleEditChange} />
                  <FI label="Arcon Password" name="arcon_password" value={(ef.arcon_password as string) ?? ''} onChange={handleEditChange} />
                  <div className="col-span-2 border-t border-slate-100 pt-4">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Contact Emails & Cutoffs</div>
                    <div className="grid grid-cols-2 gap-4">
                      <FI label="Customer Service Email" name="customer_service_email" value={(ef.customer_service_email as string) ?? ''} onChange={handleEditChange} type="email" />
                      <FI label="Orders Email" name="orders_email" value={(ef.orders_email as string) ?? ''} onChange={handleEditChange} type="email" />
                      <FI label="Orders Cutoff" name="orders_cutoff" value={(ef.orders_cutoff as string) ?? ''} onChange={handleEditChange} />
                      <FI label="Rush Order Email" name="rush_order_email" value={(ef.rush_order_email as string) ?? ''} onChange={handleEditChange} type="email" />
                      <FI label="Rush Order Cutoff" name="rush_order_cutoff" value={(ef.rush_order_cutoff as string) ?? ''} onChange={handleEditChange} />
                      <FI label="Rush Art Email" name="rush_art_email" value={(ef.rush_art_email as string) ?? ''} onChange={handleEditChange} type="email" />
                      <FI label="Artwork Email" name="artwork_email" value={(ef.artwork_email as string) ?? ''} onChange={handleEditChange} type="email" />
                      <FI label="Samples Email" name="samples_email" value={(ef.samples_email as string) ?? ''} onChange={handleEditChange} type="email" />
                      <FI label="Virtuals Email" name="virtuals_email" value={(ef.virtuals_email as string) ?? ''} onChange={handleEditChange} type="email" />
                      <FI label="Spec Sample Email" name="spec_sample_email" value={(ef.spec_sample_email as string) ?? ''} onChange={handleEditChange} type="email" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Field label="Product Line" value={vendor.product_line} />
                  <Field label="Specialty" value={vendor.specialty} />
                  <Field label="Arcon Account #" value={vendor.arcon_account_number} />
                  <Field label="Online Store" value={vendor.online_store} />
                  <Field label="Arcon Username" value={vendor.arcon_username} />
                  <Field label="Arcon Password" value={vendor.arcon_password} password />
                  <div className="col-span-2 border-t border-slate-100 pt-4">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Contact Emails & Cutoffs</div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Customer Service Email" value={vendor.customer_service_email} />
                      <Field label="Orders Email" value={vendor.orders_email} />
                      <Field label="Orders Cutoff" value={vendor.orders_cutoff} />
                      <Field label="Rush Order Email" value={vendor.rush_order_email} />
                      <Field label="Rush Order Cutoff" value={vendor.rush_order_cutoff} />
                      <Field label="Rush Art Email" value={vendor.rush_art_email} />
                      <Field label="Artwork Email" value={vendor.artwork_email} />
                      <Field label="Samples Email" value={vendor.samples_email} />
                      <Field label="Virtuals Email" value={vendor.virtuals_email} />
                      <Field label="Spec Sample Email" value={vendor.spec_sample_email} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 px-6 py-4 bg-slate-50 flex gap-6 text-xs text-slate-400">
            <span>Created {new Date(vendor.created_at).toLocaleDateString()} by {vendor.created_by_user?.display_name ?? '—'}</span>
            <span>Updated {new Date(vendor.updated_at).toLocaleDateString()}</span>
          </div>
        </div>
      )}

      {/* Related Tab */}
      {activeTab === 'related' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Contacts ({vendor.contacts.length})</h2>
              <button onClick={() => router.push(`/crm/contacts/new?vendor_id=${vendor.id}`)} className="text-xs font-semibold text-purple-700 hover:text-purple-900">+ Add</button>
            </div>
            {vendor.contacts.length === 0
              ? <div className="px-5 py-6 text-sm text-slate-400 text-center">No contacts linked to this vendor.</div>
              : <div className="divide-y divide-slate-100">
                  {vendor.contacts.map((c) => (
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

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Files ({vendor.files.length})</h2>
            </div>
            {vendor.files.length === 0
              ? <div className="px-5 py-6 text-sm text-slate-400 text-center">No files attached.</div>
              : <div className="divide-y divide-slate-100">
                  {vendor.files.map((f) => (
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

      {/* Activity Tab */}
      {activeTab === 'activity' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-400">
          Task activity for this vendor will appear here once the Tasks feature is complete.{' '}
          <button onClick={() => router.push(`/crm/tasks?vendor_id=${vendor.id}`)} className="text-purple-700 hover:underline">View tasks →</button>
        </div>
      )}
    </div>
  )
}
