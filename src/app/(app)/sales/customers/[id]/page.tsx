'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import TagPicker from '@/components/crm/TagPicker'
import { CreateTaskModal } from '@/components/crm/CreateTaskModal'
import { PlacesCompanyAutocomplete } from '@/components/crm/PlacesCompanyAutocomplete'
import { PlacesAddressAutocomplete } from '@/components/crm/PlacesAddressAutocomplete'
import { TaskCreatedToast } from '@/components/crm/TaskCreatedToast'
import { CallLogCard } from '@/components/crm/CallLogCard'
import { Modal, Field, FieldInput, SocialIcon } from '@/components/ui'
import { CustomerHeader } from '@/components/crm/customer/CustomerHeader'
import { CustomerContactsList } from '@/components/crm/customer/CustomerContactsList'
import { CustomerOpportunitiesList } from '@/components/crm/customer/CustomerOpportunitiesList'
import { CustomerFilesList } from '@/components/crm/customer/CustomerFilesList'
import { CustomerArtworkGrid } from '@/components/crm/customer/CustomerArtworkGrid'
import { ArtworkUploadModal } from '@/components/crm/customer/ArtworkUploadModal'
import { AddContactModal } from '@/components/crm/customer/AddContactModal'
import { formatPhoneInput } from '@/lib/phone'
import { useFormValidation, inputCls, selectCls, FieldError } from '@/lib/form-validation'
import { CrmForm } from '@/types'
import { getCustomerFormsByState, getGeneralForms, US_STATES } from '@/lib/forms-utils'
import { buildCompanySummary } from '@/lib/customer/helpers'
import { useCustomer, useCrmUsers, useArtwork, useCustomerEdit, type CustomerDetail, type BrandDataLocal } from '@/hooks'
import type { PlacesAddress, PlacesDetails } from '@/lib/google-places'

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
  const { data: crmUsersData } = useCrmUsers()
  const crmUsers = crmUsersData ?? []
  const edit = useCustomerEdit(customer, setCustomer)
  const [activeTab, setActiveTab] = useState<'details' | 'related' | 'activity' | 'artwork' | 'specs'>('details')
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [taskCreatedToastOpen, setTaskCreatedToastOpen] = useState(false)

  const [tagIds, setTagIds] = useState<string[]>([])
  const [tagSaving, setTagSaving] = useState(false)

  const [createTagIds, setCreateTagIds] = useState<string[]>([])
  const { errors: createErrors, validate: validateCreate, clearError: clearCreateError } = useFormValidation<CreateForm>()

  const [showAddContact, setShowAddContact] = useState(false)

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

  const [showArtworkModal, setShowArtworkModal] = useState(false)
  const artworkHook = useArtwork(isNew ? null : id)

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

  async function handleTagsChange(newIds: string[]) {
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
  const [apDuplicateError, setApDuplicateError] = useState<string | null>(null)
  const [taxCertificateFile, setTaxCertificateFile] = useState<File | null>(null)
  const [taxCertificateError, setTaxCertificateError] = useState<string | null>(null)

  useEffect(() => {
    if (customer?.billing_state && !taxState) setTaxState(customer.billing_state)
  }, [customer, taxState])

  function applyPlaceToCreateForm(place: PlacesDetails) {
    setCreateForm((prev) => ({
      ...prev,
      name: place.name ?? prev.name,
      phone: place.phone ? formatPhoneInput(place.phone) : prev.phone,
      website: place.website ?? prev.website,
      billing_address1: place.address.address1 ?? prev.billing_address1,
      billing_city: place.address.city ?? prev.billing_city,
      billing_state: place.address.state ?? prev.billing_state,
      billing_zip: place.address.postalCode ?? prev.billing_zip,
    }))
    clearCreateError('name')
    clearCreateError('phone')
    clearCreateError('billing_address1')
    clearCreateError('billing_city')
    clearCreateError('billing_state')
    clearCreateError('billing_zip')
  }

  function applyAddressToEdit(prefix: 'billing' | 'shipping', address: PlacesAddress) {
    edit.handleEditChange(`${prefix}_address1`, address.address1 ?? '')
    edit.handleEditChange(`${prefix}_address2`, address.address2 ?? '')
    edit.handleEditChange(`${prefix}_city`, address.city ?? '')
    edit.handleEditChange(`${prefix}_state`, address.state ?? '')
    edit.handleEditChange(`${prefix}_zip`, address.postalCode ?? '')
    edit.handleEditChange(`${prefix}_country`, address.country ?? '')
  }

  function copyEditAddress(from: 'billing' | 'shipping', to: 'billing' | 'shipping') {
    const fields = ['address1', 'address2', 'city', 'state', 'zip', 'country'] as const
    fields.forEach((field) => {
      edit.handleEditChange(`${to}_${field}`, (ef[`${from}_${field}` as keyof CustomerDetail] as string) ?? '')
    })
  }

  const normalizeContactValue = (value: string) => value.trim().toLowerCase()

  function getDuplicateApContactError(form = createForm) {
    const ordererEmail = normalizeContactValue(form.orderer_email)
    const apEmail = normalizeContactValue(form.ap_email)
    if (ordererEmail && apEmail && ordererEmail === apEmail) return 'AP contact MUST be different then the orderers contact'

    return null
  }

  function validateApContactDifference() {
    setApDuplicateError(getDuplicateApContactError())
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()

    const req = (msg: string) => ({ test: (v: string) => !!v?.trim(), message: msg })
    const rules = {
      name: [req('Company name is required')],
    }

    if (!validateCreate(createForm, rules)) return
    const duplicateError = getDuplicateApContactError()
    if (duplicateError) {
      setApDuplicateError(duplicateError)
      return
    }
    if (createForm.tax_exempt === 'yes' && !taxCertificateFile) {
      setTaxCertificateError('Tax Certificate is required when Tax Exempt is Yes')
      return
    }

    setCreating(true)
    setCreateError(null)
    setTaxCertificateError(null)
    try {
      let taxCertificateUrl: string | null = null
      if (createForm.tax_exempt === 'yes' && taxCertificateFile) {
        const uploadForm = new FormData()
        uploadForm.append('file', taxCertificateFile)
        const uploadRes = await fetch('/api/marketing/upload', { method: 'POST', body: uploadForm })
        const uploadData = await uploadRes.json()
        if (!uploadRes.ok) { setCreateError(uploadData.error ?? 'Tax certificate upload failed'); return }
        taxCertificateUrl = uploadData.url
      }

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
          tax_certificate_url: taxCertificateUrl,
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
      router.push(`/sales/customers/${customerId}`)
    } finally { setCreating(false) }
  }

  // ── Create form ─────────────────────────────────────────────────────────────
  if (isNew) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-6">
        <Link href="/sales/customers" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Customers
        </Link>
        <h1 className="text-xl font-bold text-slate-900 mb-4">New Customer</h1>
        <form onSubmit={handleCreate} className="space-y-4">
          {createError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{createError}</div>}

          {/* Company Info */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-visible">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 rounded-t-2xl">
              <h2 className="text-sm font-semibold text-slate-700">Company Information</h2>
            </div>
            <div className="px-5 py-4 grid grid-cols-3 gap-4">
              <div className="col-span-3">
                <PlacesCompanyAutocomplete
                  value={createForm.name}
                  onChange={(value) => { setCreateForm((p) => ({ ...p, name: value })); clearCreateError('name') }}
                  onPlaceSelect={applyPlaceToCreateForm}
                  inputClassName={inputCls(createErrors.name)}
                  labelClassName="block text-xs font-semibold text-slate-500 uppercase tracking-wide"
                  required
                />
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
              <div className="col-span-3">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Tax Exempt</label>
                <p className="mt-0.5 mb-2 text-xs text-slate-400">Select Yes only when customer has current exemption paperwork. A tax certificate must be uploaded and will be saved to related files as &quot;Tax Certificate&quot;.</p>
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
                      onChange={() => { setCreateForm((p) => ({ ...p, tax_exempt: 'no' })); setTaxCertificateFile(null); setTaxCertificateError(null); clearCreateError('tax_exempt') }}
                      className="w-4 h-4 border-slate-300 text-purple-600 focus:ring-purple-400" />
                    <span className="text-sm text-slate-700">No</span>
                  </label>
                </div>
                <FieldError error={createErrors.tax_exempt} />
              </div>
              {createForm.tax_exempt === 'yes' && (
                <div className="col-span-3">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Tax Certificate</label>
                  <input
                    type="file"
                    required
                    onChange={(e) => { setTaxCertificateFile(e.target.files?.[0] ?? null); setTaxCertificateError(null) }}
                    className={`block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-purple-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-purple-700 hover:file:bg-purple-100 ${taxCertificateError ? 'text-red-700' : ''}`}
                  />
                  {taxCertificateError && <p className="mt-1 text-xs text-red-600">{taxCertificateError}</p>}
                  <p className="mt-1 text-xs text-slate-400">Upload customer exemption certificate. It will appear in related files as Tax Certificate.</p>
                </div>
              )}
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
                  onChange={(e) => { setCreateForm((p) => ({ ...p, orderer_first_name: e.target.value })); clearCreateError('orderer_first_name'); clearCreateError('ap_email'); setApDuplicateError(null) }}
                  onBlur={validateApContactDifference}
                  className={inputCls(createErrors.orderer_first_name)} />
                <FieldError error={createErrors.orderer_first_name} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Last Name</label>
                <input type="text" value={createForm.orderer_last_name}
                  onChange={(e) => { setCreateForm((p) => ({ ...p, orderer_last_name: e.target.value })); clearCreateError('orderer_last_name'); clearCreateError('ap_email'); setApDuplicateError(null) }}
                  onBlur={validateApContactDifference}
                  className={inputCls(createErrors.orderer_last_name)} />
                <FieldError error={createErrors.orderer_last_name} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Email</label>
                <input type="email" value={createForm.orderer_email}
                  onChange={(e) => { setCreateForm((p) => ({ ...p, orderer_email: e.target.value })); clearCreateError('orderer_email'); clearCreateError('ap_email'); setApDuplicateError(null) }}
                  onBlur={validateApContactDifference}
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
                  onChange={(e) => { setCreateForm((p) => ({ ...p, ap_first_name: e.target.value })); clearCreateError('ap_first_name'); clearCreateError('ap_email'); setApDuplicateError(null) }}
                  onBlur={validateApContactDifference}
                  className={inputCls(createErrors.ap_first_name)} />
                <FieldError error={createErrors.ap_first_name} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Last Name</label>
                <input type="text" value={createForm.ap_last_name}
                  onChange={(e) => { setCreateForm((p) => ({ ...p, ap_last_name: e.target.value })); clearCreateError('ap_last_name'); clearCreateError('ap_email'); setApDuplicateError(null) }}
                  onBlur={validateApContactDifference}
                  className={inputCls(createErrors.ap_last_name)} />
                <FieldError error={createErrors.ap_last_name} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Email</label>
                <input type="email" value={createForm.ap_email}
                  onChange={(e) => { setCreateForm((p) => ({ ...p, ap_email: e.target.value })); clearCreateError('ap_email'); setApDuplicateError(null) }}
                  onBlur={validateApContactDifference}
                  className={inputCls(createErrors.ap_email ?? apDuplicateError ?? undefined)} />
                <FieldError error={createErrors.ap_email ?? apDuplicateError ?? undefined} />
              </div>
                <p className="text-xs text-slate-400 italic col-span-3">Accounts Payable Contact – Must be someone in Accounting. AP contact MUST be different then the orderers contact.</p>
            </div>
          </div>

          {/* Tags */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Tags</h2>
            </div>
            <div className="px-5 py-4 space-y-3">
              <TagPicker value={createTagIds} onChange={setCreateTagIds} placeholder="Add tags…" />
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={creating}
              className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-xl disabled:opacity-60 transition-colors">
              {creating ? 'Creating…' : 'Create Customer'}
            </button>
            <Link href="/sales/customers" className="px-5 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
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
        <Link href="/sales/customers" className="text-sm text-slate-500 hover:text-slate-700">← Customers</Link>
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error ?? 'Customer not found'}</div>
      </div>
    )
  }

  // ── Detail page ─────────────────────────────────────────────────────────────
  const ef = edit.editForm as Partial<CustomerDetail>

  return (
    <div className="px-6 py-5">
      {/* Back */}
      <Link href="/sales/customers" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Customers
      </Link>

      <CustomerHeader
        name={customer.name}
        logo_url={customer.logo_url}
        client_status={customer.client_status}
        assigned_user={customer.assigned_user}
        phone={customer.phone}
        website={customer.website}
        id={customer.id}
        onCreateOpportunity={() =>
          router.push(
            `/sales/opportunities/new?customer_id=${customer.id}&customer_name=${encodeURIComponent(customer.name)}`
          )
        }
        onCreateTask={() => setCreateTaskOpen(true)}
      />

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-3">
        {(['details', 'related', 'activity', 'artwork', 'specs'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab)
              if (tab === 'artwork') artworkHook.load()
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
            {tab === 'artwork' && artworkHook.loaded && artworkHook.artwork.length > 0 && (
              <span className="ml-1.5 text-xs opacity-70">{artworkHook.artwork.length}</span>
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
                {!edit.editing ? (
                  <button onClick={edit.startEdit} className="px-3 py-1 text-xs font-semibold border border-slate-300 text-slate-600 rounded-lg hover:bg-white transition-colors">
                    Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={edit.saveEdit} disabled={edit.saving} className="px-3 py-1 text-xs font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-60 transition-colors">
                      {edit.saving ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={edit.cancelEdit} className="px-3 py-1 text-xs font-semibold border border-slate-300 text-slate-600 rounded-lg hover:bg-white transition-colors">
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div className="px-5 py-4 grid grid-cols-3 gap-3">
                {edit.editing ? (
                  <>
                    <FieldInput label="Name" name="name" value={(ef.name as string) ?? ''} onChange={edit.handleEditChange} />
                    <FieldInput label="Phone" name="phone" value={(ef.phone as string) ?? ''} onChange={edit.handleEditChange} type="tel" />
                    <FieldInput label="Website" name="website" value={(ef.website as string) ?? ''} onChange={edit.handleEditChange} type="url" />
                    <FieldInput label="LinkedIn" name="linkedin" value={(ef.linkedin as string) ?? ''} onChange={edit.handleEditChange} type="url" />
                    <FieldInput label="Email Domains" name="email_domains" value={(ef.email_domains as string) ?? ''} onChange={edit.handleEditChange} />
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Status</label>
                      <select value={(ef.client_status as string) ?? ''} onChange={(e) => edit.handleEditChange('client_status', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                        <option value="">— Select —</option>
                        <option>Prospective</option>
                        <option>Active</option>
                        <option>Former</option>
                      </select>
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Assigned To</label>
                      <select value={(ef.assigned_to as string) ?? ''} onChange={(e) => edit.handleEditChange('assigned_to', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                        <option value="">— Unassigned —</option>
                        {crmUsers.map((u) => (
                          <option key={u.id} value={u.id}>{u.display_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <FieldInput label="Description" name="description" value={(ef.description as string) ?? ''} onChange={edit.handleEditChange} textarea />
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
              {(edit.editing || customer.billing_address1 || customer.billing_city || customer.shipping_address1 || customer.shipping_city) && (
                <div className="border-t border-slate-100">
                  <div className="grid grid-cols-2 divide-x divide-slate-100">
                    {/* Billing */}
                    <div>
                      <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                        <div className="w-0.5 h-3.5 bg-purple-300 rounded-full" />
                        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Billing Address</h3>
                        {edit.editing && (
                          <div className="ml-auto flex items-center gap-3">
                            <button type="button" onClick={() => copyEditAddress('shipping', 'billing')} className="text-xs font-semibold text-purple-700 hover:text-purple-900">Copy shipping to billing</button>
                            <PlacesAddressAutocomplete initialQuery={(ef.name as string) ?? customer.name} onAddressSelect={(address) => applyAddressToEdit('billing', address)} />
                          </div>
                        )}
                      </div>
                      <div className="px-5 py-4">
                        {edit.editing ? (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2"><FieldInput label="Address 1" name="billing_address1" value={(ef.billing_address1 as string) ?? ''} onChange={edit.handleEditChange} /></div>
                            <div className="col-span-2"><FieldInput label="Address 2" name="billing_address2" value={(ef.billing_address2 as string) ?? ''} onChange={edit.handleEditChange} /></div>
                            <FieldInput label="City" name="billing_city" value={(ef.billing_city as string) ?? ''} onChange={edit.handleEditChange} />
                            <FieldInput label="State" name="billing_state" value={(ef.billing_state as string) ?? ''} onChange={edit.handleEditChange} />
                            <FieldInput label="ZIP" name="billing_zip" value={(ef.billing_zip as string) ?? ''} onChange={edit.handleEditChange} />
                            <FieldInput label="Country" name="billing_country" value={(ef.billing_country as string) ?? ''} onChange={edit.handleEditChange} />
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
                        {edit.editing && (
                          <div className="ml-auto flex items-center gap-3">
                            <button type="button" onClick={() => copyEditAddress('billing', 'shipping')} className="text-xs font-semibold text-purple-700 hover:text-purple-900">Copy billing to shipping</button>
                            <PlacesAddressAutocomplete initialQuery={(ef.name as string) ?? customer.name} onAddressSelect={(address) => applyAddressToEdit('shipping', address)} />
                          </div>
                        )}
                      </div>
                      <div className="px-5 py-4">
                        {edit.editing ? (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2"><FieldInput label="Address 1" name="shipping_address1" value={(ef.shipping_address1 as string) ?? ''} onChange={edit.handleEditChange} /></div>
                            <div className="col-span-2"><FieldInput label="Address 2" name="shipping_address2" value={(ef.shipping_address2 as string) ?? ''} onChange={edit.handleEditChange} /></div>
                            <FieldInput label="City" name="shipping_city" value={(ef.shipping_city as string) ?? ''} onChange={edit.handleEditChange} />
                            <FieldInput label="State" name="shipping_state" value={(ef.shipping_state as string) ?? ''} onChange={edit.handleEditChange} />
                            <FieldInput label="ZIP" name="shipping_zip" value={(ef.shipping_zip as string) ?? ''} onChange={edit.handleEditChange} />
                            <FieldInput label="Country" name="shipping_country" value={(ef.shipping_country as string) ?? ''} onChange={edit.handleEditChange} />
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
                  {edit.editing ? (
                    <>
                      <FieldInput label="General Logo Color" name="general_logo_color" value={(ef.general_logo_color as string) ?? ''} onChange={edit.handleEditChange} />
                      <FieldInput label="Formal PMS Colors" name="formal_pms_colors" value={(ef.formal_pms_colors as string) ?? ''} onChange={edit.handleEditChange} />
                      <div className="col-span-2">
                        <FieldInput label="Artwork Notes" name="artwork_notes" value={(ef.artwork_notes as string) ?? ''} onChange={edit.handleEditChange} textarea rows={6} />
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
                  {edit.editing ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Commissioned Client</label>
                      <select value={(ef.commissioned_client as string) ?? ''}
                        onChange={(e) => edit.handleEditChange('commissioned_client', e.target.value)}
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
                  {edit.editing ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tax Exempt</label>
                      <div className="flex gap-4">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="edit_tax_exempt" value="yes"
                            checked={(ef.tax_exempt as boolean) === true}
                            onChange={() => edit.handleEditBoolChange('tax_exempt', true)}
                            className="w-4 h-4 border-slate-300 text-purple-600 focus:ring-purple-400" />
                          <span className="text-sm text-slate-700">Yes</span>
                        </label>
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="edit_tax_exempt" value="no"
                            checked={(ef.tax_exempt as boolean) === false}
                            onChange={() => edit.handleEditBoolChange('tax_exempt', false)}
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
              {(edit.editing || customer.notes) && (
                <div className="border-t border-slate-100">
                  <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                    <div className="w-0.5 h-3.5 bg-purple-300 rounded-full" />
                    <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Additional Information</h3>
                  </div>
                  <div className="px-5 py-4">
                    {edit.editing
                      ? <FieldInput label="Notes" name="notes" value={(ef.notes as string) ?? ''} onChange={edit.handleEditChange} textarea rows={6} />
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
            <CallLogCard entityType="customer" entityId={customer.id} />

            {/* Tags card */}
            <div className="bg-white border border-slate-200 rounded-2xl">
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
          <CustomerContactsList
            contacts={customer.contacts}
            onAddClick={() => setShowAddContact(true)}
            onContactClick={(id) => router.push(`/sales/contacts/${id}`)}
          />

          <CustomerOpportunitiesList
            opportunities={customer.opportunities}
            customerName={customer.name}
            customerId={customer.id}
            onAddClick={() =>
              router.push(
                `/sales/opportunities/new?customer_id=${customer.id}&customer_name=${encodeURIComponent(customer.name)}`
              )
            }
            onOpportunityClick={(id) => router.push(`/sales/opportunities/${id}`)}
          />

          <CustomerFilesList files={customer.files} />

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
          <button onClick={() => router.push(`/sales/tasks?customer_id=${customer.id}`)} className="text-purple-700 hover:underline">View tasks →</button>
        </div>
      )}

      {/* ── Artwork Tab ── */}
      {activeTab === 'artwork' && (
        <CustomerArtworkGrid
          artwork={artworkHook.artwork}
          loaded={artworkHook.loaded}
          loading={artworkHook.loading}
          vectorizingIds={artworkHook.vectorizingIds}
          onAdd={() => setShowArtworkModal(true)}
          onVectorize={artworkHook.vectorize}
          onDelete={artworkHook.remove}
        />
      )}

      <ArtworkUploadModal
        open={showArtworkModal}
        customerId={customer?.id ?? ''}
        onClose={() => setShowArtworkModal(false)}
        onAdded={artworkHook.add}
      />

      <AddContactModal
        open={showAddContact}
        customerId={customer?.id ?? ''}
        onClose={() => setShowAddContact(false)}
        onContactAdded={(contact) => {
          setCustomer((prev) => prev ? { ...prev, contacts: [...prev.contacts, contact as CustomerDetail['contacts'][0]] } : prev)
        }}
      />
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
                    {['Item', 'Supplier', 'Status', 'Date Sent', 'Follow-up', 'CSR'].map(h => (
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
