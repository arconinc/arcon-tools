'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import TagPicker from '@/components/crm/TagPicker'
import { CreateTaskModal } from '@/components/crm/CreateTaskModal'
import { CrmDetailActions } from '@/components/crm/CrmDetailActions'
import { TaskCreatedToast } from '@/components/crm/TaskCreatedToast'
import { Modal, Field, FieldInput, SocialIcon } from '@/components/ui'
import { formatPhoneInput } from '@/lib/phone'
import { useFormValidation, inputCls, selectCls, FieldError } from '@/lib/form-validation'
import { CrmForm } from '@/types'
import { getCustomerFormsByState, getGeneralForms, US_STATES } from '@/lib/forms-utils'
import { formatBytes } from '@/lib/format'
import { customerStatusBadge, opportunityStatusBadge } from '@/lib/badges'
import { buildCompanySummary } from '@/lib/customer/helpers'
import { useCustomer, useCrmUsers, useCrmTags, type CustomerDetail, type BrandDataLocal, type TagOption } from '@/hooks'

type DropdownUser = { id: string; display_name: string; email: string }

type CreateForm = {
  name: string; client_status: string; assigned_to: string; phone: string; website: string
  linkedin: string; email_domains: string; description: string
  commissioned_client: string; tax_exempt: string
  billing_address1: string; billing_city: string; billing_state: string; billing_zip: string
  orderer_first_name: string; orderer_last_name: string; orderer_email: string
  ap_first_name: string; ap_last_name: string; ap_email: string
}

export default function CustomerDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const isNew = id === 'new'

  const { customer, loading, error, setCustomer } = useCustomer(isNew ? null : id)
  const { data: crmUsers = [] } = useCrmUsers()
  const { data: allCrmTags = [] } = useCrmTags()
  const [activeTab, setActiveTab] = useState<'details' | 'related' | 'activity' | 'artwork' | 'specs'>('details')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<CustomerDetail>>({})
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [taskCreatedToastOpen, setTaskCreatedToastOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [tagIds, setTagIds] = useState<string[]>([])
  const [tagSaving, setTagSaving] = useState(false)
  const [aturianError, setAturianError] = useState<string | null>(null)

  const [createTagIds, setCreateTagIds] = useState<string[]>([])
  const { errors: createErrors, validate: validateCreate, clearError: clearCreateError } = useFormValidation<CreateForm>()

  const [showAddContact, setShowAddContact] = useState(false)
  const [addContactForm, setAddContactForm] = useState({ first_name: '', last_name: '', email: '', phone: '', title: '', department: '' })
  const [addContactSaving, setAddContactSaving] = useState(false)
  const [addContactError, setAddContactError] = useState<string | null>(null)

  const [brandData, setBrandData] = useState<BrandDataLocal | null>(null)
  const [brandFetching, setBrandFetching] = useState(false)
  const [brandError, setBrandError] = useState<string | null>(null)
  const [brandShowFull, setBrandShowFull] = useState(false)

  const [taxForms, setTaxForms] = useState<CrmForm[]>([])
  const [taxState, setTaxState] = useState('')
  const [taxLogging, setTaxLogging] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/forms').then(r => r.json()).then(d => setTaxForms(d.forms ?? [])).catch(() => {})
  }, [])

  // Artwork tab state
  type ArtworkItem = {
    id: string; customer_id: string; name: string; description: string | null
    file_name: string | null; file_size: number | null; mime_type: string | null
    width: number | null; height: number | null; url: string
    cloudinary_public_id: string | null; cloudinary_resource_type: string | null
    thumbnail_url: string | null; is_drive_link: boolean
    dropbox_url: string | null; is_dropbox_file: boolean
    added_by: string; created_at: string; updated_at: string
  }
  const [artwork, setArtwork] = useState<ArtworkItem[]>([])
  const [artworkLoaded, setArtworkLoaded] = useState(false)
  const [artworkLoading, setArtworkLoading] = useState(false)
  const [showArtworkModal, setShowArtworkModal] = useState(false)
  const [artworkMode, setArtworkMode] = useState<'upload' | 'drive' | 'dropbox'>('upload')
  const [artworkFile, setArtworkFile] = useState<File | null>(null)
  const [artworkName, setArtworkName] = useState('')
  const [artworkDesc, setArtworkDesc] = useState('')
  const [artworkDriveUrl, setArtworkDriveUrl] = useState('')
  const [artworkDropboxUrl, setArtworkDropboxUrl] = useState('')
  const [artworkUploading, setArtworkUploading] = useState(false)
  const [artworkError, setArtworkError] = useState<string | null>(null)
  const [vectorizingIds, setVectorizingIds] = useState<Set<string>>(new Set())

  // Specs tab state
  type SpecRow = {
    id: string; item_name: string; item_number: string | null; item_image_url: string | null
    vendor: string | null; status: string; date_sent: string | null; follow_up_date: string | null
    po_number: string | null; csr_name: string | null
  }
  const [specs, setSpecs] = useState<SpecRow[]>([])
  const [specsLoaded, setSpecsLoaded] = useState(false)
  const [specsLoading, setSpecsLoading] = useState(false)

  async function loadSpecs() {
    if (!customer || specsLoaded) return
    setSpecsLoading(true)
    try {
      const res = await fetch(`/api/marketing/specs?customer_id=${customer.id}&limit=200`)
      if (res.ok) { const d = await res.json(); setSpecs(d.specs ?? d) }
    } finally {
      setSpecsLoading(false)
      setSpecsLoaded(true)
    }
  }

  async function loadArtwork() {
    if (!customer || artworkLoaded) return
    setArtworkLoading(true)
    try {
      const res = await fetch(`/api/marketing/artwork?customer_id=${customer.id}`)
      if (res.ok) setArtwork(await res.json())
    } finally {
      setArtworkLoading(false)
      setArtworkLoaded(true)
    }
  }

  async function handleArtworkSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customer) return
    setArtworkUploading(true)
    setArtworkError(null)
    try {
      let payload: Record<string, unknown> = {
        customer_id: customer.id,
        name: artworkName,
        description: artworkDesc || null,
        is_drive_link: artworkMode === 'drive',
      }

      if (artworkMode === 'upload' && artworkFile) {
        const form = new FormData()
        form.append('file', artworkFile)
        form.append('customer_id', customer.id)
        const uploadRes = await fetch('/api/marketing/artwork/upload', { method: 'POST', body: form })
        if (!uploadRes.ok) {
          const err = await uploadRes.json()
          setArtworkError(err.error ?? 'Upload failed')
          return
        }
        const uploaded = await uploadRes.json()
        payload = { ...payload, ...uploaded }
      } else if (artworkMode === 'drive') {
        payload.url = artworkDriveUrl
      } else if (artworkMode === 'dropbox') {
        const isDropboxFile = !artworkDropboxUrl.includes('/fo/')
        payload.url = artworkDropboxUrl
        payload.dropbox_url = artworkDropboxUrl
        payload.is_dropbox_file = isDropboxFile
      }

      const saveRes = await fetch('/api/marketing/artwork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!saveRes.ok) {
        const err = await saveRes.json()
        setArtworkError(err.error ?? 'Save failed')
        return
      }
      const saved = await saveRes.json()
      setArtwork((prev) => [saved, ...prev])
      setShowArtworkModal(false)
      setArtworkFile(null)
      setArtworkName('')
      setArtworkDesc('')
      setArtworkDriveUrl('')
      setArtworkDropboxUrl('')
      setArtworkMode('upload')
    } finally {
      setArtworkUploading(false)
    }
  }

  async function handleVectorize(item: ArtworkItem) {
    setVectorizingIds((prev) => new Set(prev).add(item.id))
    try {
      const res = await fetch(`/api/marketing/artwork/${item.id}/vectorize`)
      if (!res.ok) {
        alert('Vectorize failed. Check that this is a supported image type.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${item.name}.eps`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setVectorizingIds((prev) => {
        const s = new Set(prev)
        s.delete(item.id)
        return s
      })
    }
  }

  async function handleArtworkDelete(id: string) {
    if (!confirm('Delete this artwork?')) return
    const res = await fetch(`/api/marketing/artwork/${id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      setArtwork((prev) => prev.filter((a) => a.id !== id))
    }
  }

  useEffect(() => {
    if (customer) setTagIds((customer.tags ?? []).map((t) => t.id))
    if (customer?.brand_data) setBrandData(customer.brand_data)
  }, [customer])

  async function fetchBrandData() {
    if (!customer) return
    setBrandFetching(true)
    setBrandError(null)
    try {
      const res = await fetch('/api/marketing/brand-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: 'customer', entity_id: customer.id }),
      })
      const data = await res.json()
      if (!res.ok) { setBrandError(data.message ?? 'Failed to fetch brand data.'); return }
      setBrandData(data.brand_data)
      setCustomer((prev) => prev ? { ...prev, logo_url: data.brand_data.logo_url, brand_data: data.brand_data } : prev)
    } finally { setBrandFetching(false) }
  }

  const ATURIAN_TAG_NAME = 'Add to Aturian'

  async function handleTagsChange(newIds: string[]) {
    setAturianError(null)
    if (customer) {
      const addedIds = newIds.filter((tid) => !tagIds.includes(tid))
      if (addedIds.length > 0) {
        const aturianTag = allCrmTags.find(
          (t) => t.name.trim().toLowerCase() === ATURIAN_TAG_NAME.toLowerCase()
        )
        if (aturianTag && addedIds.includes(aturianTag.id)) {
          const missing: string[] = []
          if (!customer.name?.trim()) missing.push('Company Name')
          if (!customer.phone?.trim()) missing.push('Corporate Phone')
          if (!customer.billing_address1?.trim()) missing.push('Billing Address')
          if (!customer.assigned_to) missing.push('Sales Consultant (Assigned To)')
          if (!customer.commissioned_client?.trim()) missing.push('Commissioned Client')
          if (customer.tax_exempt === null || customer.tax_exempt === undefined) missing.push('Tax Exempt')
          const hasAPContact = customer.contacts.some(
            (c) => c.department === 'Accounting' && c.email?.trim()
          )
          if (!hasAPContact) missing.push('AP Contact (Accounting dept. contact with email)')

          if (missing.length > 0) {
            setAturianError(
              `Cannot add "Add to Aturian" — complete these first: ${missing.join(', ')}`
            )
            return
          }
        }
      }
    }
    setTagIds(newIds)
    if (!customer?.id) return
    setTagSaving(true)
    try {
      await fetch(`/api/marketing/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_ids: newIds }),
      })
    } finally { setTagSaving(false) }
  }

  async function logFormDelivery(formId: string) {
    if (!customer?.id) return
    setTaxLogging(formId)
    try {
      await fetch(`/api/admin/forms/${formId}/delivery-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customer.id, delivery_method: 'download' }),
      })
    } finally {
      setTaxLogging(null)
    }
  }

  const [createForm, setCreateForm] = useState<CreateForm>({
    name: '', client_status: '', assigned_to: '', phone: '', website: '', linkedin: '', email_domains: '', description: '', commissioned_client: '', tax_exempt: '',
    billing_address1: '', billing_city: '', billing_state: '', billing_zip: '',
    orderer_first_name: '', orderer_last_name: '', orderer_email: '',
    ap_first_name: '', ap_last_name: '', ap_email: '',
  })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (customer?.billing_state && !taxState) setTaxState(customer.billing_state)
  }, [customer, taxState])

  function startEdit() {
    if (!customer) return
    setEditForm({ ...customer })
    setAturianError(null)
    setEditing(true)
  }

  function cancelEdit() { setEditing(false); setEditForm({}); setAturianError(null) }

  function handleEditChange(field: string, value: string) {
    const formatted = field === 'phone' ? formatPhoneInput(value) : value
    setEditForm((prev) => ({ ...prev, [field]: formatted || null }))
  }

  function handleEditBoolChange(field: string, value: boolean) {
    setEditForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault()
    if (!customer) return
    if (!addContactForm.first_name.trim() || !addContactForm.last_name.trim()) {
      setAddContactError('First name and last name are required')
      return
    }
    setAddContactSaving(true)
    setAddContactError(null)
    try {
      const res = await fetch('/api/marketing/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addContactForm, customer_id: customer.id }),
      })
      const data = await res.json()
      if (!res.ok) { setAddContactError(data.error ?? 'Failed to create contact'); return }
      setCustomer((prev) => prev ? { ...prev, contacts: [...prev.contacts, data] } : prev)
      setShowAddContact(false)
      setAddContactForm({ first_name: '', last_name: '', email: '', phone: '', title: '', department: '' })
    } finally { setAddContactSaving(false) }
  }

  async function saveEdit() {
    if (!customer) return
    setSaving(true)
    try {
      const res = await fetch(`/api/marketing/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Save failed'); return }
      setCustomer((prev) => prev ? { ...prev, ...data } : prev)
      setEditing(false)
    } finally { setSaving(false) }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()

    const aturianTag = allCrmTags.find((t) => t.name.trim().toLowerCase() === 'add to aturian')
    const aturianActive = !!(aturianTag && createTagIds.includes(aturianTag.id))

    const req = (msg: string) => ({ test: (v: string) => !!v?.trim(), message: msg })
    const rules = {
      name: [req('Company name is required')],
      ...(aturianActive && {
        assigned_to:         [{ test: (v: string) => !!v, message: 'Sales Consultant is required' }],
        commissioned_client: [req('Commissioned Client is required')],
        tax_exempt:          [{ test: (v: string) => v === 'yes' || v === 'no', message: 'Please select Yes or No' }],
        billing_address1:    [req('Street address is required')],
        billing_city:        [req('City is required')],
        billing_state:       [req('State is required')],
        billing_zip:         [req('ZIP code is required')],
        phone:               [req('Corporate phone is required')],
        orderer_first_name:  [req('Orderer first name is required')],
        orderer_last_name:   [req('Orderer last name is required')],
        orderer_email:       [req('Orderer email is required')],
        ap_first_name:       [req('AP contact first name is required')],
        ap_last_name:        [req('AP contact last name is required')],
        ap_email:            [req('AP contact email is required')],
      }),
    }

    if (!validateCreate(createForm, rules)) return

    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/marketing/customers', {
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
          commissioned_client: createForm.commissioned_client || null,
          tax_exempt: createForm.tax_exempt === 'yes',
          billing_address1: createForm.billing_address1 || null,
          billing_city: createForm.billing_city || null,
          billing_state: createForm.billing_state || null,
          billing_zip: createForm.billing_zip || null,
          tag_ids: createTagIds,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error ?? 'Create failed'); return }

      const customerId = data.id
      const contactCreates: Promise<unknown>[] = []

      if (createForm.orderer_first_name.trim() && createForm.orderer_last_name.trim()) {
        contactCreates.push(fetch('/api/marketing/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: createForm.orderer_first_name.trim(),
            last_name: createForm.orderer_last_name.trim(),
            email: createForm.orderer_email || null,
            customer_id: customerId,
          }),
        }))
      }

      if (createForm.ap_first_name.trim() && createForm.ap_last_name.trim()) {
        contactCreates.push(fetch('/api/marketing/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: createForm.ap_first_name.trim(),
            last_name: createForm.ap_last_name.trim(),
            email: createForm.ap_email || null,
            department: 'Accounting',
            customer_id: customerId,
          }),
        }))
      }

      await Promise.all(contactCreates)
      router.push(`/marketing/customers/${customerId}`)
    } finally { setCreating(false) }
  }

  // ── Create form ─────────────────────────────────────────────────────────────
  if (isNew) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-6">
        <Link href="/marketing/customers" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Customers
        </Link>
        <h1 className="text-xl font-bold text-slate-900 mb-4">New Customer</h1>
        <form onSubmit={handleCreate} className="space-y-4">
          {createError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{createError}</div>}

          {/* Company Info */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Company Information</h2>
            </div>
            <div className="px-5 py-4 grid grid-cols-3 gap-4">
              <div className="col-span-3">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Company Name <span className="text-red-500">*</span></label>
                <p className="text-xs text-slate-400 italic mb-1">Full Corporate Company Name</p>
                <input type="text" value={createForm.name}
                  onChange={(e) => { setCreateForm((p) => ({ ...p, name: e.target.value })); clearCreateError('name') }}
                  className={inputCls(createErrors.name)} />
                <FieldError error={createErrors.name} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Sales Consultant</label>
                <select value={createForm.assigned_to}
                  onChange={(e) => { setCreateForm((p) => ({ ...p, assigned_to: e.target.value })); clearCreateError('assigned_to') }}
                  className={selectCls(createErrors.assigned_to)}>
                  <option value="">— Unassigned —</option>
                  {crmUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.display_name}</option>
                  ))}
                </select>
                <FieldError error={createErrors.assigned_to} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</label>
                <select value={createForm.client_status}
                  onChange={(e) => setCreateForm((p) => ({ ...p, client_status: e.target.value }))}
                  className={selectCls()}>
                  <option value="">— Select —</option>
                  <option>Prospective</option>
                  <option>Active</option>
                  <option>Former</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Commissioned Client</label>
                <select value={createForm.commissioned_client}
                  onChange={(e) => { setCreateForm((p) => ({ ...p, commissioned_client: e.target.value })); clearCreateError('commissioned_client') }}
                  className={selectCls(createErrors.commissioned_client)}>
                  <option value="">— Select —</option>
                  <option>Standard</option>
                  <option>Standard with Split</option>
                  <option>Standard Non Credit Card Store</option>
                </select>
                <FieldError error={createErrors.commissioned_client} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Tax Exempt</label>
                <div className="flex gap-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="tax_exempt" value="yes"
                      checked={createForm.tax_exempt === 'yes'}
                      onChange={() => { setCreateForm((p) => ({ ...p, tax_exempt: 'yes' })); clearCreateError('tax_exempt') }}
                      className="w-4 h-4 border-slate-300 text-purple-600 focus:ring-purple-400" />
                    <span className="text-sm text-slate-700">Yes</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="tax_exempt" value="no"
                      checked={createForm.tax_exempt === 'no'}
                      onChange={() => { setCreateForm((p) => ({ ...p, tax_exempt: 'no' })); clearCreateError('tax_exempt') }}
                      className="w-4 h-4 border-slate-300 text-purple-600 focus:ring-purple-400" />
                    <span className="text-sm text-slate-700">No</span>
                  </label>
                </div>
                <FieldError error={createErrors.tax_exempt} />
              </div>
                  <p className="text-xs text-slate-400 italic mb-2 col-span-3">Is the customer tax exempt? (need to include exemption form to Amy — cannot mark exempt without correct paperwork)</p>
            </div>
          </div>

          {/* Address & Contact */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Address &amp; Contact</h2>
            </div>
            <div className="px-5 py-4 grid grid-cols-3 gap-4">
              <div className="col-span-3">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Street Address</label>
                <input type="text" value={createForm.billing_address1}
                  onChange={(e) => { setCreateForm((p) => ({ ...p, billing_address1: e.target.value })); clearCreateError('billing_address1') }}
                  className={inputCls(createErrors.billing_address1)} />
                <FieldError error={createErrors.billing_address1} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">City</label>
                <input type="text" value={createForm.billing_city}
                  onChange={(e) => { setCreateForm((p) => ({ ...p, billing_city: e.target.value })); clearCreateError('billing_city') }}
                  className={inputCls(createErrors.billing_city)} />
                <FieldError error={createErrors.billing_city} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">State</label>
                <input type="text" value={createForm.billing_state}
                  onChange={(e) => { setCreateForm((p) => ({ ...p, billing_state: e.target.value })); clearCreateError('billing_state') }}
                  className={inputCls(createErrors.billing_state)} />
                <FieldError error={createErrors.billing_state} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">ZIP</label>
                <input type="text" value={createForm.billing_zip}
                  onChange={(e) => { setCreateForm((p) => ({ ...p, billing_zip: e.target.value })); clearCreateError('billing_zip') }}
                  className={inputCls(createErrors.billing_zip)} />
                <FieldError error={createErrors.billing_zip} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Corporate Phone</label>
                <input type="tel" value={createForm.phone}
                  onChange={(e) => { setCreateForm((p) => ({ ...p, phone: formatPhoneInput(e.target.value) })); clearCreateError('phone') }}
                  className={inputCls(createErrors.phone)} />
                <FieldError error={createErrors.phone} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Website</label>
                <input type="url" value={createForm.website}
                  onChange={(e) => setCreateForm((p) => ({ ...p, website: e.target.value }))}
                  className={inputCls()} />
              </div>
            </div>
          </div>

          {/* Orderer Contact */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Orderer Contact</h2>
              <p className="text-xs text-slate-400 mt-0.5">Will be created as a linked contact on this customer.</p>
            </div>
            <div className="px-5 py-4 grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">First Name</label>
                <input type="text" value={createForm.orderer_first_name}
                  onChange={(e) => { setCreateForm((p) => ({ ...p, orderer_first_name: e.target.value })); clearCreateError('orderer_first_name') }}
                  className={inputCls(createErrors.orderer_first_name)} />
                <FieldError error={createErrors.orderer_first_name} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Last Name</label>
                <input type="text" value={createForm.orderer_last_name}
                  onChange={(e) => { setCreateForm((p) => ({ ...p, orderer_last_name: e.target.value })); clearCreateError('orderer_last_name') }}
                  className={inputCls(createErrors.orderer_last_name)} />
                <FieldError error={createErrors.orderer_last_name} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Email</label>
                <input type="email" value={createForm.orderer_email}
                  onChange={(e) => { setCreateForm((p) => ({ ...p, orderer_email: e.target.value })); clearCreateError('orderer_email') }}
                  className={inputCls(createErrors.orderer_email)} />
                <FieldError error={createErrors.orderer_email} />
              </div>
            </div>
          </div>

          {/* AP Contact */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">AP Contact</h2>
              <p className="text-xs text-slate-400 mt-0.5">Will be created as an Accounting-department contact on this customer.</p>
            </div>
            <div className="px-5 py-4 grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">First Name</label>
                <input type="text" value={createForm.ap_first_name}
                  onChange={(e) => { setCreateForm((p) => ({ ...p, ap_first_name: e.target.value })); clearCreateError('ap_first_name') }}
                  className={inputCls(createErrors.ap_first_name)} />
                <FieldError error={createErrors.ap_first_name} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Last Name</label>
                <input type="text" value={createForm.ap_last_name}
                  onChange={(e) => { setCreateForm((p) => ({ ...p, ap_last_name: e.target.value })); clearCreateError('ap_last_name') }}
                  className={inputCls(createErrors.ap_last_name)} />
                <FieldError error={createErrors.ap_last_name} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Email</label>
                <input type="email" value={createForm.ap_email}
                  onChange={(e) => { setCreateForm((p) => ({ ...p, ap_email: e.target.value })); clearCreateError('ap_email') }}
                  className={inputCls(createErrors.ap_email)} />
                <FieldError error={createErrors.ap_email} />
              </div>
                <p className="text-xs text-slate-400 italic col-span-3">Accounts Payable Contact – Must be someone in Accounting</p>
            </div>
          </div>

          {/* Tags */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Tags</h2>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-start gap-3 p-3.5 bg-purple-50 border border-purple-200 rounded-xl">
                <svg className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-purple-800">
                    If this customer needs to be added to Aturian, click the button below. This will require all fields on this form to be filled out completely before saving.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      let tag = allCrmTags.find((t) => t.name.trim().toLowerCase() === 'add to aturian')
                      if (!tag) {
                        const res = await fetch('/api/marketing/tags', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: 'Add to Aturian' }),
                        })
                        if (res.ok) {
                          tag = await res.json()
                          setAllCrmTags((prev) => [...prev, tag!])
                        }
                      }
                      if (tag && !createTagIds.includes(tag.id)) {
                        setCreateTagIds((prev) => [...prev, tag!.id])
                      }
                    }}
                    disabled={!!allCrmTags.find((t) => t.name.trim().toLowerCase() === 'add to aturian') && createTagIds.includes(allCrmTags.find((t) => t.name.trim().toLowerCase() === 'add to aturian')!.id)}
                    className="mt-2.5 px-3 py-1.5 text-xs font-semibold bg-purple-700 hover:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    {allCrmTags.find((t) => t.name.trim().toLowerCase() === 'add to aturian') && createTagIds.includes(allCrmTags.find((t) => t.name.trim().toLowerCase() === 'add to aturian')!.id)
                      ? '✓ "Add to Aturian" tag added'
                      : 'Add "Add to Aturian" Tag'}
                  </button>
                </div>
              </div>
              <TagPicker value={createTagIds} onChange={setCreateTagIds} placeholder="Add tags…" />
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={creating}
              className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-xl disabled:opacity-60 transition-colors">
              {creating ? 'Creating…' : 'Create Customer'}
            </button>
            <Link href="/marketing/customers" className="px-5 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
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
      <div className="px-6 py-5">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-slate-100 rounded w-32" />
          <div className="h-24 bg-slate-100 rounded-2xl" />
          <div className="h-64 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="px-6 py-5">
        <Link href="/marketing/customers" className="text-sm text-slate-500 hover:text-slate-700">← Customers</Link>
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error ?? 'Customer not found'}</div>
      </div>
    )
  }

  // ── Detail page ─────────────────────────────────────────────────────────────
  const ef = editForm as Partial<CustomerDetail>

  return (
    <div className="px-6 py-5">
      {/* Back */}
      <Link href="/marketing/customers" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Customers
      </Link>

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-3">
        <div className="flex items-center gap-4">
          {customer.logo_url && (
            <img
              src={customer.logo_url}
              alt={`${customer.name} logo`}
              className="h-10 w-auto max-w-[180px] object-contain flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 truncate">{customer.name}</h1>
              {customer.client_status && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${customerStatusBadge(customer.client_status)}`}>
                  {customer.client_status}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 flex-wrap">
              {customer.assigned_user && (
                <span className="text-xs text-slate-500">Owner: <span className="text-slate-700 font-medium">{customer.assigned_user.display_name}</span></span>
              )}
              {customer.phone && <span className="text-xs text-slate-500">{customer.phone}</span>}
              {customer.website && (
                <a href={customer.website} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-700 hover:underline">
                  {customer.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              onClick={() => router.push(`/marketing/opportunities/new?customer_id=${customer.id}&customer_name=${encodeURIComponent(customer.name)}`)}
              className="px-3 py-1.5 border border-purple-300 text-purple-700 text-sm font-medium rounded-lg hover:bg-purple-50 transition-colors"
            >
              + Opportunity
            </button>
            <CrmDetailActions onCreateTask={() => setCreateTaskOpen(true)} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-3">
        {(['details', 'related', 'activity', 'artwork', 'specs'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab)
              if (tab === 'artwork') loadArtwork()
              if (tab === 'specs') loadSpecs()
            }}
            className={`px-4 py-2 text-sm capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab ? 'font-bold text-purple-700 border-purple-700' : 'font-medium text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            {tab}
            {tab === 'related' && customer.contacts.length + customer.opportunities.length + customer.files.length > 0 && (
              <span className="ml-1.5 text-xs opacity-70">
                {customer.contacts.length + customer.opportunities.length + customer.files.length}
              </span>
            )}
            {tab === 'artwork' && artworkLoaded && artwork.length > 0 && (
              <span className="ml-1.5 text-xs opacity-70">{artwork.length}</span>
            )}
            {tab === 'specs' && specsLoaded && specs.length > 0 && (
              <span className="ml-1.5 text-xs opacity-70">{specs.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Details Tab ── */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-3 gap-4 items-start">
          {/* Main column — 66% */}
          <div className="col-span-2 space-y-3">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              {/* Section header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
                <h2 className="text-sm font-semibold text-slate-700">Organization Info</h2>
                {!editing ? (
                  <button onClick={startEdit} className="px-3 py-1 text-xs font-semibold border border-slate-300 text-slate-600 rounded-lg hover:bg-white transition-colors">
                    Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={saving} className="px-3 py-1 text-xs font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-60 transition-colors">
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={cancelEdit} className="px-3 py-1 text-xs font-semibold border border-slate-300 text-slate-600 rounded-lg hover:bg-white transition-colors">
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div className="px-5 py-4 grid grid-cols-3 gap-3">
                {editing ? (
                  <>
                    <FieldInput label="Name" name="name" value={(ef.name as string) ?? ''} onChange={handleEditChange} />
                    <FieldInput label="Phone" name="phone" value={(ef.phone as string) ?? ''} onChange={handleEditChange} type="tel" />
                    <FieldInput label="Website" name="website" value={(ef.website as string) ?? ''} onChange={handleEditChange} type="url" />
                    <FieldInput label="LinkedIn" name="linkedin" value={(ef.linkedin as string) ?? ''} onChange={handleEditChange} type="url" />
                    <FieldInput label="Email Domains" name="email_domains" value={(ef.email_domains as string) ?? ''} onChange={handleEditChange} />
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Status</label>
                      <select value={(ef.client_status as string) ?? ''} onChange={(e) => handleEditChange('client_status', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                        <option value="">— Select —</option>
                        <option>Prospective</option>
                        <option>Active</option>
                        <option>Former</option>
                      </select>
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Assigned To</label>
                      <select value={(ef.assigned_to as string) ?? ''} onChange={(e) => handleEditChange('assigned_to', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                        <option value="">— Unassigned —</option>
                        {crmUsers.map((u) => (
                          <option key={u.id} value={u.id}>{u.display_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <FieldInput label="Description" name="description" value={(ef.description as string) ?? ''} onChange={handleEditChange} textarea />
                    </div>
                  </>
                ) : (
                  <>
                    <Field label="Phone" value={customer.phone} />
                    <Field label="Website" value={customer.website} link />
                    <Field label="LinkedIn" value={customer.linkedin} link />
                    <Field label="Email Domains" value={customer.email_domains} />
                    <div className="col-span-3">
                      <Field label="Description" value={customer.description} />
                    </div>
                  </>
                )}
              </div>

              {/* Billing & Shipping Address — side by side */}
              {(editing || customer.billing_address1 || customer.billing_city || customer.shipping_address1 || customer.shipping_city) && (
                <div className="border-t border-slate-100">
                  <div className="grid grid-cols-2 divide-x divide-slate-100">
                    {/* Billing */}
                    <div>
                      <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                        <div className="w-0.5 h-3.5 bg-purple-300 rounded-full" />
                        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Billing Address</h3>
                      </div>
                      <div className="px-5 py-4">
                        {editing ? (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2"><FieldInput label="Address 1" name="billing_address1" value={(ef.billing_address1 as string) ?? ''} onChange={handleEditChange} /></div>
                            <div className="col-span-2"><FieldInput label="Address 2" name="billing_address2" value={(ef.billing_address2 as string) ?? ''} onChange={handleEditChange} /></div>
                            <FieldInput label="City" name="billing_city" value={(ef.billing_city as string) ?? ''} onChange={handleEditChange} />
                            <FieldInput label="State" name="billing_state" value={(ef.billing_state as string) ?? ''} onChange={handleEditChange} />
                            <FieldInput label="ZIP" name="billing_zip" value={(ef.billing_zip as string) ?? ''} onChange={handleEditChange} />
                            <FieldInput label="Country" name="billing_country" value={(ef.billing_country as string) ?? ''} onChange={handleEditChange} />
                          </div>
                        ) : (
                          <div className="text-sm text-slate-800 leading-snug">
                            {customer.billing_address1 && <div>{customer.billing_address1}</div>}
                            {customer.billing_address2 && <div>{customer.billing_address2}</div>}
                            {(customer.billing_city || customer.billing_state || customer.billing_zip) && (
                              <div>
                                {[customer.billing_city, customer.billing_state].filter(Boolean).join(', ')}
                                {customer.billing_zip ? ` ${customer.billing_zip}` : ''}
                              </div>
                            )}
                            {customer.billing_country && <div>{customer.billing_country}</div>}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Shipping */}
                    <div>
                      <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                        <div className="w-0.5 h-3.5 bg-purple-300 rounded-full" />
                        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Shipping Address</h3>
                      </div>
                      <div className="px-5 py-4">
                        {editing ? (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2"><FieldInput label="Address 1" name="shipping_address1" value={(ef.shipping_address1 as string) ?? ''} onChange={handleEditChange} /></div>
                            <div className="col-span-2"><FieldInput label="Address 2" name="shipping_address2" value={(ef.shipping_address2 as string) ?? ''} onChange={handleEditChange} /></div>
                            <FieldInput label="City" name="shipping_city" value={(ef.shipping_city as string) ?? ''} onChange={handleEditChange} />
                            <FieldInput label="State" name="shipping_state" value={(ef.shipping_state as string) ?? ''} onChange={handleEditChange} />
                            <FieldInput label="ZIP" name="shipping_zip" value={(ef.shipping_zip as string) ?? ''} onChange={handleEditChange} />
                            <FieldInput label="Country" name="shipping_country" value={(ef.shipping_country as string) ?? ''} onChange={handleEditChange} />
                          </div>
                        ) : (
                          <div className="text-sm text-slate-800 leading-snug">
                            {customer.shipping_address1 && <div>{customer.shipping_address1}</div>}
                            {customer.shipping_address2 && <div>{customer.shipping_address2}</div>}
                            {(customer.shipping_city || customer.shipping_state || customer.shipping_zip) && (
                              <div>
                                {[customer.shipping_city, customer.shipping_state].filter(Boolean).join(', ')}
                                {customer.shipping_zip ? ` ${customer.shipping_zip}` : ''}
                              </div>
                            )}
                            {customer.shipping_country && <div>{customer.shipping_country}</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Arcon Program Data section */}
              <div className="border-t border-slate-100">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-700">Arcon Program Data</h2>
                </div>
                <div className="px-5 py-4 grid grid-cols-2 gap-3">
                  {editing ? (
                    <>
                      <FieldInput label="General Logo Color" name="general_logo_color" value={(ef.general_logo_color as string) ?? ''} onChange={handleEditChange} />
                      <FieldInput label="Formal PMS Colors" name="formal_pms_colors" value={(ef.formal_pms_colors as string) ?? ''} onChange={handleEditChange} />
                      <div className="col-span-2">
                        <FieldInput label="Artwork Notes" name="artwork_notes" value={(ef.artwork_notes as string) ?? ''} onChange={handleEditChange} textarea rows={6} />
                      </div>
                    </>
                  ) : (
                    <>
                      <Field label="General Logo Color" value={customer.general_logo_color} />
                      <Field label="Formal PMS Colors" value={customer.formal_pms_colors} />
                      <div className="col-span-2">
                        <Field label="Artwork Notes" value={customer.artwork_notes} multiline />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Aturian Onboarding */}
              <div className="border-t border-slate-100">
                <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <div className="w-0.5 h-3.5 bg-purple-300 rounded-full" />
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Aturian Onboarding</h3>
                </div>
                <div className="px-5 py-4 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Sales Consultant</div>
                    <div className="text-sm text-slate-800">{customer.assigned_user?.display_name ?? <span className="text-slate-400">—</span>}</div>
                  </div>
                  {editing ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Commissioned Client</label>
                      <select value={(ef.commissioned_client as string) ?? ''}
                        onChange={(e) => handleEditChange('commissioned_client', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                        <option value="">— Select —</option>
                        <option>Standard</option>
                        <option>Standard with Split</option>
                        <option>Standard Non Credit Card Store</option>
                      </select>
                    </div>
                  ) : (
                    <Field label="Commissioned Client" value={customer.commissioned_client} />
                  )}
                  {editing ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tax Exempt</label>
                      <div className="flex gap-4">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="edit_tax_exempt" value="yes"
                            checked={(ef.tax_exempt as boolean) === true}
                            onChange={() => handleEditBoolChange('tax_exempt', true)}
                            className="w-4 h-4 border-slate-300 text-purple-600 focus:ring-purple-400" />
                          <span className="text-sm text-slate-700">Yes</span>
                        </label>
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="edit_tax_exempt" value="no"
                            checked={(ef.tax_exempt as boolean) === false}
                            onChange={() => handleEditBoolChange('tax_exempt', false)}
                            className="w-4 h-4 border-slate-300 text-purple-600 focus:ring-purple-400" />
                          <span className="text-sm text-slate-700">No</span>
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Tax Exempt</div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                        customer.tax_exempt ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {customer.tax_exempt ? 'Yes' : 'No'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {(editing || customer.notes) && (
                <div className="border-t border-slate-100">
                  <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                    <div className="w-0.5 h-3.5 bg-purple-300 rounded-full" />
                    <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Additional Information</h3>
                  </div>
                  <div className="px-5 py-4">
                    {editing
                      ? <FieldInput label="Notes" name="notes" value={(ef.notes as string) ?? ''} onChange={handleEditChange} textarea rows={6} />
                      : <Field label="Notes" value={customer.notes} multiline />
                    }
                  </div>
                </div>
              )}

              {/* Meta */}
              <div className="border-t border-slate-100 px-5 py-3 bg-slate-50 flex gap-6 text-xs text-slate-400">
                <span>Created {new Date(customer.created_at).toLocaleDateString()} by {customer.created_by_user?.display_name ?? '—'}</span>
                <span>Updated {new Date(customer.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Sidebar — 25% */}
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
                {aturianError && (
                  <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 leading-relaxed">
                    {aturianError}
                  </div>
                )}
              </div>
            </div>

            {/* Tax Documentation card */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h2 className="text-sm font-semibold text-slate-700">Tax Documentation</h2>
              </div>
              <div className="p-4 space-y-3">
                {/* Tax exempt status */}
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${customer.tax_exempt ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {customer.tax_exempt ? 'Tax Exempt' : 'Not Tax Exempt'}
                  </span>
                </div>

                {/* W9 */}
                {(() => {
                  const w9Forms = getGeneralForms(taxForms)
                  if (w9Forms.length === 0) return null
                  return (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Our W9</p>
                      <div className="space-y-1.5">
                        {w9Forms.map(form => (
                          <a
                            key={form.id}
                            href={form.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => logFormDelivery(form.id)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 hover:text-purple-900"
                          >
                            {taxLogging === form.id ? 'Opening…' : `↓ ${form.name}`}
                          </a>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Customer exemption forms */}
                {customer.tax_exempt && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Exemption Forms</p>
                    <select
                      value={taxState}
                      onChange={e => setTaxState(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white mb-2"
                    >
                      <option value="">Select a state…</option>
                      {Object.entries(US_STATES).map(([abbr, name]) => (
                        <option key={abbr} value={abbr}>{name}</option>
                      ))}
                    </select>
                    {taxState && (() => {
                      const stateForms = getCustomerFormsByState(taxState, taxForms)
                      if (stateForms.length > 0) return (
                        <div className="space-y-2">
                          {stateForms.map(form => (
                            <div key={form.id}>
                              {form.description && (
                                <p className="text-xs text-slate-400 mb-0.5">{form.description}</p>
                              )}
                              <a
                                href={form.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => logFormDelivery(form.id)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 hover:text-purple-900"
                              >
                                {taxLogging === form.id ? 'Opening…' : `↓ ${form.name}`}
                              </a>
                            </div>
                          ))}
                        </div>
                      )
                      return (
                        <p className="text-xs text-slate-400 italic">No exemption form for {US_STATES[taxState] ?? taxState}. Contact Amy for guidance.</p>
                      )
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Brand Insights card */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <h2 className="text-sm font-semibold text-slate-700">Brand Insights</h2>
                </div>
                <button
                  onClick={fetchBrandData}
                  disabled={brandFetching || !customer.website}
                  className="px-2.5 py-1 text-xs font-semibold bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-lg transition-colors"
                  title={!customer.website ? 'Add a website URL to this customer first' : undefined}
                >
                  {brandFetching ? 'Fetching…' : brandData ? 'Refresh' : 'Fetch'}
                </button>
              </div>
              <div className="p-4">
                {brandData && <div className="text-xs text-slate-400 mb-3">Last fetched {new Date(brandData.fetched_at).toLocaleDateString()}</div>}
                {brandError && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 mb-3">{brandError}</div>
                )}
                {!brandData && !brandError && (
                  <p className="text-xs text-slate-400">
                    {customer.website
                      ? 'Click "Fetch" to enrich this record with logo, description, and company information.'
                      : 'Add a website URL to enable brand data enrichment.'}
                  </p>
                )}
                {brandData && (
                  <div className="space-y-3">
                    {brandData.links && brandData.links.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {brandData.links.map((l) => (
                          <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title={l.name}
                            className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center transition-colors flex-shrink-0">
                            <SocialIcon name={l.name} />
                          </a>
                        ))}
                      </div>
                    )}
                    {brandData.logo_url && (
                      <img
                        src={brandData.logo_url}
                        alt={`${customer.name} logo`}
                        className="h-10 w-auto max-w-[180px] object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    )}
                    {brandData.description && (
                      <p className="text-xs text-slate-700 leading-relaxed">{brandData.description}</p>
                    )}
                    {buildCompanySummary(brandData.company) && (
                      <p className="text-xs text-slate-600 leading-relaxed italic">{buildCompanySummary(brandData.company)}</p>
                    )}
                    {brandData.long_description && (
                      <div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {brandShowFull || brandData.long_description.length <= 200
                            ? brandData.long_description
                            : brandData.long_description.slice(0, 200) + '…'}
                        </p>
                        {brandData.long_description.length > 200 && (
                          <button onClick={() => setBrandShowFull((v) => !v)} className="mt-1 text-xs text-purple-700 hover:underline">
                            {brandShowFull ? 'Show less' : 'Read more'}
                          </button>
                        )}
                      </div>
                    )}
                    {brandData.colors && brandData.colors.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Colors</span>
                        <div className="flex gap-1.5 flex-wrap">
                          {brandData.colors.map((c, i) => (
                            <div key={i} title={c.hex} className="w-4 h-4 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: c.hex }} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Related Tab ── */}
      {activeTab === 'related' && (
        <div className="grid grid-cols-2 gap-4">
          {/* Contacts */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Contacts ({customer.contacts.length})</h2>
              <button onClick={() => { setShowAddContact(true); setAddContactError(null) }}
                className="text-xs font-semibold text-purple-700 hover:text-purple-900">
                + Add
              </button>
            </div>
            {customer.contacts.length === 0
              ? <div className="px-5 py-5 text-sm text-slate-400 text-center">No contacts linked.</div>
              : <div className="divide-y divide-slate-100">
                  {customer.contacts.map((c) => (
                    <div key={c.id} onClick={() => router.push(`/marketing/contacts/${c.id}`)}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors">
                      <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-700 flex-shrink-0">
                        {c.first_name[0]}{c.last_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800">{c.first_name} {c.last_name}</div>
                        {(c.title || c.department) && (
                          <div className="text-xs text-slate-400">{[c.title, c.department].filter(Boolean).join(' · ')}</div>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 truncate max-w-[120px]">{c.email ?? ''}</div>
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* Opportunities */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Opportunities ({customer.opportunities.length})</h2>
              <button onClick={() => router.push(`/marketing/opportunities/new?customer_id=${customer.id}&customer_name=${encodeURIComponent(customer.name)}`)}
                className="text-xs font-semibold text-purple-700 hover:text-purple-900">
                + Add
              </button>
            </div>
            {customer.opportunities.length === 0
              ? <div className="px-5 py-5 text-sm text-slate-400 text-center">No opportunities yet.</div>
              : <div className="divide-y divide-slate-100">
                  {customer.opportunities.map((o) => (
                    <div key={o.id} onClick={() => router.push(`/marketing/opportunities/${o.id}`)}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800">{o.name}</div>
                        <div className="text-xs text-slate-400">{o.pipeline_stage ?? 'No stage'}</div>
                      </div>
                      <div className="text-right">
                        {o.value != null && <div className="text-sm font-semibold text-slate-700">${o.value.toLocaleString()}</div>}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${opportunityStatusBadge(o.status)}`}>
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
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Files ({customer.files.length})</h2>
            </div>
            {customer.files.length === 0
              ? <div className="px-5 py-5 text-sm text-slate-400 text-center">No files attached.</div>
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

          {/* Stores */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Stores ({(customer.stores ?? []).length})</h2>
            </div>
            {(customer.stores ?? []).length === 0
              ? <div className="px-5 py-5 text-sm text-slate-400 text-center">No stores linked.</div>
              : <div className="divide-y divide-slate-100">
                  {(customer.stores ?? []).map((s) => (
                    <div key={s.id} onClick={() => router.push(`/stores/${s.id}`)}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800">{s.store_name}</div>
                        <div className="text-xs text-slate-400">{s.store_id}</div>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
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
          <button onClick={() => router.push(`/marketing/tasks?customer_id=${customer.id}`)} className="text-purple-700 hover:underline">View tasks →</button>
        </div>
      )}

      {/* ── Artwork Tab ── */}
      {activeTab === 'artwork' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Artwork{artworkLoaded ? ` (${artwork.length})` : ''}
            </h2>
            <button
              onClick={() => { setShowArtworkModal(true); setArtworkError(null) }}
              className="px-3 py-1.5 bg-purple-700 text-white text-sm font-semibold rounded-lg hover:bg-purple-800 transition-colors"
            >
              + Add Artwork
            </button>
          </div>

          {/* Loading */}
          {artworkLoading && (
            <div className="text-center py-10 text-sm text-slate-400">Loading artwork…</div>
          )}

          {/* Empty state */}
          {artworkLoaded && !artworkLoading && artwork.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-400">
              No artwork yet. Upload files or link Google Drive assets.
            </div>
          )}

          {/* Grid */}
          {artwork.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {artwork.map((item) => {
                const thumb = item.thumbnail_url ?? null
                const ext = item.file_name?.split('.').pop()?.toUpperCase() ?? '?'
                const date = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

                return (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
                    {/* Preview area */}
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
                      {item.is_drive_link ? (
                        <div className="h-36 bg-slate-50 flex items-center justify-center">
                          {/* Google Drive icon */}
                          <svg className="w-14 h-14" viewBox="0 0 87.3 78" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 50H0c0 1.55.4 3.1 1.2 4.5L6.6 66.85z" fill="#0066DA"/>
                            <path d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 45.5c-.8 1.4-1.2 2.95-1.2 4.5h27.5L43.65 25z" fill="#00AC47"/>
                            <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H60.1l5.9 11.5 7.55 12.3z" fill="#EA4335"/>
                            <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2L43.65 25z" fill="#00832D"/>
                            <path d="M60.1 50H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2L60.1 50z" fill="#2684FC"/>
                            <path d="M73.4 26.5l-12.85-22.3c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 60.1 50h27.45c0-1.55-.4-3.1-1.2-4.5L73.4 26.5z" fill="#FFBA00"/>
                          </svg>
                        </div>
                      ) : item.dropbox_url && !item.is_dropbox_file ? (
                        <div className="h-36 bg-slate-50 flex items-center justify-center">
                          {/* Dropbox folder icon */}
                          <svg className="w-14 h-14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 5.25a1.5 1.5 0 011.5-1.5h6l1.5 1.5H18a1.5 1.5 0 011.5 1.5v11a1.5 1.5 0 01-1.5 1.5H4.5a1.5 1.5 0 01-1.5-1.5V5.25z" fill="#0061FF"/>
                          </svg>
                        </div>
                      ) : thumb ? (
                        <div className="h-36 bg-slate-100 overflow-hidden relative">
                          <img src={thumb} alt={item.name} className="w-full h-full object-contain"
                            onError={(e) => {
                              const img = e.target as HTMLImageElement
                              img.style.display = 'none'
                              const fallback = img.nextElementSibling as HTMLElement | null
                              if (fallback) fallback.style.display = 'flex'
                            }}
                          />
                          <div className="absolute inset-0 hidden items-center justify-center bg-slate-50">
                            <span className="text-2xl font-black text-slate-300">{ext}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-36 bg-slate-50 flex items-center justify-center">
                          <span className="text-2xl font-black text-slate-300">{ext}</span>
                        </div>
                      )}
                    </a>

                    {/* Metadata */}
                    <div className="p-3 flex flex-col gap-1 flex-1">
                      <div className="text-sm font-semibold text-slate-800 truncate" title={item.name}>{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-slate-500 line-clamp-2">{item.description}</div>
                      )}
                      <div className="text-xs text-slate-400 mt-auto pt-1 space-y-0.5">
                        {item.is_drive_link
                          ? <span>Google Drive</span>
                          : item.dropbox_url
                          ? <span>{item.is_dropbox_file ? 'Dropbox File' : 'Dropbox Folder'}</span>
                          : (
                            <span>
                              {item.mime_type?.split('/')[1]?.toUpperCase() ?? ext}
                              {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
                              {item.file_size ? ` · ${formatBytes(item.file_size)}` : ''}
                            </span>
                          )
                        }
                        <div>{date}</div>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        {!item.is_drive_link && !item.dropbox_url &&
                          item.cloudinary_resource_type === 'image' &&
                          (item.mime_type === 'image/png' || item.mime_type === 'image/jpeg') && (
                          <button
                            onClick={() => handleVectorize(item)}
                            disabled={vectorizingIds.has(item.id)}
                            className="text-xs text-purple-600 hover:text-purple-800 transition-colors disabled:opacity-50"
                          >
                            {vectorizingIds.has(item.id) ? 'Vectorizing…' : 'Vectorize → EPS'}
                          </button>
                        )}
                        <button
                          onClick={() => handleArtworkDelete(item.id)}
                          className="text-xs text-red-500 hover:text-red-700 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Upload Modal */}
          {showArtworkModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-800">Add Artwork</h3>
                  <button onClick={() => setShowArtworkModal(false)} className="text-slate-400 hover:text-slate-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <form onSubmit={handleArtworkSubmit} className="p-6 space-y-4">
                  {/* Mode toggle */}
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button"
                      onClick={() => setArtworkMode('upload')}
                      className={`py-1.5 text-sm font-semibold rounded-lg border transition-colors ${artworkMode === 'upload' ? 'bg-purple-700 text-white border-purple-700' : 'text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                    >Upload File</button>
                    <button type="button"
                      onClick={() => setArtworkMode('drive')}
                      className={`py-1.5 text-sm font-semibold rounded-lg border transition-colors ${artworkMode === 'drive' ? 'bg-purple-700 text-white border-purple-700' : 'text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                    >Google Drive</button>
                    <button type="button"
                      onClick={() => setArtworkMode('dropbox')}
                      className={`py-1.5 text-sm font-semibold rounded-lg border transition-colors ${artworkMode === 'dropbox' ? 'bg-purple-700 text-white border-purple-700' : 'text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                    >Dropbox Link</button>
                  </div>

                  {artworkMode === 'upload' ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">File</label>
                      <input type="file" required
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null
                          setArtworkFile(f)
                          if (f && !artworkName) setArtworkName(f.name.replace(/\.[^.]+$/, ''))
                        }}
                        className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                      />
                    </div>
                  ) : artworkMode === 'drive' ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Google Drive URL</label>
                      <input type="url" required value={artworkDriveUrl} onChange={(e) => setArtworkDriveUrl(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Dropbox URL</label>
                      <input type="url" required value={artworkDropboxUrl} onChange={(e) => setArtworkDropboxUrl(e.target.value)}
                        placeholder="https://www.dropbox.com/..."
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                      />
                      <p className="text-xs text-slate-500 mt-1">Paste a link to a Dropbox file or folder. We'll detect which automatically.</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Name <span className="text-red-400">*</span></label>
                    <input type="text" required value={artworkName} onChange={(e) => setArtworkName(e.target.value)}
                      placeholder="e.g. Primary Logo"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                    <textarea value={artworkDesc} onChange={(e) => setArtworkDesc(e.target.value)}
                      placeholder="Optional notes about this file…"
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                    />
                  </div>

                  {artworkError && (
                    <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{artworkError}</p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setShowArtworkModal(false)}
                      className="flex-1 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >Cancel</button>
                    <button type="submit" disabled={artworkUploading}
                      className="flex-1 py-2 text-sm font-semibold text-white bg-purple-700 rounded-lg hover:bg-purple-800 disabled:opacity-50 transition-colors"
                    >
                      {artworkUploading ? 'Uploading…' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick-Create Contact Modal */}
      {showAddContact && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAddContact(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-slate-800 mb-4">Add Contact</h2>
            <form onSubmit={handleAddContact} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">First Name *</label>
                  <input value={addContactForm.first_name} onChange={(e) => setAddContactForm(p => ({ ...p, first_name: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Last Name *</label>
                  <input value={addContactForm.last_name} onChange={(e) => setAddContactForm(p => ({ ...p, last_name: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Email</label>
                <input type="email" value={addContactForm.email} onChange={(e) => setAddContactForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Phone</label>
                  <input value={addContactForm.phone} onChange={(e) => setAddContactForm(p => ({ ...p, phone: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Title</label>
                  <input value={addContactForm.title} onChange={(e) => setAddContactForm(p => ({ ...p, title: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Department</label>
                <select value={addContactForm.department} onChange={(e) => setAddContactForm(p => ({ ...p, department: e.target.value }))}
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
              {addContactError && <div className="text-xs text-red-600">{addContactError}</div>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={addContactSaving}
                  className="flex-1 py-2 text-sm font-semibold bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-xl transition-colors">
                  {addContactSaving ? 'Adding…' : 'Add Contact'}
                </button>
                <button type="button" onClick={() => setShowAddContact(false)}
                  className="flex-1 py-2 text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Specs Tab ── */}
      {activeTab === 'specs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Spec Samples{specsLoaded ? ` (${specs.length})` : ''}
            </h2>
            <a
              href={`/marketing/specs/new?customerId=${customer.id}`}
              className="px-3 py-1.5 bg-purple-700 text-white text-sm font-semibold rounded-lg hover:bg-purple-800 transition-colors"
              style={{ textDecoration: 'none' }}
            >
              + New Spec
            </a>
          </div>

          {specsLoading && <div className="text-center py-10 text-sm text-slate-400">Loading specs…</div>}

          {specsLoaded && !specsLoading && specs.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-400">
              No spec samples yet for this customer.{' '}
              <a href={`/marketing/specs/new?customerId=${customer.id}`} className="text-purple-700 hover:underline">Create the first one →</a>
            </div>
          )}

          {specs.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Item', 'Vendor', 'Status', 'Date Sent', 'Follow-up', 'CSR'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {specs.map((s, i) => {
                    const statusColors: Record<string, { bg: string; color: string }> = {
                      not_contacted: { bg: '#f1f5f9', color: '#64748b' },
                      artwork: { bg: '#fdf4ff', color: '#7e22ce' },
                      ordered: { bg: '#eff6ff', color: '#1d4ed8' },
                      in_production: { bg: '#fefce8', color: '#a16207' },
                      shipped: { bg: '#fff7ed', color: '#c2410c' },
                      delivered: { bg: '#f0fdf4', color: '#166534' },
                      approved: { bg: '#f3f0ff', color: '#7c3aed' },
                      declined: { bg: '#fef2f2', color: '#b91c1c' },
                      no_response: { bg: '#fafafa', color: '#71717a' },
                    }
                    const sc = statusColors[s.status] ?? { bg: '#f1f5f9', color: '#64748b' }
                    const today = new Date().toISOString().slice(0, 10)
                    const overdue = s.follow_up_date && s.follow_up_date < today && !['approved', 'declined'].includes(s.status)
                    return (
                      <tr key={s.id} style={{ borderBottom: i < specs.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {s.item_image_url ? (
                              <img src={s.item_image_url} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: 32, height: 32, borderRadius: 6, background: '#f1f5f9', flexShrink: 0 }} />
                            )}
                            <div>
                              <a href={`/marketing/specs/${s.id}`} style={{ color: '#1e293b', fontWeight: 600, textDecoration: 'none' }} className="hover:text-purple-700">{s.item_name}</a>
                              {s.item_number && <div style={{ fontSize: 11, color: '#94a3b8' }}>#{s.item_number}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#64748b' }}>{s.vendor ?? '—'}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ background: sc.bg, color: sc.color, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                            {s.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#64748b' }}>
                          {s.date_sent ? new Date(s.date_sent + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', color: overdue ? '#dc2626' : '#64748b', fontWeight: overdue ? 700 : 400 }}>
                          {s.follow_up_date ? new Date(s.follow_up_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#64748b' }}>{s.csr_name ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <CreateTaskModal
        open={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        linkedEntity={{ type: 'customer', id: customer.id, name: customer.name }}
        onCreated={() => setTaskCreatedToastOpen(true)}
      />
      <TaskCreatedToast
        show={taskCreatedToastOpen}
        onClose={() => setTaskCreatedToastOpen(false)}
      />
    </div>
  )
}
